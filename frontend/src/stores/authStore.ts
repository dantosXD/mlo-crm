import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserFriendlyErrorMessage } from '../utils/errorHandler';
import { API_URL } from '../utils/apiBase';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number | null; // Timestamp of last user activity
  hasHydrated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
  updateLastActivity: () => void;
  checkSessionTimeout: (timeoutMinutes: number) => boolean;
  setHasHydrated: (value: boolean) => void;
}

type PersistedAuthState = {
  lastActivity: number | null;
};

export function normalizeLastActivity(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function migratePersistedAuthState(
  persistedState: unknown
): PersistedAuthState {
  const persisted = (persistedState as Partial<AuthState> | undefined) ?? {};
  return {
    lastActivity: normalizeLastActivity(persisted.lastActivity),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivity: null,
      hasHydrated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          set({
            user: data.user,
            accessToken: data.accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivity: Date.now(),
          });

          return true;
        } catch (error) {
          set({
            isLoading: false,
            error: getUserFriendlyErrorMessage(error, 'logging in'),
          });
          return false;
        }
      },

      logout: async () => {
        const { accessToken } = get();

        try {
          // Read CSRF token from cookie for the logout request
          const csrfMatch = document.cookie.match(/(?:^|; )csrf-token=([^;]*)/);
          const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
              ...(csrf && { 'X-CSRF-Token': csrf }),
            },
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        }

        // Clear the CSRF cookie
        document.cookie = 'csrf-token=; Max-Age=0; path=/';

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          error: null,
          lastActivity: null,
        });
      },

      updateLastActivity: () => {
        set({ lastActivity: Date.now() });
      },

      checkSessionTimeout: (timeoutMinutes: number) => {
        const { lastActivity } = get();
        if (!lastActivity) return false;

        const inactiveMs = Date.now() - lastActivity;
        const timeoutMs = timeoutMinutes * 60 * 1000;

        // Return true if session has expired (don't logout here, let caller handle it)
        return inactiveMs >= timeoutMs;
      },

      refreshAuth: async () => {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            if (response.status === 400 || response.status === 401) {
              set({
                user: null,
                accessToken: null,
                isAuthenticated: false,
                error: null,
                lastActivity: null,
              });
            }
            return false;
          }

          const data = await response.json();

          set({
            user: data.user,
            accessToken: data.accessToken,
            isAuthenticated: true,
            error: null,
            lastActivity: Date.now(),
          });

          return true;
        } catch {
          return false;
        }
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      updateUser: (updates: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setHasHydrated: (value: boolean) => {
        set({ hasHydrated: value });
      },
    }),
    {
      name: 'mlo-auth-storage',
      version: 2,
      migrate: (persistedState) => {
        return migratePersistedAuthState(persistedState);
      },
      partialize: (state) => ({
        lastActivity: state.lastActivity,
      }),
      merge: (persistedState, currentState) => {
        const persisted = migratePersistedAuthState(persistedState);
        return {
          ...currentState,
          lastActivity: persisted.lastActivity ?? null,
        };
      },
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.setHasHydrated(true);
          }
        };
      },
    }
  )
);

export default useAuthStore;
