import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskForm from './TaskForm';
import { renderWithProviders } from '../../test/testUtils';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mocks.get(...args),
    post: (...args: unknown[]) => mocks.post(...args),
  },
  apiRequest: (...args: unknown[]) => mocks.apiRequest(...args),
}));

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

describe('TaskForm template integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (path === '/tasks/templates') {
        return createResponse(true, [
          {
            id: 'tpl-1',
            name: 'Compliance Follow Up',
            text: 'Upload missing disclosures',
            description: 'Required by EOD',
            type: 'COMPLIANCE',
            priority: 'URGENT',
            tags: ['compliance'],
            dueDays: 1,
          },
        ]);
      }
      return createResponse(false, {});
    });
    mocks.post.mockResolvedValue(createResponse(true, { id: 'saved-template-id' }));
    mocks.apiRequest.mockResolvedValue(createResponse(true, { id: 'task-id-1' }));
  });

  it('applies template and submits merged payload', async () => {
    renderWithProviders(
      <TaskForm
        opened
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const templateSelect = await screen.findByRole('textbox', { name: /Use Template/i });
    fireEvent.click(templateSelect);
    fireEvent.click(await screen.findByText('Compliance Follow Up'));

    expect(screen.getByLabelText(/Task \*/i)).toHaveValue('Upload missing disclosures');
    expect(screen.getByLabelText(/^Description$/i)).toHaveValue('Required by EOD');

    fireEvent.click(screen.getByRole('button', { name: /Create Task/i }));

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith('/tasks', expect.objectContaining({
        method: 'POST',
      }));
    });
    const [, requestOptions] = mocks.apiRequest.mock.calls[0];
    const payload = JSON.parse((requestOptions as { body: string }).body);
    expect(payload).toMatchObject({
      text: 'Upload missing disclosures',
      description: 'Required by EOD',
      type: 'COMPLIANCE',
      priority: 'URGENT',
    });
  });

  it('saves task template from current form values', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Urgent Compliance Template');

    renderWithProviders(
      <TaskForm
        opened
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Task \*/i), {
      target: { value: 'Send revised LE' },
    });
    fireEvent.change(screen.getByLabelText(/^Description$/i), {
      target: { value: 'Before 5pm today' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save as Template/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/tasks/templates', expect.objectContaining({
        name: 'Urgent Compliance Template',
        text: 'Send revised LE',
        description: 'Before 5pm today',
      }));
    });

    promptSpy.mockRestore();
  });
});

