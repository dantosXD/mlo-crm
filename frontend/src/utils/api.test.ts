import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

vi.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      accessToken: 'access-token-1',
    }),
  },
}));

describe('api CSRF bootstrap', () => {
  beforeEach(() => {
    document.cookie = 'csrf-token=; Max-Age=0; path=/';
    vi.restoreAllMocks();
  });

  it('primes csrf cookie on first mutating request and sends csrf header', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/auth/me')) {
          document.cookie = 'csrf-token=csrf-from-cookie; path=/';
        }
        return new Response('{}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      });

    await api.post('/clients', { name: 'Alice' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [, finalCall] = fetchSpy.mock.calls;
    const finalInit = finalCall[1] as RequestInit;
    const finalHeaders = finalInit.headers as Record<string, string>;

    expect(finalHeaders.Authorization).toBe('Bearer access-token-1');
    expect(finalHeaders['X-CSRF-Token']).toBe('csrf-from-cookie');
  });
});
