import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './Settings';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();
const apiPutMock = vi.fn();
const notificationShowMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
    put: (...args: unknown[]) => apiPutMock(...args),
  },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'ADMIN',
      phone: '',
    },
    updateUser: updateUserMock,
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: (...args: unknown[]) => notificationShowMock(...args),
  },
}));

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe('Settings calendar integrations OAuth flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    apiGetMock.mockImplementation(async (path: string) => {
      if (path === '/calendar-sync/connections') {
        return createResponse(true, []);
      }
      if (path === '/calendar-sync/status') {
        return createResponse(true, []);
      }
      if (path === '/calendar-sync/oauth/google/start') {
        return createResponse(true, {
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test-client',
        });
      }
      if (path === '/calendar-sync/oauth/outlook/start') {
        return createResponse(true, {
          authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test-client',
        });
      }
      if (path === '/calendar-sync/oauth/google/availability') {
        return createResponse(true, {
          provider: 'google',
          available: true,
        });
      }
      if (path === '/calendar-sync/oauth/outlook/availability') {
        return createResponse(true, {
          provider: 'outlook',
          available: true,
        });
      }
      if (path === '/users/preferences') {
        return createResponse(true, {
          notifications: {
            emailAlerts: true,
            taskReminders: true,
            clientUpdates: true,
            weeklyDigest: false,
          },
          appearance: {
            theme: 'light',
            compactMode: false,
            showWelcome: true,
          },
          profile: {
            phone: '',
          },
        });
      }
      return createResponse(false, {
        error: 'Unexpected request',
      });
    });

    apiPostMock.mockResolvedValue(createResponse(true, {}));
    apiPatchMock.mockResolvedValue(createResponse(true, {}));
    apiDeleteMock.mockResolvedValue(createResponse(true, {}));
    apiPutMock.mockResolvedValue(createResponse(true, {
      notifications: {
        emailAlerts: true,
        taskReminders: true,
        clientUpdates: true,
        weeklyDigest: false,
      },
      appearance: {
        theme: 'light',
        compactMode: false,
        showWelcome: true,
      },
      profile: {
        phone: '',
      },
      user: {
        name: 'Admin User',
        email: 'admin@example.com',
        phone: '',
      },
    }));
  });

  it('renders OAuth connect actions for Google/Outlook and starts OAuth flow', async () => {
    const assignMock = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      assign: assignMock,
    });

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/settings?tab=integrations']}>
          <Routes>
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    );

    const googleButton = await screen.findByRole('button', { name: /connect with google/i });
    const outlookButton = await screen.findByRole('button', { name: /connect with microsoft/i });
    expect(googleButton).toBeInTheDocument();
    expect(outlookButton).toBeInTheDocument();

    // Manual token inputs should only render for Apple (single access token field).
    expect(screen.getAllByLabelText('Access Token')).toHaveLength(1);

    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/calendar-sync/oauth/google/start');
      expect(assignMock).toHaveBeenCalledWith(
        expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth')
      );
    });
  });

  it('shows callback status once and clears transient oauth query params', async () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/settings?tab=integrations&oauth=success&provider=google&message=ok']}>
          <Routes>
            <Route
              path="/settings"
              element={(
                <>
                  <Settings />
                  <LocationProbe />
                </>
              )}
            />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    );

    await waitFor(() => {
      expect(notificationShowMock).toHaveBeenCalledTimes(1);
      expect(notificationShowMock).toHaveBeenCalledWith(expect.objectContaining({
        color: 'green',
      }));
    });

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent || '';
      expect(search).toContain('tab=integrations');
      expect(search).not.toContain('oauth=');
      expect(search).not.toContain('provider=');
      expect(search).not.toContain('message=');
    });
  });

  it('sends phone in profile save payload and updates auth store with persisted phone', async () => {
    apiPutMock.mockResolvedValueOnce(createResponse(true, {
      user: {
        name: 'Admin User',
        email: 'admin@example.com',
        phone: '555-100-2000',
      },
    }));

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.change(await screen.findByLabelText('Phone Number'), {
      target: { value: '555-100-2000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/auth/profile', expect.objectContaining({
        phone: '555-100-2000',
      }));
      expect(updateUserMock).toHaveBeenCalledWith(expect.objectContaining({
        phone: '555-100-2000',
      }));
    });
  });

  it('persists notification preferences via /users/preferences', async () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/settings?tab=notifications']}>
          <Routes>
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Notifications' }));
    fireEvent.click(await screen.findByLabelText('Weekly Digest'));
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/users/preferences', expect.objectContaining({
        preferences: expect.objectContaining({
          notifications: expect.objectContaining({
            weeklyDigest: true,
          }),
        }),
      }));
    });
  });

  it('shows actionable inline error when oauth start fails', async () => {
    apiGetMock.mockImplementation(async (path: string) => {
      if (path === '/calendar-sync/connections' || path === '/calendar-sync/status') {
        return createResponse(true, []);
      }
      if (path === '/calendar-sync/oauth/google/availability') {
        return createResponse(true, { provider: 'google', available: true });
      }
      if (path === '/calendar-sync/oauth/outlook/availability') {
        return createResponse(true, { provider: 'outlook', available: true });
      }
      if (path === '/calendar-sync/oauth/google/start') {
        return createResponse(false, { error: 'Failed to start calendar OAuth flow' });
      }
      return createResponse(false, { error: 'Unexpected request' });
    });

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/settings?tab=integrations']}>
          <Routes>
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /connect with google/i }));

    expect(await screen.findByText(/failed to start calendar oauth flow/i)).toBeInTheDocument();
  });
});
