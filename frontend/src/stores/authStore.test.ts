import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migratePersistedAuthState, normalizeLastActivity, useAuthStore } from './authStore';

describe('authStore migration helpers', () => {
  it('normalizes numeric string lastActivity to number', () => {
    expect(normalizeLastActivity('1700000000000')).toBe(1700000000000);
  });

  it('returns null for invalid lastActivity values', () => {
    expect(normalizeLastActivity('not-a-number')).toBeNull();
    expect(normalizeLastActivity(0)).toBeNull();
    expect(normalizeLastActivity(undefined)).toBeNull();
  });

  it('migrates persisted auth state to normalized lastActivity', () => {
    const migrated = migratePersistedAuthState({ lastActivity: '1700000001000' });
    expect(migrated.lastActivity).toBe(1700000001000);
  });
});

describe('authStore refreshAuth', () => {
  beforeEach(() => {
    localStorage.removeItem('mlo-auth-storage');
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivity: null,
      hasHydrated: true,
    });
  });

  it('stores user and access token on successful refresh', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'token-1',
          user: {
            id: 'u1',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'ADMIN',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const refreshed = await useAuthStore.getState().refreshAuth();
    const state = useAuthStore.getState();

    expect(refreshed).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('token-1');
    expect(state.user?.email).toBe('admin@example.com');
    expect(state.lastActivity).toBe(1700000000000);
  });

  it('clears auth state on definitive invalid session responses (400/401)', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      },
      accessToken: 'token-1',
      isAuthenticated: true,
      lastActivity: 1700000000000,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Invalid refresh token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const refreshed = await useAuthStore.getState().refreshAuth();
    const state = useAuthStore.getState();

    expect(refreshed).toBe(false);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.lastActivity).toBeNull();
  });

  it('does not clear in-memory auth state on rate-limit or transient failures', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      },
      accessToken: 'token-1',
      isAuthenticated: true,
      lastActivity: 1700000000000,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Too many refresh attempts' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const refreshed = await useAuthStore.getState().refreshAuth();
    const state = useAuthStore.getState();

    expect(refreshed).toBe(false);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('admin@example.com');
    expect(state.accessToken).toBe('token-1');
    expect(state.lastActivity).toBe(1700000000000);
  });
});
