import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserCalendarConnections: vi.fn(),
  saveCalendarConnection: vi.fn(),
  removeCalendarConnection: vi.fn(),
  biDirectionalSync: vi.fn(),
  getSyncStatus: vi.fn(),
  buildOAuthAuthorizationUrl: vi.fn(),
  handleOAuthCallback: vi.fn(),
  refreshProviderAccessToken: vi.fn(),
}));
const envState = vi.hoisted(() => ({
  FRONTEND_URL: 'http://localhost:5173',
  CALENDAR_OAUTH_ENABLED: true,
  CALENDAR_OAUTH_TEST_MODE: false,
  GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3002/api/calendar-sync/oauth/google/callback',
  MICROSOFT_OAUTH_CLIENT_ID: 'microsoft-client-id',
  MICROSOFT_OAUTH_CLIENT_SECRET: 'microsoft-client-secret',
  MICROSOFT_OAUTH_REDIRECT_URI: 'http://localhost:3002/api/calendar-sync/oauth/outlook/callback',
}));

vi.mock('../services/calendarSyncService', () => ({
  getUserCalendarConnections: mocks.getUserCalendarConnections,
  saveCalendarConnection: mocks.saveCalendarConnection,
  removeCalendarConnection: mocks.removeCalendarConnection,
  biDirectionalSync: mocks.biDirectionalSync,
  getSyncStatus: mocks.getSyncStatus,
  buildOAuthAuthorizationUrl: mocks.buildOAuthAuthorizationUrl,
  handleOAuthCallback: mocks.handleOAuthCallback,
  refreshProviderAccessToken: mocks.refreshProviderAccessToken,
}));

vi.mock('../config/env.js', () => ({
  getEnv: () => envState,
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/rateLimiter.js', () => ({
  calendarSyncLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

async function createTestApp() {
  const { default: router } = await import('./calendarSyncRoutes.js');
  const app = express();
  app.use('/api/calendar-sync', router);
  return app;
}

describe('calendarSyncRoutes OAuth callback redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(envState, {
      FRONTEND_URL: 'http://localhost:5173',
      CALENDAR_OAUTH_ENABLED: true,
      CALENDAR_OAUTH_TEST_MODE: false,
      GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3002/api/calendar-sync/oauth/google/callback',
      MICROSOFT_OAUTH_CLIENT_ID: 'microsoft-client-id',
      MICROSOFT_OAUTH_CLIENT_SECRET: 'microsoft-client-secret',
      MICROSOFT_OAUTH_REDIRECT_URI: 'http://localhost:3002/api/calendar-sync/oauth/outlook/callback',
    });
    mocks.handleOAuthCallback.mockResolvedValue({
      userId: 'user-1',
      provider: 'google',
    });
  });

  it('redirects successful callback to settings integrations tab', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .get('/api/calendar-sync/oauth/google/callback')
      .query({ code: 'auth-code', state: 'signed-state' });

    expect(mocks.handleOAuthCallback).toHaveBeenCalledWith(
      'google',
      'auth-code',
      'signed-state',
      expect.any(String)
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/settings?');
    expect(response.headers.location).toContain('tab=integrations');
    expect(response.headers.location).toContain('oauth=success');
    expect(response.headers.location).toContain('provider=google');
  });

  it('redirects oauth provider error to settings integrations tab', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .get('/api/calendar-sync/oauth/google/callback')
      .query({ error: 'access_denied' });

    expect(mocks.handleOAuthCallback).not.toHaveBeenCalled();
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/settings?');
    expect(response.headers.location).toContain('tab=integrations');
    expect(response.headers.location).toContain('oauth=error');
    expect(response.headers.location).toContain('provider=google');
    expect(response.headers.location).toContain('message=access_denied');
  });
});

describe('calendarSyncRoutes OAuth availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns available=true when oauth is configured', async () => {
    Object.assign(envState, {
      CALENDAR_OAUTH_ENABLED: true,
      CALENDAR_OAUTH_TEST_MODE: false,
      GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
    });

    const app = await createTestApp();
    const response = await request(app).get('/api/calendar-sync/oauth/google/availability');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      provider: 'google',
      available: true,
    });
  });

  it('returns available=false with missing configuration reason', async () => {
    Object.assign(envState, {
      CALENDAR_OAUTH_ENABLED: true,
      CALENDAR_OAUTH_TEST_MODE: false,
      GOOGLE_OAUTH_CLIENT_ID: '',
      GOOGLE_OAUTH_CLIENT_SECRET: '',
    });

    const app = await createTestApp();
    const response = await request(app).get('/api/calendar-sync/oauth/google/availability');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      provider: 'google',
      available: false,
      reason: 'MISSING_CONFIGURATION',
    });
  });
});
