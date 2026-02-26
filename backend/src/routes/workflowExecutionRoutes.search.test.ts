import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  workflowExecution: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('../utils/prisma.js', () => ({
  default: prismaMock,
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../utils/clientPiiCodec.js', () => ({
  decodeClientPiiField: (value: string) => value,
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

async function createTestApp() {
  const { default: router } = await import('./workflowExecutionRoutes.js');
  const app = express();
  app.use('/api/workflow-executions', router);
  return app;
}

describe('workflowExecutionRoutes search + pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies search filter to count/findMany and returns empty pagination correctly', async () => {
    prismaMock.workflowExecution.count.mockResolvedValue(0);
    prismaMock.workflowExecution.findMany.mockResolvedValue([]);

    const app = await createTestApp();
    const response = await request(app).get('/api/workflow-executions?page=1&limit=20&search=no-match');

    expect(response.status).toBe(200);
    expect(response.body.executions).toEqual([]);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    expect(prismaMock.workflowExecution.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              id: expect.objectContaining({ contains: 'no-match' }),
            }),
            expect.objectContaining({
              workflow: expect.objectContaining({
                name: expect.objectContaining({ contains: 'no-match' }),
              }),
            }),
          ]),
        }),
      }),
    );
    expect(prismaMock.workflowExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
        skip: 0,
        take: 20,
      }),
    );
  });
});
