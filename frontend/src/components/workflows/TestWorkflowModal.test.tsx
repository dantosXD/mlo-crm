import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestWorkflowModal from './TestWorkflowModal';
import { renderWithProviders } from '../../test/testUtils';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

describe('TestWorkflowModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes paginated client payload and runs workflow with client context', async () => {
    apiGetMock.mockResolvedValue(
      createResponse(true, {
        data: [{ id: 'client-1', name: 'Client One', status: 'LEAD' }],
      }),
    );
    apiPostMock.mockResolvedValue(
      createResponse(true, {
        success: true,
        status: 'COMPLETED',
        message: 'Workflow executed successfully',
        executionId: 'exec-1',
      }),
    );

    renderWithProviders(
      <TestWorkflowModal
        opened
        onClose={vi.fn()}
        workflowId="wf-1"
        workflowName="Workflow One"
        triggerType="MANUAL"
        mode="run"
      />,
    );

    const clientInput = await screen.findByRole('textbox', { name: 'Client' });
    fireEvent.click(clientInput);
    fireEvent.click(await screen.findByText('Client One (LEAD)'));

    fireEvent.change(screen.getByLabelText('Trigger Data (optional)'), {
      target: { value: '{"source":"qa","reason":"regression"}' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Workflow' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/workflows/wf-1/execute', {
        clientId: 'client-1',
        triggerData: {
          source: 'qa',
          reason: 'regression',
        },
      });
    });

    expect(await screen.findByText('Workflow Executed')).toBeInTheDocument();
    expect(screen.getByText('exec-1')).toBeInTheDocument();
  });

  it('blocks submission when trigger data is invalid JSON', async () => {
    apiGetMock.mockResolvedValue(
      createResponse(true, [
        { id: 'client-1', name: 'Client One', status: 'LEAD' },
      ]),
    );
    apiPostMock.mockResolvedValue(createResponse(true, {}));

    renderWithProviders(
      <TestWorkflowModal
        opened
        onClose={vi.fn()}
        workflowId="wf-2"
        workflowName="Workflow Two"
        triggerType="MANUAL"
        mode="test"
      />,
    );

    const clientInput = await screen.findByRole('textbox', { name: 'Client' });
    fireEvent.click(clientInput);
    fireEvent.click(await screen.findByText('Client One (LEAD)'));

    fireEvent.change(screen.getByLabelText('Trigger Data (optional)'), {
      target: { value: '{"source":"qa"' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Test' }));

    expect(await screen.findByText('Trigger data must be valid JSON')).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});

