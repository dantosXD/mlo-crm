import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReminderForm from './ReminderForm';
import { renderWithProviders } from '../../test/testUtils';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  getClients: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mocks.get(...args),
    post: (...args: unknown[]) => mocks.post(...args),
    put: (...args: unknown[]) => mocks.put(...args),
  },
  getClients: (...args: unknown[]) => mocks.getClients(...args),
}));

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

describe('ReminderForm templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (path === '/reminders/templates') {
        return createResponse(true, [
          {
            id: 'rem-tpl-1',
            name: 'Follow Up Tomorrow',
            config: {
              title: 'Follow up borrower',
              description: 'Collect remaining items',
              category: 'FOLLOW_UP',
              priority: 'HIGH',
              tags: ['follow-up'],
              remindOffset: { value: 1, unit: 'days', atTime: '10:30' },
              dueOffset: { value: 2, unit: 'days', atTime: '17:00' },
            },
          },
        ]);
      }
      return createResponse(false, {});
    });
    mocks.post.mockResolvedValue(createResponse(true, { id: 'reminder-1' }));
    mocks.put.mockResolvedValue(createResponse(true, { id: 'reminder-1' }));
    mocks.getClients.mockResolvedValue([{ id: 'client-1', name: 'Client One' }]);
  });

  it('applies template offsets into reminder form and submits merged payload', async () => {
    renderWithProviders(
      <ReminderForm
        opened
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const templateSelect = await screen.findByRole('textbox', { name: /Use Template/i });
    fireEvent.click(templateSelect);
    fireEvent.click(await screen.findByText('Follow Up Tomorrow'));

    expect(screen.getByPlaceholderText('Enter reminder title')).toHaveValue('Follow up borrower');
    expect(screen.getByPlaceholderText('Enter description (optional)')).toHaveValue('Collect remaining items');

    fireEvent.click(screen.getByRole('button', { name: /Create Reminder/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/reminders', expect.objectContaining({
        title: 'Follow up borrower',
        category: 'FOLLOW_UP',
        priority: 'HIGH',
      }));
    });
  });

  it('saves reminder template from current form state', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Saved Reminder Template');

    renderWithProviders(
      <ReminderForm
        opened
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Enter reminder title'), {
      target: { value: 'Call lender for condition update' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save as Template/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/reminders/templates', expect.objectContaining({
        name: 'Saved Reminder Template',
        config: expect.objectContaining({
          title: 'Call lender for condition update',
          remindOffset: expect.objectContaining({ unit: 'days' }),
        }),
      }));
    });

    promptSpy.mockRestore();
  });
});
