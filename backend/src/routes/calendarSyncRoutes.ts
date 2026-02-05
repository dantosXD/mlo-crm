import { Router, Request, Response } from 'express';
import {
  getUserCalendarConnections,
  saveCalendarConnection,
  removeCalendarConnection,
  biDirectionalSync,
  getSyncStatus,
} from '../services/calendarSyncService';
import { authenticateToken } from '../middleware/auth';
import { calendarSyncLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// GET /api/calendar-sync/connections - Get all calendar connections for user
router.get('/connections', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const connections = await getUserCalendarConnections(userId);

    // Map connections to include provider names
    const connectionsWithNames = connections.map((conn) => ({
      provider: conn.provider,
      providerName:
        conn.provider === 'google'
          ? 'Google Calendar'
          : conn.provider === 'outlook'
          ? 'Microsoft Outlook'
          : conn.provider === 'apple'
          ? 'Apple Calendar'
          : conn.provider,
      calendarId: conn.calendarId,
      lastSyncedAt: conn.lastSyncedAt,
      syncEnabled: conn.syncEnabled,
      hasAccessToken: !!conn.accessToken,
    }));

    res.json(connectionsWithNames);
  } catch (error) {
    console.error('Error fetching calendar connections:', error);
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
      providerName:
        s.provider === 'google'
          ? 'Google Calendar'
          : s.provider === 'outlook'
          ? 'Microsoft Outlook'
          : s.provider === 'apple'
          ? 'Apple Calendar'
          : s.provider,
    }));

    res.json(statusWithNames);
  } catch (error) {
    console.error('Error fetching sync status:', error);
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

    if (!['google', 'outlook', 'apple'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be google, outlook, or apple' });
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
    console.error('Error connecting calendar:', error);
    res.status(500).json({ error: 'Failed to connect calendar' });
  }
});

// DELETE /api/calendar-sync/disconnect/:provider - Disconnect a calendar
router.delete('/disconnect/:provider', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider } = req.params;

    if (!['google', 'outlook', 'apple'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    await removeCalendarConnection(userId, provider);

    res.json({
      message: `Successfully disconnected from ${provider} calendar`,
    });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
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
    console.error('Error syncing calendars:', error);
    res.status(500).json({ error: 'Failed to sync calendars' });
  }
});

// PATCH /api/calendar-sync/settings/:provider - Update sync settings for a provider
router.patch('/settings/:provider', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider } = req.params;
    const { syncEnabled, calendarId } = req.body;

    if (!['google', 'outlook', 'apple'].includes(provider)) {
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
    console.error('Error updating calendar settings:', error);
    res.status(500).json({ error: 'Failed to update calendar settings' });
  }
});

export default router;
