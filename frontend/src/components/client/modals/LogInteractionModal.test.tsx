import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogInteractionModal } from './LogInteractionModal';
import { renderWithProviders } from '../../../test/testUtils';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock('../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mocks.get(...args),
    post: (...args: unknown[]) => mocks.post(...args),
  },
}));

vi.mock('../../../hooks/useClientData', () => ({
  useLogInteraction: () => ({
    mutateAsync: (...args: unknown[]) => mocks.mutateAsync(...args),
    isPending: false,
  }),
}));

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

describe('LogInteractionModal templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (path === '/activities/templates') {
        return createResponse(true, [
          {
            id: 'activity-tpl-1',
            name: 'Call Follow-up',
            config: {
              type: 'CALL_PLACED',
              description: 'Called borrower for docs',
              metadata: { duration: 10, outcome: 'LEFT_VOICEMAIL' },
            },
            autoFollowUp: {
              kind: 'TASK',
              text: 'Send follow-up email',
              priority: 'HIGH',
              dueOffset: { value: 1, unit: 'days', atTime: '09:00' },
            },
          },
        ]);
      }
      return createResponse(false, {});
    });
    mocks.post.mockResolvedValue(createResponse(true, { id: 'activity-template-created' }));
    mocks.mutateAsync.mockResolvedValue({ id: 'activity-1' });
  });

  it('applies activity template and submits with templateId/followUp payload', async () => {
    renderWithProviders(
      <LogInteractionModal
        opened
        onClose={vi.fn()}
        clientId="client-1"
      />,
    );

    const templateSelect = await screen.findByRole('textbox', { name: /Use Template/i });
    fireEvent.click(templateSelect);
    fireEvent.click(await screen.findByText('Call Follow-up'));

    expect(screen.getByLabelText(/Description/i)).toHaveValue('Called borrower for docs');

    fireEvent.click(screen.getByRole('button', { name: /Log Interaction/i }));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        type: 'CALL_PLACED',
        description: 'Called borrower for docs',
        templateId: 'activity-tpl-1',
        followUp: expect.objectContaining({
          kind: 'TASK',
          priority: 'HIGH',
        }),
      }));
    });
  });

  it('saves activity template with follow-up config', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Saved Activity Template');

    renderWithProviders(
      <LogInteractionModal
        opened
        onClose={vi.fn()}
        clientId="client-1"
      />,
    );

    const templateSelect = await screen.findByRole('textbox', { name: /Use Template/i });
    fireEvent.click(templateSelect);
    fireEvent.click(await screen.findByText('Call Follow-up'));
    fireEvent.click(screen.getByRole('button', { name: /Save as Template/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/activities/templates', expect.objectContaining({
        name: 'Saved Activity Template',
        config: expect.objectContaining({
          type: 'CALL_PLACED',
          description: 'Called borrower for docs',
        }),
        autoFollowUp: expect.objectContaining({
          kind: 'TASK',
          priority: 'HIGH',
        }),
      }));
    });

    promptSpy.mockRestore();
  });
});

