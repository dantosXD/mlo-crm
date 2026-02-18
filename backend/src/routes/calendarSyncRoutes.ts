import { Router, Request, Response } from 'express';
import {
  getUserCalendarConnections,
  saveCalendarConnection,
  removeCalendarConnection,
  biDirectionalSync,
  getSyncStatus,
  buildOAuthAuthorizationUrl,
  handleOAuthCallback,
  refreshProviderAccessToken,
} from '../services/calendarSyncService';
import { authenticateToken } from '../middleware/auth';
import { calendarSyncLimiter } from '../middleware/rateLimiter.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();
const env = getEnv();

function getRequestBaseUrl(req: Request): string {
  const host = req.get('host');
  if (!host) {
    return 'http://localhost:3002';
  }
  return `${req.protocol}://${host}`;
}

function providerLabel(provider: string): string {
  if (provider === 'google') {
    return 'Google Calendar';
  }
  if (provider === 'outlook') {
    return 'Microsoft Outlook';
  }
  if (provider === 'apple') {
    return 'Apple Calendar';
  }
  return provider;
}

function isSupportedProvider(provider: string): boolean {
  return ['google', 'outlook', 'apple'].includes(provider);
}

function isOAuthProvider(provider: string): provider is 'google' | 'outlook' {
  return provider === 'google' || provider === 'outlook';
}

function buildFrontendOAuthResultUrl(result: {
  status: 'success' | 'error';
  provider: string;
  message?: string;
}): string {
  const base = (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const url = new URL('/settings', base);
  url.searchParams.set('tab', 'integrations');
  url.searchParams.set('oauth', result.status);
  url.searchParams.set('provider', result.provider);
  if (result.message) {
    url.searchParams.set('message', result.message);
  }
  return url.toString();
}

router.get('/oauth/:provider/start', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const { provider } = req.params;
    if (!isOAuthProvider(provider)) {
      return res.status(400).json({ error: 'Invalid OAuth provider. Must be google or outlook.' });
    }

    const requestBaseUrl = getRequestBaseUrl(req);
    const useMock = req.query.mock === '1' || req.query.mock === 'true';
    const { authUrl } = await buildOAuthAuthorizationUrl(userId, provider, requestBaseUrl, { mock: useMock });
    return res.json({
      authUrl,
      provider,
    });
  } catch (error) {
    logger.error('calendar_oauth_start_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to start calendar OAuth flow' });
  }
});

router.get('/oauth/:provider/callback', async (req: Request, res: Response) => {
  const { provider } = req.params;
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

  if (!isOAuthProvider(provider)) {
    const redirectUrl = buildFrontendOAuthResultUrl({
      status: 'error',
      provider: provider || 'unknown',
      message: 'Invalid provider',
    });
    return res.redirect(redirectUrl);
  }

  if (oauthError) {
    const redirectUrl = buildFrontendOAuthResultUrl({
      status: 'error',
      provider,
      message: oauthError,
    });
    return res.redirect(redirectUrl);
  }

  try {
    const requestBaseUrl = getRequestBaseUrl(req);
    await handleOAuthCallback(provider, code, state, requestBaseUrl);
    return res.redirect(
      buildFrontendOAuthResultUrl({
        status: 'success',
        provider,
      })
    );
  } catch (error) {
    logger.warn('calendar_oauth_callback_failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.redirect(
      buildFrontendOAuthResultUrl({
        status: 'error',
        provider,
        message: error instanceof Error ? error.message : 'OAuth callback failed',
      })
    );
  }
});

router.post('/oauth/:provider/refresh', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const { provider } = req.params;
    if (!isOAuthProvider(provider)) {
      return res.status(400).json({ error: 'Invalid OAuth provider. Must be google or outlook.' });
    }
    const requestBaseUrl = getRequestBaseUrl(req);
    const refreshed = await refreshProviderAccessToken(userId, provider, requestBaseUrl);
    return res.json({
      provider,
      tokenExpiresAt: refreshed.tokenExpiresAt || null,
      hasAccessToken: !!refreshed.accessToken,
      syncEnabled: refreshed.syncEnabled,
    });
  } catch (error) {
    logger.warn('calendar_oauth_refresh_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to refresh token' });
  }
});

// GET /api/calendar-sync/connections - Get all calendar connections for user
router.get('/connections', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const connections = await getUserCalendarConnections(userId);

    // Map connections to include provider names
    const connectionsWithNames = connections.map((conn) => ({
      provider: conn.provider,
      providerName: providerLabel(conn.provider),
      calendarId: conn.calendarId,
      lastSyncedAt: conn.lastSyncedAt,
      syncEnabled: conn.syncEnabled,
      hasAccessToken: !!conn.accessToken,
      tokenExpiresAt: conn.tokenExpiresAt || null,
      scopes: conn.scopes || [],
    }));

    res.json(connectionsWithNames);
  } catch (error) {
    logger.error('calendar_connections_fetch_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to fetch calendar connections' });
  }
});

// GET /api/calendar-sync/status - Get sync status for all calendars
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const status = await getSyncStatus(userId);

    // Map provider names
    const statusWithNames = status.map((s) => ({
      ...s,
      providerName: providerLabel(s.provider),
    }));

    res.json(statusWithNames);
  } catch (error) {
    logger.error('calendar_status_fetch_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// POST /api/calendar-sync/connect - Connect to an external calendar
router.post('/connect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider, accessToken, refreshToken, calendarId, syncEnabled } = req.body;

    if (!provider || !accessToken) {
      return res.status(400).json({ error: 'Provider and access token are required' });
    }

    if (!isSupportedProvider(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be google, outlook, or apple' });
    }

    if (provider === 'google' || provider === 'outlook') {
      return res.status(400).json({ error: 'Manual token connect disabled for OAuth providers. Use /oauth/:provider/start.' });
    }

    const connection = {
      provider,
      accessToken,
      refreshToken,
      calendarId,
      syncEnabled: syncEnabled !== undefined ? syncEnabled : true,
    };

    await saveCalendarConnection(userId, connection);

    res.json({
      message: `Successfully connected to ${provider} calendar`,
      provider,
    });
  } catch (error) {
    logger.error('calendar_connect_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to connect calendar' });
  }
});

// DELETE /api/calendar-sync/disconnect/:provider - Disconnect a calendar
router.delete('/disconnect/:provider', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider } = req.params;

    if (!isSupportedProvider(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    await removeCalendarConnection(userId, provider);

    res.json({
      message: `Successfully disconnected from ${provider} calendar`,
    });
  } catch (error) {
    logger.error('calendar_disconnect_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

// POST /api/calendar-sync/sync - Trigger sync for connected calendars
router.post('/sync', authenticateToken, calendarSyncLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { providers, forceSync } = req.body;

    const result = await biDirectionalSync(userId, {
      providers,
      forceSync,
    });

    res.json({
      message: 'Sync completed',
      result: {
        synced: result.synced,
        pushed: result.pushed,
        conflicts: result.conflicts,
        errors: result.errors,
      },
    });
  } catch (error) {
    logger.error('calendar_sync_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to sync calendars' });
  }
});

// PATCH /api/calendar-sync/settings/:provider - Update sync settings for a provider
router.patch('/settings/:provider', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider } = req.params;
    const { syncEnabled, calendarId } = req.body;

    if (!isSupportedProvider(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const connections = await getUserCalendarConnections(userId);
    const connection = connections.find((c) => c.provider === provider);

    if (!connection) {
      return res.status(404).json({ error: 'Calendar connection not found' });
    }

    // Update connection settings
    const updatedConnection = {
      ...connection,
      syncEnabled: syncEnabled !== undefined ? syncEnabled : connection.syncEnabled,
      calendarId: calendarId !== undefined ? calendarId : connection.calendarId,
    };

    await saveCalendarConnection(userId, updatedConnection);

    res.json({
      message: `Updated ${provider} calendar settings`,
    });
  } catch (error) {
    logger.error('calendar_settings_update_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to update calendar settings' });
  }
});

export default router;
