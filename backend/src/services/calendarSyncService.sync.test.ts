import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  calendarConnection: {
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  event: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
};

const decryptMock = vi.fn((value: string) => value);

vi.mock('../utils/prisma.js', () => ({
  default: prismaMock,
}));

vi.mock('../utils/crypto.js', () => ({
  decrypt: decryptMock,
  encrypt: vi.fn((value: string) => value),
}));

vi.mock('../config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: 'unit-test-secret',
    API_URL: 'http://localhost:3002/api',
    CALENDAR_OAUTH_ENABLED: false,
    CALENDAR_OAUTH_TEST_MODE: true,
    CALENDAR_OAUTH_STATE_TTL_SECONDS: 600,
    GOOGLE_OAUTH_CLIENT_ID: '',
    GOOGLE_OAUTH_CLIENT_SECRET: '',
    GOOGLE_OAUTH_REDIRECT_URI: '',
    MICROSOFT_OAUTH_CLIENT_ID: '',
    MICROSOFT_OAUTH_CLIENT_SECRET: '',
    MICROSOFT_OAUTH_REDIRECT_URI: '',
  }),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as any;
}

describe('calendarSyncService.biDirectionalSync multi-provider behavior', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    prismaMock.calendarConnection.count.mockResolvedValue(1);
    prismaMock.calendarConnection.findMany.mockResolvedValue([
      {
        provider: 'google',
        encryptedAccessToken: 'google-access-token',
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        calendarId: 'primary',
        syncEnabled: true,
        lastSyncedAt: null,
        scopes: null,
      },
      {
        provider: 'outlook',
        encryptedAccessToken: 'outlook-access-token',
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        calendarId: 'primary',
        syncEnabled: true,
        lastSyncedAt: null,
        scopes: null,
      },
    ]);

    prismaMock.event.findMany
      .mockResolvedValueOnce([
        {
          id: 'event-1',
          title: 'Unsynced Event',
          description: null,
          startTime: new Date('2026-02-01T10:00:00.000Z'),
          endTime: new Date('2026-02-01T11:00:00.000Z'),
          allDay: false,
          location: null,
          status: 'CONFIRMED',
          externalId: null,
          externalCalendar: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'event-1',
          title: 'Unsynced Event',
          description: null,
          startTime: new Date('2026-02-01T10:00:00.000Z'),
          endTime: new Date('2026-02-01T11:00:00.000Z'),
          allDay: false,
          location: null,
          status: 'CONFIRMED',
          externalId: 'google-created-1',
          externalCalendar: 'google',
        },
      ]);

    prismaMock.event.create.mockResolvedValue(undefined);
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.calendarConnection.updateMany.mockResolvedValue({ count: 1 });

    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || 'GET').toUpperCase();
      if (url.includes('googleapis.com') && method === 'GET') {
        return jsonResponse({ items: [] });
      }
      if (url.includes('googleapis.com') && method === 'POST') {
        return jsonResponse({ id: 'google-created-1' });
      }
      if (url.includes('graph.microsoft.com') && method === 'GET') {
        return jsonResponse({ value: [] });
      }
      if (url.includes('graph.microsoft.com') && method === 'POST') {
        return jsonResponse({ id: 'outlook-created-1' });
      }
      return jsonResponse({}, 404);
    }) as any;
  });

  it('does not repush mapped events to a second provider in the same sync run', async () => {
    const { biDirectionalSync } = await import('./calendarSyncService.js');

    const result = await biDirectionalSync('user-1', {
      providers: ['google', 'outlook'],
    });

    expect(result.pushed).toBe(1);
    expect(prismaMock.event.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.event.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.event.updateMany).toHaveBeenCalledWith({
      where: { id: 'event-1', externalId: null },
      data: expect.objectContaining({
        externalId: 'google-created-1',
        externalCalendar: 'google',
      }),
    });

    const fetchCalls = (globalThis.fetch as any).mock.calls as Array<[string, RequestInit | undefined]>;
    const outlookPostCalls = fetchCalls.filter(([url, init]) =>
      url.includes('graph.microsoft.com') && ((init?.method || 'GET').toUpperCase() === 'POST')
    );
    expect(outlookPostCalls).toHaveLength(0);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
});
