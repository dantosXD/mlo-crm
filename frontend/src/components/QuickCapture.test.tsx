import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickCapture } from './QuickCapture';
import { renderWithProviders } from '../test/testUtils';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
}));
const hotkeysState = vi.hoisted(() => ({
  bindings: [] as Array<[string, (event: { preventDefault: () => void }) => void]>,
}));

vi.mock('@mantine/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/hooks')>();
  return {
    ...actual,
    useHotkeys: (bindings: Array<[string, (event: { preventDefault: () => void }) => void]>) => {
      hotkeysState.bindings = bindings;
    },
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../utils/api', () => ({
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

function openQuickCapture() {
  const binding = hotkeysState.bindings.find(([hotkey]) => hotkey === 'mod+k');
  act(() => {
    binding?.[1]({ preventDefault: () => {} });
  });
}

describe('QuickCapture template commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (path === '/clients') {
        return createResponse(true, [{ id: 'client-1', name: 'Client One', email: 'client@example.com' }]);
      }
      if (path === '/tasks/templates') {
        return createResponse(true, [{ id: 'task-tpl', name: 'Task Template', text: 'Template task', priority: 'HIGH' }]);
      }
      if (path === '/notes/templates') {
        return createResponse(true, [{ id: 'note-tpl', name: 'Note Template', content: 'Template note', tags: ['tag-1'] }]);
      }
      if (path === '/reminders/templates') {
        return createResponse(true, [{
          id: 'rem-tpl',
          name: 'Reminder Template',
          config: { title: 'Template reminder', remindOffset: { value: 1, unit: 'days', atTime: '10:00' } },
        }]);
      }
      if (path === '/activities/templates') {
        return createResponse(true, [{
          id: 'act-tpl',
          name: 'Activity Template',
          config: { type: 'INTERACTION_OTHER', description: 'Template activity' },
        }]);
      }
      return createResponse(false, {});
    });

    mocks.post.mockImplementation(async (path: string) => {
      if (path === '/tasks') return createResponse(true, { id: 'task-created' });
      if (path === '/notes') return createResponse(true, { id: 'note-created' });
      if (path === '/reminders') return createResponse(true, { id: 'reminder-created' });
      if (path === '/activities') return createResponse(true, { id: 'activity-created', followUp: null });
      return createResponse(false, {});
    });
  });

  it('shows /reminder and /activity slash commands', async () => {
    renderWithProviders(<QuickCapture />);
    openQuickCapture();

    const input = await screen.findByPlaceholderText(/Type \/ for commands/i);
    fireEvent.change(input, { target: { value: '/' } });

    expect(await screen.findByText('/reminder')).toBeInTheDocument();
    expect(await screen.findByText('/activity')).toBeInTheDocument();
  });

  it('opens from global launcher event', async () => {
    renderWithProviders(<QuickCapture />);

    act(() => {
      window.dispatchEvent(new Event('mlo:open-quick-capture'));
    });

    expect(await screen.findByPlaceholderText(/Type \/ for commands/i)).toBeInTheDocument();
  });

  it('applies template selection for /task and /reminder', async () => {
    renderWithProviders(<QuickCapture />);
    openQuickCapture();

    const input = await screen.findByPlaceholderText(/Type \/ for commands/i);

    fireEvent.change(input, { target: { value: '/task ' } });
    fireEvent.click(await screen.findByRole('textbox', { name: /Template \(optional\)/i }));
    fireEvent.click(await screen.findByText('Task Template'));
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
        text: 'Template task',
        priority: 'HIGH',
      }));
    });

    fireEvent.change(input, { target: { value: '/reminder ' } });
    fireEvent.click(await screen.findByRole('textbox', { name: /Template \(optional\)/i }));
    fireEvent.click(await screen.findByText('Reminder Template'));
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/reminders', expect.objectContaining({
        title: 'Template reminder',
      }));
    });
  });

  it('supports /note and /activity client-selection flow when no client is detected', async () => {
    renderWithProviders(<QuickCapture />);
    openQuickCapture();

    const input = await screen.findByPlaceholderText(/Type \/ for commands/i);

    fireEvent.change(input, { target: { value: '/note ' } });
    fireEvent.click(await screen.findByRole('textbox', { name: /Template \(optional\)/i }));
    fireEvent.click(await screen.findByText('Note Template'));
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText(/Select a client/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Client One'));
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        clientId: 'client-1',
        text: 'Template note',
        tags: ['tag-1'],
      }));
    });

    openQuickCapture();
    const reopenedInput = await screen.findByPlaceholderText(/Type \/ for commands/i);
    fireEvent.change(reopenedInput, { target: { value: '/activity ' } });
    fireEvent.click(await screen.findByRole('textbox', { name: /Template \(optional\)/i }));
    fireEvent.click(await screen.findByText('Activity Template'));
    fireEvent.keyDown(reopenedInput, { key: 'Enter' });

    expect(await screen.findByText(/Select a client/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Client One'));
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/activities', expect.objectContaining({
        clientId: 'client-1',
        templateId: 'act-tpl',
      }));
    });
  });
});
