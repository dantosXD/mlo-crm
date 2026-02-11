import prisma from '../utils/prisma.js';

// Types for external calendar connections
interface ExternalCalendarConnection {
  provider: 'google' | 'outlook' | 'apple';
  accessToken: string;
  refreshToken?: string;
  calendarId?: string;
  lastSyncedAt?: Date;
  syncEnabled: boolean;
}

interface SyncEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  externalId?: string;
  externalCalendar?: string;
}

/**
 * Get user's external calendar connections from preferences
 */
async function getUserCalendarConnections(userId: string): Promise<ExternalCalendarConnection[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const preferences = JSON.parse(user.preferences || '{}');
  return preferences.calendarConnections || [];
}

/**
 * Save external calendar connection to user preferences
 */
async function saveCalendarConnection(
  userId: string,
  connection: ExternalCalendarConnection
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const preferences = JSON.parse(user.preferences || '{}');
  if (!preferences.calendarConnections) {
    preferences.calendarConnections = [];
  }

  // Update or add connection
  const existingIndex = preferences.calendarConnections.findIndex(
    (c: ExternalCalendarConnection) => c.provider === connection.provider
  );

  if (existingIndex >= 0) {
    preferences.calendarConnections[existingIndex] = connection;
  } else {
    preferences.calendarConnections.push(connection);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: JSON.stringify(preferences) },
  });
}

/**
 * Remove calendar connection
 */
async function removeCalendarConnection(userId: string, provider: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const preferences = JSON.parse(user.preferences || '{}');
  if (preferences.calendarConnections) {
    preferences.calendarConnections = preferences.calendarConnections.filter(
      (c: ExternalCalendarConnection) => c.provider !== provider
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: JSON.stringify(preferences) },
  });
}

/**
 * Sync events from external calendar to local database
 * This is a placeholder - actual implementation would use provider APIs
 */
async function syncEventsFromExternalCalendar(
  userId: string,
  provider: string,
  connection: ExternalCalendarConnection
): Promise<{
  synced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;

  try {
    // Placeholder: In production, this would:
    // 1. Fetch events from Google Calendar API / Outlook API / CalDAV
    // 2. Compare with existing events by externalId
    // 3. Create or update events in local database
    // 4. Handle deletions and conflict resolution

    // Example Google Calendar fetch (requires googleapis package):
    // const { google } = require('googleapis');
    // const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    // const response = await calendar.events.list({
    //   calendarId: connection.calendarId || 'primary',
    //   timeMin: new Date().toISOString(),
    //   maxResults: 250,
    // });

    // Example Outlook fetch (requires @microsoft/microsoft-graph-client):
    // const Client = require('@microsoft/microsoft-graph-client');
    // const client = Client.init({
    //   authProvider: (done) => done(null, connection.accessToken)
    // });
    // const events = await client.api('/me/events').get();

    // Example CalDAV fetch (requires caldav library):
    // const { DavCalendar } = require('caldav-soap');
    // const calendar = new DavCalendar(connection.calendarUrl, {
    //   username: connection.username,
    //   password: connection.password
    // });

    // For now, simulate sync
    console.log(`[Calendar Sync] Syncing from ${provider} for user ${userId}`);
    console.log(`[Calendar Sync] Connection:`, {
      provider,
      calendarId: connection.calendarId,
      hasAccessToken: !!connection.accessToken,
    });

    // Update lastSyncedAt
    connection.lastSyncedAt = new Date();
    await saveCalendarConnection(userId, connection);

    synced = 0; // Would be actual count in production
  } catch (error: any) {
    errors.push(`Failed to sync from ${provider}: ${error.message}`);
  }

  return { synced, errors };
}

/**
 * Push local events to external calendar
 * This is a placeholder - actual implementation would use provider APIs
 */
async function pushEventsToExternalCalendar(
  userId: string,
  provider: string,
  connection: ExternalCalendarConnection,
  events: any[]
): Promise<{
  pushed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let pushed = 0;

  try {
    // Placeholder: In production, this would:
    // 1. For each event without externalId, create in external calendar
    // 2. For each event with externalId, update in external calendar
    // 3. Store returned externalId and lastSyncedAt
    // 4. Handle rate limiting and batch operations

    console.log(`[Calendar Sync] Pushing ${events.length} events to ${provider} for user ${userId}`);

    pushed = 0; // Would be actual count in production
  } catch (error: any) {
    errors.push(`Failed to push to ${provider}: ${error.message}`);
  }

  return { pushed, errors };
}

/**
 * Detect conflicts between events
 */
function detectConflicts(localEvents: any[], externalEvents: any[]): any[] {
  const conflicts: any[] = [];

  localEvents.forEach((localEvent) => {
    const localStart = new Date(localEvent.startTime);
    const localEnd = localEvent.endTime ? new Date(localEvent.endTime) : localStart;

    externalEvents.forEach((externalEvent) => {
      const externalStart = new Date(externalEvent.startTime);
      const externalEnd = externalEvent.endTime ? new Date(externalEvent.endTime) : externalStart;

      // Check for overlap
      if (
        localStart < externalEnd &&
        localEnd > externalStart
      ) {
        conflicts.push({
          localEvent,
          externalEvent,
          type: 'time_overlap',
        });
      }
    });
  });

  return conflicts;
}

/**
 * Bi-directional sync for a user
 */
async function biDirectionalSync(
  userId: string,
  options?: {
    providers?: string[];
    forceSync?: boolean;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  synced: number;
  pushed: number;
  conflicts: number;
  errors: string[];
}> {
  const connections = await getUserCalendarConnections(userId);

  // Filter by providers if specified
  const connectionsToSync = options?.providers
    ? connections.filter((c) => options.providers!.includes(c.provider))
    : connections;

  // Filter by sync enabled
  const activeConnections = connectionsToSync.filter((c) => c.syncEnabled);

  let totalSynced = 0;
  let totalPushed = 0;
  let totalConflicts = 0;
  const allErrors: string[] = [];

  for (const connection of activeConnections) {
    try {
      // 1. Pull from external calendar
      const { synced, errors: pullErrors } = await syncEventsFromExternalCalendar(
        userId,
        connection.provider,
        connection
      );

      totalSynced += synced;
      allErrors.push(...pullErrors);

      // 2. Push local events to external calendar
      // Get local events that need to be synced
      const localEvents = await prisma.event.findMany({
        where: {
          createdById: userId,
          OR: [
            { externalId: null },
            { lastSyncedAt: null },
            { updatedAt: { gt: connection.lastSyncedAt || new Date(0) } },
          ],
        },
      });

      const { pushed, errors: pushErrors } = await pushEventsToExternalCalendar(
        userId,
        connection.provider,
        connection,
        localEvents
      );

      totalPushed += pushed;
      allErrors.push(...pushErrors);

      // 3. Detect and resolve conflicts
      // In production, would implement conflict resolution UI
      const conflicts = detectConflicts(localEvents, []); // Would use fetched external events
      totalConflicts += conflicts.length;

      if (conflicts.length > 0) {
        allErrors.push(
          `${conflicts.length} conflicts detected for ${connection.provider} calendar`
        );
      }
    } catch (error: any) {
      allErrors.push(
        `Sync failed for ${connection.provider}: ${error.message}`
      );
    }
  }

  return {
    synced: totalSynced,
    pushed: totalPushed,
    conflicts: totalConflicts,
    errors: allErrors,
  };
}

/**
 * Get sync status for all user calendars
 */
async function getSyncStatus(userId: string): Promise<
  Array<{
    provider: string;
    connected: boolean;
    lastSyncedAt?: Date;
    syncEnabled: boolean;
  }>
> {
  const connections = await getUserCalendarConnections(userId);

  return connections.map((connection) => ({
    provider: connection.provider,
    connected: !!connection.accessToken,
    lastSyncedAt: connection.lastSyncedAt,
    syncEnabled: connection.syncEnabled,
  }));
}

export {
  getUserCalendarConnections,
  saveCalendarConnection,
  removeCalendarConnection,
  biDirectionalSync,
  syncEventsFromExternalCalendar,
  pushEventsToExternalCalendar,
  detectConflicts,
  getSyncStatus,
};
