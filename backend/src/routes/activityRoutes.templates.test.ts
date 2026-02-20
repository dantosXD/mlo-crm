import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    client: {
      findUnique: vi.fn(),
    },
    activityTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    activity: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  tx: {
    activity: {
      create: vi.fn(),
    },
    task: {
      create: vi.fn(),
    },
    reminder: {
      create: vi.fn(),
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

async function createApp() {
  const { default: router } = await import('./activityRoutes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/activities', router);
  return app;
}

describe('activityRoutes template and follow-up behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.client.findUnique.mockResolvedValue({ id: 'client-1', createdById: 'user-1' });
    mocks.prisma.$transaction.mockImplementation(async (handler: any) => handler(mocks.tx));
    mocks.tx.activity.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'activity-1',
      clientId: `${data.clientId}`,
      type: `${data.type}`,
      description: `${data.description}`,
      metadata: data.metadata as string | null,
      user: { id: 'user-1', name: 'User One' },
      createdAt: new Date(),
    }));
    mocks.tx.task.create.mockResolvedValue({ id: 'task-1' });
    mocks.tx.reminder.create.mockResolvedValue({ id: 'reminder-1' });
  });

  it('creates and lists templates', async () => {
    const app = await createApp();
    const now = new Date().toISOString();
    mocks.prisma.activityTemplate.create.mockResolvedValue({
      id: 'tpl-1',
      name: 'Activity Template',
      description: 'Default template',
      config: '{"type":"INTERACTION_OTHER"}',
      autoFollowUp: null,
      isSystem: false,
      createdById: 'user-1',
      createdAt: now,
      updatedAt: now,
    });
    mocks.prisma.activityTemplate.findMany.mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'Activity Template',
        description: 'Default template',
        config: '{"type":"INTERACTION_OTHER"}',
        autoFollowUp: null,
        isSystem: false,
        createdById: 'user-1',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const createResponse = await request(app).post('/api/activities/templates').send({
      name: 'Activity Template',
      description: 'Default template',
      config: { type: 'INTERACTION_OTHER' },
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      id: 'tpl-1',
      isSystem: false,
      source: 'PERSONAL',
    });

    const listResponse = await request(app).get('/api/activities/templates');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body[0]).toMatchObject({
      id: 'tpl-1',
      source: 'PERSONAL',
      config: { type: 'INTERACTION_OTHER' },
    });
  });

  it('accepts null autoFollowUp when creating or clearing templates', async () => {
    const app = await createApp();
    const now = new Date().toISOString();

    mocks.prisma.activityTemplate.create.mockResolvedValue({
      id: 'tpl-null',
      name: 'No Follow-up',
      description: null,
      config: '{"type":"INTERACTION_OTHER"}',
      autoFollowUp: null,
      isSystem: false,
      createdById: 'user-1',
      createdAt: now,
      updatedAt: now,
    });
    const createResponse = await request(app).post('/api/activities/templates').send({
      name: 'No Follow-up',
      config: { type: 'INTERACTION_OTHER' },
      autoFollowUp: null,
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.autoFollowUp).toBeNull();

    mocks.prisma.activityTemplate.findUnique.mockResolvedValue({
      id: 'tpl-null',
      isSystem: false,
      createdById: 'user-1',
    });
    mocks.prisma.activityTemplate.update.mockResolvedValue({
      id: 'tpl-null',
      name: 'No Follow-up',
      description: null,
      config: '{"type":"INTERACTION_OTHER"}',
      autoFollowUp: null,
      isSystem: false,
      createdById: 'user-1',
      createdAt: now,
      updatedAt: now,
    });

    const updateResponse = await request(app).put('/api/activities/templates/tpl-null').send({
      autoFollowUp: null,
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.autoFollowUp).toBeNull();
    expect(mocks.prisma.activityTemplate.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ autoFollowUp: null }),
    }));
  });

  it('enforces system immutability and ownership for update/delete', async () => {
    const app = await createApp();

    mocks.prisma.activityTemplate.findUnique.mockResolvedValueOnce({
      id: 'system-tpl',
      isSystem: true,
      createdById: null,
    });
    const updateResponse = await request(app).put('/api/activities/templates/system-tpl').send({
      name: 'Edited',
    });
    expect(updateResponse.status).toBe(403);
    expect(updateResponse.body.message).toContain('read-only');

    mocks.prisma.activityTemplate.findUnique.mockResolvedValueOnce({
      id: 'other-user-tpl',
      isSystem: false,
      createdById: 'user-2',
    });
    const deleteResponse = await request(app).delete('/api/activities/templates/other-user-tpl');
    expect(deleteResponse.status).toBe(403);
    expect(deleteResponse.body.message).toContain('your own templates');
  });

  it('creates activity and follow-up from template defaults', async () => {
    const app = await createApp();
    mocks.prisma.activityTemplate.findUnique.mockResolvedValue({
      id: 'tpl-follow-up',
      isSystem: false,
      createdById: 'user-1',
      config: JSON.stringify({
        type: 'INTERACTION_OTHER',
        description: 'Template description',
      }),
      autoFollowUp: JSON.stringify({
        kind: 'TASK',
        priority: 'HIGH',
        dueOffset: { value: 1, unit: 'days' },
      }),
    });

    const response = await request(app).post('/api/activities').send({
      clientId: 'client-1',
      templateId: 'tpl-follow-up',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      clientId: 'client-1',
      type: 'INTERACTION_OTHER',
      description: 'Template description',
      followUp: { kind: 'TASK', id: 'task-1' },
    });
    expect(mocks.tx.activity.create).toHaveBeenCalled();
    expect(mocks.tx.task.create).toHaveBeenCalled();
  });

  it('returns 400 for invalid follow-up payload and skips writes', async () => {
    const app = await createApp();

    const response = await request(app).post('/api/activities').send({
      clientId: 'client-1',
      type: 'INTERACTION_OTHER',
      description: 'Manual activity',
      followUp: {
        kind: 'TASK',
        dueOffset: {
          value: 1,
          unit: 'weeks',
        },
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('dueOffset.unit');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.activity.create).not.toHaveBeenCalled();
    expect(mocks.tx.task.create).not.toHaveBeenCalled();
  });
});
