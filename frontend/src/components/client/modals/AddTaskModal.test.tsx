import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddTaskModal } from './AddTaskModal';
import { renderWithProviders } from '../../../test/testUtils';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mocks.get(...args),
    post: (...args: unknown[]) => mocks.post(...args),
  },
}));

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

describe('AddTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (path === '/users/team') {
        return createResponse(true, [{ id: 'user-1', name: 'Team User', role: 'ADMIN' }]);
      }
      if (path === '/tasks/templates') {
        return createResponse(true, [
          {
            id: 'task-template-1',
            name: 'Client Follow Up',
            text: 'Call client for docs',
            description: 'Collect pay stubs',
            priority: 'HIGH',
            dueDays: 2,
          },
        ]);
      }
      return createResponse(false, {});
    });
    mocks.post.mockImplementation(async (path: string) => {
      if (path === '/tasks') return createResponse(true, { id: 'task-1' });
      if (path === '/tasks/templates') return createResponse(true, { id: 'task-template-2' });
      return createResponse(false, {});
    });
  });

  it('applies selected template values in task creation payload', async () => {
    renderWithProviders(
      <AddTaskModal
        opened
        onClose={vi.fn()}
        clientId="client-1"
      />,
    );

    const templateSelect = await screen.findByRole('textbox', { name: /Use Template/i });
    fireEvent.click(templateSelect);
    fireEvent.click(await screen.findByText('Client Follow Up'));

    expect(screen.getByPlaceholderText('Enter task description...')).toHaveValue('Call client for docs');
    expect(screen.getByPlaceholderText('Add more details...')).toHaveValue('Collect pay stubs');

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
        clientId: 'client-1',
        text: 'Call client for docs',
        description: 'Collect pay stubs',
        priority: 'HIGH',
      }));
    });
  });

  it('saves a task template from form values', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Saved Task Template');

    renderWithProviders(
      <AddTaskModal
        opened
        onClose={vi.fn()}
        clientId="client-1"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Enter task description...'), { target: { value: 'Prepare preapproval letter' } });
    fireEvent.change(screen.getByPlaceholderText('Add more details...'), { target: { value: 'Use latest income docs' } });
    fireEvent.click(screen.getByRole('button', { name: /Save as Template/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/tasks/templates', expect.objectContaining({
        name: 'Saved Task Template',
        text: 'Prepare preapproval letter',
        description: 'Use latest income docs',
      }));
    });

    promptSpy.mockRestore();
  });
});
