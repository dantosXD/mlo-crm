import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    noteTemplate: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

async function createApp() {
  const { default: router } = await import('./noteRoutes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/notes', router);
  return app;
}

describe('noteRoutes templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.noteTemplate.count.mockResolvedValue(1);
    const now = new Date().toISOString();
    mocks.prisma.noteTemplate.findMany.mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'System Note',
        description: null,
        content: 'Template content',
        tags: '["intro"]',
        isSystem: true,
        createdById: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it('keeps /templates and /templates/list responses in parity', async () => {
    const app = await createApp();

    const templatesResponse = await request(app).get('/api/notes/templates');
    const aliasResponse = await request(app).get('/api/notes/templates/list');

    expect(templatesResponse.status).toBe(200);
    expect(aliasResponse.status).toBe(200);
    expect(templatesResponse.body).toEqual(aliasResponse.body);
    expect(mocks.prisma.noteTemplate.findMany).toHaveBeenCalledTimes(2);
  });

  it('creates a personal template for the authenticated user', async () => {
    const app = await createApp();
    const now = new Date().toISOString();
    mocks.prisma.noteTemplate.create.mockResolvedValue({
      id: 'tpl-created',
      name: 'My Template',
      description: 'Desc',
      content: 'Body',
      tags: '["tag-a","tag-b"]',
      isSystem: false,
      createdById: 'user-1',
      createdAt: now,
      updatedAt: now,
    });

    const response = await request(app).post('/api/notes/templates').send({
      name: 'My Template',
      description: 'Desc',
      content: 'Body',
      tags: ['tag-a', 'tag-b'],
    });

    expect(response.status).toBe(201);
    expect(mocks.prisma.noteTemplate.create).toHaveBeenCalledWith({
      data: {
        name: 'My Template',
        description: 'Desc',
        content: 'Body',
        tags: JSON.stringify(['tag-a', 'tag-b']),
        isSystem: false,
        createdById: 'user-1',
      },
    });
  });

  it('rejects updating a system template', async () => {
    const app = await createApp();
    mocks.prisma.noteTemplate.findUnique.mockResolvedValue({
      id: 'tpl-system',
      isSystem: true,
      createdById: null,
    });

    const response = await request(app).put('/api/notes/templates/tpl-system').send({
      name: 'Edited',
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('read-only');
    expect(mocks.prisma.noteTemplate.update).not.toHaveBeenCalled();
  });

  it('rejects deleting another user personal template', async () => {
    const app = await createApp();
    mocks.prisma.noteTemplate.findUnique.mockResolvedValue({
      id: 'tpl-other',
      isSystem: false,
      createdById: 'user-2',
    });

    const response = await request(app).delete('/api/notes/templates/tpl-other');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('your own templates');
    expect(mocks.prisma.noteTemplate.delete).not.toHaveBeenCalled();
  });
});

