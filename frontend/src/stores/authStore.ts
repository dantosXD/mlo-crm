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
  refreshToken: string | null;
  csrfToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number | null; // Timestamp of last user activity

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
  updateLastActivity: () => void;
  checkSessionTimeout: (timeoutMinutes: number) => boolean;
  updateCsrfToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      csrfToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivity: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          // Set auth data first (CSRF token will be null initially)
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            csrfToken: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivity: Date.now(),
          });

          // Make an authenticated GET request to obtain CSRF token
          // The backend's generateCsrfToken middleware will add it to response headers
          try {
            const csrfResponse = await fetch(`${API_URL}/auth/me`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${data.accessToken}`,
              },
            });

            // Extract CSRF token from response headers
            const csrfToken = csrfResponse.headers.get('X-CSRF-Token');

            if (csrfToken) {
              set({ csrfToken });
            }
          } catch (csrfError) {
            // Non-critical error - user is logged in but CSRF token fetch failed
            console.warn('Failed to fetch CSRF token:', csrfError);
          }

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
        const { refreshToken, csrfToken } = get();

        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
            },
            body: JSON.stringify({ refreshToken }),
          });
        } catch (error) {
          console.error('Logout error:', error);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          csrfToken: null,
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
        const { refreshToken } = get();

        if (!refreshToken) {
          set({ isAuthenticated: false });
          return false;
        }

        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            throw new Error('Token refresh failed');
          }

          const data = await response.json();

          // Extract CSRF token from response headers
          const csrfToken = response.headers.get('X-CSRF-Token');

          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            csrfToken: csrfToken || null,
            isAuthenticated: true,
          });

          return true;
        } catch (error) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            csrfToken: null,
            isAuthenticated: false,
          });
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

      updateCsrfToken: (token: string) => {
        set({ csrfToken: token });
      },
    }),
    {
      name: 'mlo-auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        csrfToken: state.csrfToken,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

export default useAuthStore;
