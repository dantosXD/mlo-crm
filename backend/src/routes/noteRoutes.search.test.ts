import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    note: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    noteTemplate: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

vi.mock('../utils/prisma.js', () => ({
  default: mocks.prisma,
}));

vi.mock('../utils/clientPiiCodec.js', () => ({
  decodeClientPiiField: (value: string) => value,
}));

vi.mock('../services/triggerHandler.js', () => ({
  fireNoteCreatedTrigger: vi.fn(),
  fireNoteWithTagTrigger: vi.fn(),
}));

function buildNoteRow(id: string, text: string, clientName: string) {
  const createdAt = new Date('2026-02-20T10:00:00.000Z');
  return {
    id,
    clientId: 'client-1',
    text,
    tags: '[]',
    isPinned: false,
    createdBy: { id: 'user-1', name: 'User One' },
    createdAt,
    updatedAt: createdAt,
    client: { id: 'client-1', nameEncrypted: clientName },
  };
}

async function createApp() {
  const { default: router } = await import('./noteRoutes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/notes', router);
  return app;
}

describe('noteRoutes search behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.note.count.mockResolvedValue(0);
  });

  it('matches exact client name hash search against related client record', async () => {
    mocks.prisma.note.findMany.mockResolvedValue([
      buildNoteRow('note-1', 'Left voicemail for follow-up', 'Alice Johnson'),
    ]);

    const app = await createApp();
    const response = await request(app).get('/api/notes?search=Alice Johnson');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].clientName).toBe('Alice Johnson');
    expect(mocks.prisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { text: { contains: 'alice johnson' } },
            { client: { is: { nameHash: 'alice johnson' } } },
          ]),
        }),
      }),
    );
  });

  it('matches search text against note body content at DB level', async () => {
    mocks.prisma.note.findMany.mockResolvedValue([
      buildNoteRow('note-2', 'Escrow update sent to client', 'Bob Borrower'),
    ]);

    const app = await createApp();
    const response = await request(app).get('/api/notes?search=escrow');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].text).toContain('Escrow update');
    expect(mocks.prisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { text: { contains: 'escrow' } },
            { client: { is: { nameHash: 'escrow' } } },
          ]),
        }),
      }),
    );
  });

  it('returns paginated payload metadata with DB-backed count', async () => {
    mocks.prisma.note.count.mockResolvedValue(2);
    mocks.prisma.note.findMany.mockResolvedValue([
      buildNoteRow('note-3', 'Call summary for Alice Johnson', 'Alice Johnson'),
    ]);

    const app = await createApp();
    const response = await request(app).get('/api/notes?paginated=true&page=2&limit=1&search=Alice Johnson');

    expect(response.status).toBe(200);
    expect(response.body.notes).toHaveLength(1);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(mocks.prisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 1,
      }),
    );
  });
});
