import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    workflow: {
      findUnique: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
  },
  fireWebhookTrigger: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  recordWebhookSuccess: vi.fn(),
  recordWebhookFailure: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../utils/prisma.js', () => ({
  default: mocks.prisma,
}));

vi.mock('../services/triggerHandler.js', () => ({
  fireWebhookTrigger: mocks.fireWebhookTrigger,
  verifyWebhookSignature: mocks.verifyWebhookSignature,
}));

vi.mock('../monitoring/metrics.js', () => ({
  recordWebhookSuccess: mocks.recordWebhookSuccess,
  recordWebhookFailure: mocks.recordWebhookFailure,
}));

vi.mock('../utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../config/env.js', () => ({
  getEnv: () => ({
    WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: 60,
    WEBHOOK_REPLAY_TTL_SECONDS: 120,
  }),
}));

async function createApp() {
  const express = (await import('express')).default;
  const { default: webhookRoutes } = await import('./webhookRoutes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', webhookRoutes);
  return app;
}

describe('webhook route security', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      isActive: true,
      triggerType: 'WEBHOOK',
      triggerConfig: JSON.stringify({ secret: 'secret-1' }),
    });
    mocks.prisma.client.findUnique.mockResolvedValue(null);
    mocks.verifyWebhookSignature.mockReturnValue(true);
    mocks.fireWebhookTrigger.mockResolvedValue(undefined);
  });

  it('rejects requests missing webhook signature/timestamp headers', async () => {
    const app = await createApp();

    const response = await request(app).post('/api/webhooks/wf-1').send({ event: 'ping' });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('X-Webhook-Signature');
  });

  it('rejects requests with stale timestamps', async () => {
    const app = await createApp();
    const staleTimestamp = Date.now() - 5 * 60 * 1000;

    const response = await request(app)
      .post('/api/webhooks/wf-1')
      .set('X-Webhook-Signature', 'sig-stale')
      .set('X-Webhook-Timestamp', String(staleTimestamp))
      .send({ event: 'ping' });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('outside tolerance');
    expect(mocks.verifyWebhookSignature).not.toHaveBeenCalled();
  });

  it('rejects requests with invalid signatures', async () => {
    const app = await createApp();
    mocks.verifyWebhookSignature.mockReturnValue(false);
    const now = Date.now();

    const response = await request(app)
      .post('/api/webhooks/wf-1')
      .set('X-Webhook-Signature', 'bad-signature')
      .set('X-Webhook-Timestamp', String(now))
      .send({ event: 'ping' });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Invalid webhook signature');
    expect(mocks.fireWebhookTrigger).not.toHaveBeenCalled();
  });

  it('rejects replayed webhook payloads with same signature/timestamp', async () => {
    const app = await createApp();
    const now = Date.now();
    const signature = `sig-${now}`;

    const firstResponse = await request(app)
      .post('/api/webhooks/wf-1')
      .set('X-Webhook-Signature', signature)
      .set('X-Webhook-Timestamp', String(now))
      .send({ event: 'ping' });

    const secondResponse = await request(app)
      .post('/api/webhooks/wf-1')
      .set('X-Webhook-Signature', signature)
      .set('X-Webhook-Timestamp', String(now))
      .send({ event: 'ping' });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.message).toContain('Replay detected');
    expect(mocks.fireWebhookTrigger).toHaveBeenCalledTimes(1);
  });

  it('records success metric on valid webhook', async () => {
    const app = await createApp();
    const now = Date.now();

    const response = await request(app)
      .post('/api/webhooks/wf-1')
      .set('X-Webhook-Signature', 'valid-sig')
      .set('X-Webhook-Timestamp', String(now))
      .send({ event: 'ping' });

    expect(response.status).toBe(200);
    expect(mocks.recordWebhookSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.recordWebhookFailure).not.toHaveBeenCalled();
  });

  it('returns 404 for non-existent workflow', async () => {
    mocks.prisma.workflow.findUnique.mockResolvedValue(null);
    const app = await createApp();
    const now = Date.now();

    const response = await request(app)
      .post('/api/webhooks/wf-missing')
      .set('X-Webhook-Signature', 'sig')
      .set('X-Webhook-Timestamp', String(now))
      .send({ event: 'ping' });

    expect(response.status).toBe(404);
    expect(mocks.recordWebhookFailure).toHaveBeenCalled();
  });
});
