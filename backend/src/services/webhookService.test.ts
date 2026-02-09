import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    workflow: { findUnique: vi.fn() },
    client: { findUnique: vi.fn() },
  },
  fireWebhookTrigger: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  recordWebhookSuccess: vi.fn(),
  recordWebhookFailure: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../utils/prisma.js', () => ({ default: mocks.prisma }));
vi.mock('./triggerHandler.js', () => ({
  fireWebhookTrigger: mocks.fireWebhookTrigger,
  verifyWebhookSignature: mocks.verifyWebhookSignature,
}));
vi.mock('../monitoring/metrics.js', () => ({
  recordWebhookSuccess: mocks.recordWebhookSuccess,
  recordWebhookFailure: mocks.recordWebhookFailure,
}));
vi.mock('../utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../config/env.js', () => ({
  getEnv: () => ({
    WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: 60,
    WEBHOOK_REPLAY_TTL_SECONDS: 120,
  }),
}));

describe('webhookService.processWebhook', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.prisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      isActive: true,
      triggerType: 'WEBHOOK',
      triggerConfig: JSON.stringify({ secret: 'secret-1' }),
      createdById: 'user-1',
    });
    mocks.verifyWebhookSignature.mockReturnValue(true);
    mocks.fireWebhookTrigger.mockResolvedValue(undefined);
  });

  async function getService() {
    return import('./webhookService.js');
  }

  it('succeeds with valid signature and timestamp', async () => {
    const { processWebhook } = await getService();
    const now = String(Date.now());
    const result = await processWebhook('wf-1', '{"event":"ping"}', { event: 'ping' }, 'valid-sig', now);

    expect(result.success).toBe(true);
    expect(result.workflowId).toBe('wf-1');
    expect(mocks.recordWebhookSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.fireWebhookTrigger).toHaveBeenCalledTimes(1);
  });

  it('throws WebhookError for missing workflow', async () => {
    mocks.prisma.workflow.findUnique.mockResolvedValue(null);
    const { processWebhook, WebhookError } = await getService();

    await expect(processWebhook('missing', '{}', {}, 'sig', String(Date.now())))
      .rejects.toBeInstanceOf(WebhookError);
    expect(mocks.recordWebhookFailure).toHaveBeenCalled();
  });

  it('throws WebhookError when signature header is missing', async () => {
    const { processWebhook, WebhookError } = await getService();

    await expect(processWebhook('wf-1', '{}', {}, undefined, String(Date.now())))
      .rejects.toBeInstanceOf(WebhookError);
  });

  it('throws WebhookError when timestamp header is missing', async () => {
    const { processWebhook, WebhookError } = await getService();

    await expect(processWebhook('wf-1', '{}', {}, 'sig', undefined))
      .rejects.toBeInstanceOf(WebhookError);
  });

  it('throws WebhookError for stale timestamp', async () => {
    const { processWebhook, WebhookError } = await getService();
    const stale = String(Date.now() - 5 * 60 * 1000);

    await expect(processWebhook('wf-1', '{}', {}, 'sig', stale))
      .rejects.toBeInstanceOf(WebhookError);
    expect(mocks.verifyWebhookSignature).not.toHaveBeenCalled();
  });

  it('throws WebhookError for invalid signature', async () => {
    mocks.verifyWebhookSignature.mockReturnValue(false);
    const { processWebhook, WebhookError } = await getService();
    const now = String(Date.now());

    await expect(processWebhook('wf-1', '{}', {}, 'bad-sig', now))
      .rejects.toBeInstanceOf(WebhookError);
    expect(mocks.fireWebhookTrigger).not.toHaveBeenCalled();
  });

  it('throws WebhookError for inactive workflow', async () => {
    mocks.prisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1', isActive: false, triggerType: 'WEBHOOK',
      triggerConfig: JSON.stringify({ secret: 's' }),
    });
    const { processWebhook, WebhookError } = await getService();

    await expect(processWebhook('wf-1', '{}', {}, 'sig', String(Date.now())))
      .rejects.toBeInstanceOf(WebhookError);
  });

  it('throws WebhookError for non-webhook trigger type', async () => {
    mocks.prisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1', isActive: true, triggerType: 'CLIENT_CREATED',
      triggerConfig: JSON.stringify({ secret: 's' }),
    });
    const { processWebhook, WebhookError } = await getService();

    await expect(processWebhook('wf-1', '{}', {}, 'sig', String(Date.now())))
      .rejects.toBeInstanceOf(WebhookError);
  });

  it('throws WebhookError when webhook secret is not configured', async () => {
    mocks.prisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1', isActive: true, triggerType: 'WEBHOOK',
      triggerConfig: JSON.stringify({}),
    });
    const { processWebhook, WebhookError } = await getService();

    await expect(processWebhook('wf-1', '{}', {}, 'sig', String(Date.now())))
      .rejects.toBeInstanceOf(WebhookError);
  });
});
