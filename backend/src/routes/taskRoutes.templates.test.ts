import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listTaskTemplates: vi.fn(),
  getTask: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

vi.mock('../middleware/rateLimiter.js', () => ({
  bulkOperationLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/taskService.js', () => ({
  ServiceError: class ServiceError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  listTaskTemplates: mocks.listTaskTemplates,
  getTask: mocks.getTask,
}));

async function createApp() {
  const { default: router } = await import('./taskRoutes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', router);
  return app;
}

describe('taskRoutes templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTaskTemplates.mockResolvedValue([]);
  });

  it('routes GET /templates to listTaskTemplates (not /:id)', async () => {
    const app = await createApp();

    const response = await request(app).get('/api/tasks/templates');

    expect(response.status).toBe(200);
    expect(mocks.listTaskTemplates).toHaveBeenCalledWith('user-1');
    expect(mocks.getTask).not.toHaveBeenCalled();
  });

  it('returns template list payload from service', async () => {
    const app = await createApp();
    mocks.listTaskTemplates.mockResolvedValueOnce([
      { id: 'tpl-system', name: 'System template', isSystem: true },
      { id: 'tpl-personal', name: 'Personal template', isSystem: false },
    ]);

    const response = await request(app).get('/api/tasks/templates');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 'tpl-system', name: 'System template', isSystem: true },
      { id: 'tpl-personal', name: 'Personal template', isSystem: false },
    ]);
  });
});

