import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

const env = getEnv();

export type SupportedProvider = 'google' | 'outlook' | 'apple';
type OAuthProvider = 'google' | 'outlook';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar';
const MICROSOFT_SCOPE = 'offline_access Calendars.ReadWrite User.Read';
const OAUTH_STATE_SIGNING_SECRET = env.JWT_SECRET;

interface ExternalCalendarConnection {
  provider: SupportedProvider;
  accessToken: string;
  refreshToken?: string;
  calendarId?: string;
  tokenExpiresAt?: Date;
  lastSyncedAt?: Date;
  syncEnabled: boolean;
  scopes?: string[];
}

interface SyncRange {
  startDate: Date;
  endDate: Date;
}

interface ExternalSyncEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  allDay: boolean;
  location?: string;
  status?: string;
}

interface OAuthStatePayload {
  userId: string;
  provider: OAuthProvider;
  nonce: string;
  issuedAt: number;
  codeVerifier: string;
}

interface OAuthProviderConfig {
  provider: OAuthProvider;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface SyncOptions {
  providers?: SupportedProvider[];
  forceSync?: boolean;
  startDate?: Date;
  endDate?: Date;
}

type ProviderAdapter = {
  listExternalEvents: (connection: ExternalCalendarConnection, range: SyncRange) => Promise<ExternalSyncEvent[]>;
  createExternalEvent: (connection: ExternalCalendarConnection, event: any) => Promise<{ externalId?: string }>;
};

function parseUserPreferences(preferences: string | null): any {
  if (!preferences) {
    return {};
  }
  try {
    return JSON.parse(preferences);
  } catch {
    return {};
  }
}

function parseScopes(scopesRaw: string | undefined): string[] {
  if (!scopesRaw) {
    return [];
  }
  return scopesRaw
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getDefaultSyncRange(options?: { startDate?: Date; endDate?: Date }): SyncRange {
  const startDate = options?.startDate ? new Date(options.startDate) : new Date();
  startDate.setDate(startDate.getDate() - 30);

  const endDate = options?.endDate ? new Date(options.endDate) : new Date();
  endDate.setDate(endDate.getDate() + 365);

  return { startDate, endDate };
}

function safeDate(dateLike: unknown): Date | undefined {
  if (!dateLike) {
    return undefined;
  }
  const d = new Date(String(dateLike));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (normalized.length % 4 || 4)) % 4;
  return Buffer.from(`${normalized}${'='.repeat(pad)}`, 'base64').toString('utf8');
}

function signState(payloadEncoded: string): string {
  return crypto.createHmac('sha256', OAUTH_STATE_SIGNING_SECRET).update(payloadEncoded).digest('hex');
}

function createSignedOAuthState(payload: OAuthStatePayload): string {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signState(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSignedOAuthState(state: string): OAuthStatePayload {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid OAuth state format');
  }

  const expectedSignature = signState(encodedPayload);
  if (expectedSignature !== signature) {
    throw new Error('Invalid OAuth state signature');
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as OAuthStatePayload;
  const ageSeconds = Math.floor((Date.now() - payload.issuedAt) / 1000);
  if (ageSeconds > env.CALENDAR_OAUTH_STATE_TTL_SECONDS) {
    throw new Error('OAuth state expired');
  }
  return payload;
}

function getProviderConfig(provider: OAuthProvider, requestBaseUrl: string): OAuthProviderConfig {
  if (provider === 'google') {
    return {
      provider,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI || `${requestBaseUrl}/api/calendar-sync/oauth/google/callback`,
      scope: GOOGLE_SCOPE,
    };
  }

  return {
    provider,
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: env.MICROSOFT_OAUTH_CLIENT_ID,
    clientSecret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
    redirectUri: env.MICROSOFT_OAUTH_REDIRECT_URI || `${requestBaseUrl}/api/calendar-sync/oauth/outlook/callback`,
    scope: MICROSOFT_SCOPE,
  };
}

function ensureOAuthConfigured(provider: OAuthProvider, requestBaseUrl: string): OAuthProviderConfig {
  if (!env.CALENDAR_OAUTH_ENABLED && !env.CALENDAR_OAUTH_TEST_MODE) {
    throw new Error('Calendar OAuth is disabled');
  }

  const config = getProviderConfig(provider, requestBaseUrl);
  if (env.CALENDAR_OAUTH_TEST_MODE) {
    return config;
  }

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error(`Missing OAuth configuration for ${provider}`);
  }

  return config;
}

function parseExpiry(expiresInSeconds: unknown): Date | undefined {
  const seconds = Number(expiresInSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  return new Date(Date.now() + seconds * 1000);
}

function mapDbConnection(record: any): ExternalCalendarConnection {
  let scopes: string[] | undefined;
  if (record.scopes) {
    try {
      scopes = JSON.parse(record.scopes);
    } catch {
      scopes = [];
    }
  }

  return {
    provider: record.provider as SupportedProvider,
    accessToken: decrypt(record.encryptedAccessToken),
    refreshToken: record.encryptedRefreshToken ? decrypt(record.encryptedRefreshToken) : undefined,
    calendarId: record.calendarId || undefined,
    tokenExpiresAt: record.tokenExpiresAt || undefined,
    lastSyncedAt: record.lastSyncedAt || undefined,
    syncEnabled: !!record.syncEnabled,
    scopes,
  };
}

async function readConnectionRecord(userId: string, provider: SupportedProvider): Promise<any | null> {
  return prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });
}

async function migrateLegacyConnections(userId: string): Promise<void> {
  const alreadyMigrated = await prisma.calendarConnection.count({
    where: { userId },
  });
  if (alreadyMigrated > 0) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  if (!user?.preferences) {
    return;
  }

  const preferences = parseUserPreferences(user.preferences);
  const legacyConnections = Array.isArray(preferences.calendarConnections)
    ? preferences.calendarConnections
    : [];
  if (legacyConnections.length === 0) {
    return;
  }

  for (const legacyConnection of legacyConnections) {
    if (!legacyConnection?.provider || !legacyConnection?.accessToken) {
      continue;
    }

    const provider = legacyConnection.provider as SupportedProvider;
    if (!['google', 'outlook', 'apple'].includes(provider)) {
      continue;
    }

    await prisma.calendarConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      create: {
        userId,
        provider,
        encryptedAccessToken: encrypt(String(legacyConnection.accessToken)),
        encryptedRefreshToken: legacyConnection.refreshToken ? encrypt(String(legacyConnection.refreshToken)) : null,
        calendarId: legacyConnection.calendarId ? String(legacyConnection.calendarId) : null,
        syncEnabled: legacyConnection.syncEnabled === undefined ? true : !!legacyConnection.syncEnabled,
        lastSyncedAt: safeDate(legacyConnection.lastSyncedAt) || null,
      },
      update: {
        encryptedAccessToken: encrypt(String(legacyConnection.accessToken)),
        encryptedRefreshToken: legacyConnection.refreshToken ? encrypt(String(legacyConnection.refreshToken)) : null,
        calendarId: legacyConnection.calendarId ? String(legacyConnection.calendarId) : null,
        syncEnabled: legacyConnection.syncEnabled === undefined ? true : !!legacyConnection.syncEnabled,
        lastSyncedAt: safeDate(legacyConnection.lastSyncedAt) || null,
      },
    });
  }

  delete preferences.calendarConnections;
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: JSON.stringify(preferences) },
  });
}

export async function saveCalendarConnection(
  userId: string,
  connection: {
    provider: SupportedProvider;
    accessToken: string;
    refreshToken?: string;
    calendarId?: string;
    syncEnabled?: boolean;
    lastSyncedAt?: Date;
    tokenExpiresAt?: Date;
    scopes?: string[];
  }
): Promise<void> {
  await prisma.calendarConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider: connection.provider,
      },
    },
    create: {
      userId,
      provider: connection.provider,
      encryptedAccessToken: encrypt(connection.accessToken),
      encryptedRefreshToken: connection.refreshToken ? encrypt(connection.refreshToken) : null,
      tokenExpiresAt: connection.tokenExpiresAt || null,
      calendarId: connection.calendarId || null,
      syncEnabled: connection.syncEnabled ?? true,
      lastSyncedAt: connection.lastSyncedAt || null,
      scopes: connection.scopes ? JSON.stringify(connection.scopes) : null,
    },
    update: {
      encryptedAccessToken: encrypt(connection.accessToken),
      encryptedRefreshToken: connection.refreshToken ? encrypt(connection.refreshToken) : null,
      tokenExpiresAt: connection.tokenExpiresAt || null,
      calendarId: connection.calendarId || null,
      syncEnabled: connection.syncEnabled ?? true,
      lastSyncedAt: connection.lastSyncedAt || null,
      scopes: connection.scopes ? JSON.stringify(connection.scopes) : null,
    },
  });
}

export async function getUserCalendarConnections(userId: string): Promise<ExternalCalendarConnection[]> {
  await migrateLegacyConnections(userId);
  const rows = await prisma.calendarConnection.findMany({
    where: { userId },
  });
  return rows.map(mapDbConnection);
}

export async function removeCalendarConnection(userId: string, provider: string): Promise<void> {
  await prisma.calendarConnection.deleteMany({
    where: {
      userId,
      provider,
    },
  });
}

export async function getSyncStatus(
  userId: string
): Promise<Array<{ provider: string; connected: boolean; lastSyncedAt?: Date; syncEnabled: boolean; tokenExpiresAt?: Date }>> {
  await migrateLegacyConnections(userId);
  const rows = await prisma.calendarConnection.findMany({
    where: { userId },
  });

  return rows.map((row) => ({
    provider: row.provider,
    connected: !!row.encryptedAccessToken,
    lastSyncedAt: row.lastSyncedAt || undefined,
    syncEnabled: !!row.syncEnabled,
    tokenExpiresAt: row.tokenExpiresAt || undefined,
  }));
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(48).toString('base64url');
}

function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

async function tokenRequest(url: string, params: URLSearchParams): Promise<OAuthTokenResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Token exchange failed with status ${response.status}`);
  }
  if (!payload.access_token) {
    throw new Error('Token exchange did not return access token');
  }
  return payload as OAuthTokenResponse;
}

export async function buildOAuthAuthorizationUrl(
  userId: string,
  provider: OAuthProvider,
  requestBaseUrl: string,
  options?: { mock?: boolean }
): Promise<{ authUrl: string; state: string }> {
  const config = ensureOAuthConfigured(provider, requestBaseUrl);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = createSignedOAuthState({
    userId,
    provider,
    nonce: crypto.randomBytes(12).toString('hex'),
    issuedAt: Date.now(),
    codeVerifier,
  });

  if (options?.mock && env.NODE_ENV !== 'production') {
    const mockUrl = new URL(config.redirectUri);
    mockUrl.searchParams.set('code', 'mock-auth-code');
    mockUrl.searchParams.set('state', state);
    return { authUrl: mockUrl.toString(), state };
  }

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  if (provider === 'google') {
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'true');
  }

  return { authUrl: authUrl.toString(), state };
}

export async function refreshProviderAccessToken(
  userId: string,
  provider: OAuthProvider,
  requestBaseUrl: string
): Promise<ExternalCalendarConnection> {
  const config = ensureOAuthConfigured(provider, requestBaseUrl);
  const connectionRecord = await readConnectionRecord(userId, provider);
  if (!connectionRecord) {
    throw new Error(`No calendar connection found for ${provider}`);
  }

  const connection = mapDbConnection(connectionRecord);
  if (!connection.refreshToken) {
    throw new Error(`No refresh token available for ${provider}`);
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: connection.refreshToken,
  });

  if (provider === 'outlook') {
    params.set('redirect_uri', config.redirectUri);
    params.set('scope', config.scope);
  }

  const tokenPayload = await tokenRequest(config.tokenUrl, params);

  await saveCalendarConnection(userId, {
    provider,
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || connection.refreshToken,
    tokenExpiresAt: parseExpiry(tokenPayload.expires_in),
    calendarId: connection.calendarId,
    syncEnabled: connection.syncEnabled,
    lastSyncedAt: connection.lastSyncedAt,
    scopes: parseScopes(tokenPayload.scope),
  });

  const refreshed = await readConnectionRecord(userId, provider);
  if (!refreshed) {
    throw new Error(`Failed to persist refreshed ${provider} token`);
  }
  return mapDbConnection(refreshed);
}

export async function handleOAuthCallback(
  provider: OAuthProvider,
  code: string,
  state: string,
  requestBaseUrl: string
): Promise<{ userId: string; provider: string }> {
  if (!code) {
    throw new Error('Missing OAuth authorization code');
  }
  if (!state) {
    throw new Error('Missing OAuth state');
  }

  const parsedState = parseSignedOAuthState(state);
  if (parsedState.provider !== provider) {
    throw new Error('OAuth provider mismatch');
  }

  const userId = parsedState.userId;
  const isMock = code === 'mock-auth-code' && env.NODE_ENV !== 'production';
  if (isMock) {
    await saveCalendarConnection(userId, {
      provider,
      accessToken: `mock-access-token-${provider}`,
      refreshToken: `mock-refresh-token-${provider}`,
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      syncEnabled: true,
      scopes: provider === 'google' ? [GOOGLE_SCOPE] : parseScopes(MICROSOFT_SCOPE),
    });
    return { userId, provider };
  }

  const config = ensureOAuthConfigured(provider, requestBaseUrl);
  const tokenParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: parsedState.codeVerifier,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  if (provider === 'outlook') {
    tokenParams.set('scope', config.scope);
  }

  const tokenPayload = await tokenRequest(config.tokenUrl, tokenParams);

  await saveCalendarConnection(userId, {
    provider,
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    tokenExpiresAt: parseExpiry(tokenPayload.expires_in),
    syncEnabled: true,
    scopes: parseScopes(tokenPayload.scope),
  });

  return { userId, provider };
}

async function providerRequest(url: string, accessToken: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`HTTP ${response.status}: ${body || 'request failed'}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function toGooglePayload(event: any): any {
  if (event.allDay) {
    return {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      start: { date: new Date(event.startTime).toISOString().slice(0, 10) },
      end: { date: new Date(event.endTime || event.startTime).toISOString().slice(0, 10) },
      status: (event.status || 'CONFIRMED').toLowerCase(),
    };
  }

  return {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    start: { dateTime: new Date(event.startTime).toISOString() },
    end: { dateTime: new Date(event.endTime || event.startTime).toISOString() },
    status: (event.status || 'CONFIRMED').toLowerCase(),
  };
}

function fromGoogleEvent(event: any): ExternalSyncEvent | null {
  const startValue = event?.start?.dateTime || event?.start?.date;
  if (!event?.id || !startValue) {
    return null;
  }

  const startTime = safeDate(startValue);
  const endTime = safeDate(event?.end?.dateTime || event?.end?.date);
  if (!startTime) {
    return null;
  }

  return {
    id: String(event.id),
    title: String(event.summary || 'Untitled event'),
    description: event.description ? String(event.description) : undefined,
    startTime,
    endTime,
    allDay: !event?.start?.dateTime,
    location: event.location ? String(event.location) : undefined,
    status: event.status ? String(event.status).toUpperCase() : undefined,
  };
}

function toOutlookPayload(event: any): any {
  const start = new Date(event.startTime).toISOString();
  const end = new Date(event.endTime || event.startTime).toISOString();
  return {
    subject: event.title,
    body: {
      contentType: 'text',
      content: event.description || '',
    },
    start: {
      dateTime: start,
      timeZone: 'UTC',
    },
    end: {
      dateTime: end,
      timeZone: 'UTC',
    },
    location: event.location ? { displayName: event.location } : undefined,
    isAllDay: !!event.allDay,
  };
}

function fromOutlookEvent(event: any): ExternalSyncEvent | null {
  if (!event?.id || !event?.start?.dateTime) {
    return null;
  }

  const startTime = safeDate(event.start.dateTime);
  const endTime = safeDate(event.end?.dateTime);
  if (!startTime) {
    return null;
  }

  return {
    id: String(event.id),
    title: String(event.subject || 'Untitled event'),
    description: event.bodyPreview ? String(event.bodyPreview) : undefined,
    startTime,
    endTime,
    allDay: !!event.isAllDay,
    location: event.location?.displayName ? String(event.location.displayName) : undefined,
    status: event.showAs ? String(event.showAs).toUpperCase() : undefined,
  };
}

const adapters: Record<SupportedProvider, ProviderAdapter> = {
  google: {
    async listExternalEvents(connection, range) {
      const calendarId = encodeURIComponent(connection.calendarId || 'primary');
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
      url.searchParams.set('timeMin', range.startDate.toISOString());
      url.searchParams.set('timeMax', range.endDate.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('maxResults', '250');

      const response = await providerRequest(url.toString(), connection.accessToken);
      const events = Array.isArray(response.items) ? response.items : [];
      return events.map(fromGoogleEvent).filter(Boolean) as ExternalSyncEvent[];
    },
    async createExternalEvent(connection, event) {
      const calendarId = encodeURIComponent(connection.calendarId || 'primary');
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
      const payload = toGooglePayload(event);
      const created = await providerRequest(url, connection.accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { externalId: created?.id ? String(created.id) : undefined };
    },
  },
  outlook: {
    async listExternalEvents(connection, range) {
      const calendarId = encodeURIComponent(connection.calendarId || 'primary');
      const base = calendarId === 'primary'
        ? 'https://graph.microsoft.com/v1.0/me/calendar/events'
        : `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
      const url = new URL(base);
      url.searchParams.set(
        '$filter',
        `start/dateTime ge '${range.startDate.toISOString()}' and end/dateTime le '${range.endDate.toISOString()}'`
      );
      url.searchParams.set('$top', '200');

      const response = await providerRequest(url.toString(), connection.accessToken);
      const events = Array.isArray(response.value) ? response.value : [];
      return events.map(fromOutlookEvent).filter(Boolean) as ExternalSyncEvent[];
    },
    async createExternalEvent(connection, event) {
      const calendarId = encodeURIComponent(connection.calendarId || 'primary');
      const url = calendarId === 'primary'
        ? 'https://graph.microsoft.com/v1.0/me/calendar/events'
        : `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
      const payload = toOutlookPayload(event);
      const created = await providerRequest(url, connection.accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { externalId: created?.id ? String(created.id) : undefined };
    },
  },
  apple: {
    async listExternalEvents() {
      return [];
    },
    async createExternalEvent() {
      return {};
    },
  },
};

async function getActiveConnections(userId: string, providers?: SupportedProvider[]): Promise<ExternalCalendarConnection[]> {
  const connections = await getUserCalendarConnections(userId);
  const allowed = providers && providers.length > 0 ? new Set(providers) : null;

  return connections.filter((connection) => {
    if (!connection.syncEnabled) {
      return false;
    }
    if (allowed && !allowed.has(connection.provider)) {
      return false;
    }
    return true;
  });
}

async function refreshIfExpired(
  userId: string,
  connection: ExternalCalendarConnection,
  requestBaseUrl: string
): Promise<ExternalCalendarConnection> {
  if (connection.provider !== 'google' && connection.provider !== 'outlook') {
    return connection;
  }

  if (!connection.tokenExpiresAt) {
    return connection;
  }

  const expiryMs = connection.tokenExpiresAt.getTime();
  const now = Date.now();
  const refreshThresholdMs = 90 * 1000;
  if (expiryMs > now + refreshThresholdMs) {
    return connection;
  }

  try {
    return await refreshProviderAccessToken(userId, connection.provider, requestBaseUrl);
  } catch (error) {
    logger.warn('calendar_sync_refresh_failed', {
      userId,
      provider: connection.provider,
      error: error instanceof Error ? error.message : String(error),
    });
    await removeCalendarConnection(userId, connection.provider);
    throw new Error(`Refresh token invalid for ${connection.provider}; reconnect required`);
  }
}

export async function biDirectionalSync(
  userId: string,
  options: SyncOptions = {}
): Promise<{ synced: number; pushed: number; conflicts: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;
  let pushed = 0;
  let conflicts = 0;

  const range = getDefaultSyncRange({
    startDate: options.startDate,
    endDate: options.endDate,
  });

  const requestBaseUrl = env.API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3002';
  const connections = await getActiveConnections(userId, options.providers);
  if (connections.length === 0) {
    return { synced, pushed, conflicts, errors };
  }

  for (const conn of connections) {
    const adapter = adapters[conn.provider];
    if (!adapter) {
      errors.push(`Unsupported provider ${conn.provider}`);
      continue;
    }

    try {
      const localEvents = await prisma.event.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
          startTime: { gte: range.startDate, lte: range.endDate },
        },
        orderBy: { startTime: 'asc' },
      });

      const connection = await refreshIfExpired(userId, conn, requestBaseUrl);
      const externalEvents = await adapter.listExternalEvents(connection, range);
      const existingByExternalId = new Map(
        localEvents
          .filter((event) => event.externalId && event.externalCalendar === conn.provider)
          .map((event) => [event.externalId as string, event])
      );

      for (const externalEvent of externalEvents) {
        const existing = existingByExternalId.get(externalEvent.id);
        if (existing) {
          continue;
        }

        await prisma.event.create({
          data: {
            title: externalEvent.title,
            description: externalEvent.description || null,
            eventType: 'MEETING',
            startTime: externalEvent.startTime,
            endTime: externalEvent.endTime || null,
            allDay: externalEvent.allDay,
            location: externalEvent.location || null,
            status: externalEvent.status || 'CONFIRMED',
            createdById: userId,
            externalId: externalEvent.id,
            externalCalendar: conn.provider,
            lastSyncedAt: new Date(),
          },
        });
        synced += 1;
      }

      const toPush = localEvents.filter((event) => !event.externalId);
      for (const localEvent of toPush) {
        try {
          const created = await adapter.createExternalEvent(connection, localEvent);
          if (created.externalId) {
            const updateResult = await prisma.event.updateMany({
              where: { id: localEvent.id, externalId: null },
              data: {
                externalId: created.externalId,
                externalCalendar: conn.provider,
                lastSyncedAt: new Date(),
              },
            });
            if (updateResult.count === 0) {
              conflicts += 1;
            }
          } else {
            conflicts += 1;
          }
          pushed += 1;
        } catch (error) {
          errors.push(
            `Failed to push event "${localEvent.title}" to ${conn.provider}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      await prisma.calendarConnection.updateMany({
        where: { userId, provider: conn.provider },
        data: { lastSyncedAt: new Date() },
      });
    } catch (error) {
      errors.push(`Failed syncing ${conn.provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { synced, pushed, conflicts, errors };
}
