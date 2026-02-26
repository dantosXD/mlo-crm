import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenter } from './NotificationCenter';
import { renderWithProviders } from '../test/testUtils';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mocks.apiGet(...args),
  },
  isTransientRequestError: () => false,
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    accessToken: 'token-1',
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

async function advanceTimers(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

describe('NotificationCenter polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mocks.apiGet.mockImplementation(async (path: string) => {
      if (path === '/notifications?limit=20') {
        return createResponse(true, []);
      }
      if (path === '/notifications/unread-count') {
        return createResponse(true, { count: 3 });
      }
      return createResponse(false, {});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses 120s polling when closed and 30s polling when opened', async () => {
    renderWithProviders(<NotificationCenter />);

    await advanceTimers(0);
    expect(mocks.apiGet).toHaveBeenCalledWith('/notifications/unread-count');
    const initialUnreadCalls = mocks.apiGet.mock.calls.filter(([path]) => path === '/notifications/unread-count').length;
    expect(initialUnreadCalls).toBe(1);

    await advanceTimers(119_000);
    expect(mocks.apiGet.mock.calls.filter(([path]) => path === '/notifications/unread-count')).toHaveLength(1);

    await advanceTimers(1_000);
    expect(mocks.apiGet.mock.calls.filter(([path]) => path === '/notifications/unread-count')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await advanceTimers(0);
    const afterOpenCalls = mocks.apiGet.mock.calls.filter(([path]) => path === '/notifications/unread-count').length;
    expect(afterOpenCalls).toBeGreaterThanOrEqual(3);

    await advanceTimers(29_000);
    expect(mocks.apiGet.mock.calls.filter(([path]) => path === '/notifications/unread-count')).toHaveLength(afterOpenCalls);

    await advanceTimers(1_000);
    expect(mocks.apiGet.mock.calls.filter(([path]) => path === '/notifications/unread-count')).toHaveLength(afterOpenCalls + 1);
  });

  it('backs off when unread polling requests keep failing', async () => {
    let unreadCall = 0;
    mocks.apiGet.mockImplementation(async (path: string) => {
      if (path === '/notifications?limit=20') {
        return createResponse(true, []);
      }
      if (path === '/notifications/unread-count') {
        unreadCall += 1;
        if (unreadCall <= 2) {
          return createResponse(false, { error: 'temporary failure' });
        }
        return createResponse(true, { count: 1 });
      }
      return createResponse(false, {});
    });

    renderWithProviders(<NotificationCenter />);

    await advanceTimers(0);
    expect(unreadCall).toBe(1);

    await advanceTimers(120_000);
    expect(unreadCall).toBe(2);

    await advanceTimers(239_000);
    expect(unreadCall).toBe(2);

    await advanceTimers(1_000);
    expect(unreadCall).toBe(3);
  });
});
