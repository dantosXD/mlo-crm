import prisma from '../utils/prisma.js';
import { verifyWebhookSignature, fireWebhookTrigger } from './triggerHandler.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { recordWebhookSuccess, recordWebhookFailure } from '../monitoring/metrics.js';
import { getRedisClient } from '../utils/redis.js';

// ---------------------------------------------------------------------------
// Replay cache with bounded size
// ---------------------------------------------------------------------------

const MAX_REPLAY_CACHE_SIZE = 10_000;
const replayCache = new Map<string, number>();

function cleanupReplayCache(now: number) {
  for (const [key, expiresAt] of replayCache.entries()) {
    if (expiresAt <= now) {
      replayCache.delete(key);
    }
  }
  // Hard cap: evict oldest entries if cache exceeds max size
  if (replayCache.size > MAX_REPLAY_CACHE_SIZE) {
    const excess = replayCache.size - MAX_REPLAY_CACHE_SIZE;
    const iter = replayCache.keys();
    for (let i = 0; i < excess; i++) {
      const next = iter.next();
      if (!next.done) replayCache.delete(next.value);
    }
  }
}

async function reserveRedisReplayKey(
  replayKey: string,
  ttlSeconds: number
): Promise<'reserved' | 'replay' | 'unavailable'> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return 'unavailable';
  }

  try {
    const redisKey = `webhook:replay:${replayKey}`;
    const setResult = await redisClient.set(redisKey, '1', {
      EX: ttlSeconds,
      NX: true,
    });
    return setResult === null ? 'replay' : 'reserved';
  } catch (error) {
    logger.error('webhook_replay_redis_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'unavailable';
  }
}

// ---------------------------------------------------------------------------
// Timestamp parsing
// ---------------------------------------------------------------------------

function parseWebhookTimestamp(value: string): number | null {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1e12 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

export class WebhookError {
  constructor(
    public status: number,
    public error: string,
    public message: string,
  ) {}
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export interface WebhookResult {
  success: true;
  message: string;
  workflowId: string;
  timestamp: string;
}

/**
 * Validate and process an incoming webhook request.
 * Throws WebhookError on validation/security failures.
 */
export async function processWebhook(
  workflowId: string,
  payload: string,
  body: Record<string, any>,
  signature: string | undefined,
  timestampHeader: string | undefined,
): Promise<WebhookResult> {
  const env = getEnv();

  // ── Workflow lookup ────────────────────────────────────────────────────
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

  if (!workflow) {
    recordWebhookFailure();
    throw new WebhookError(404, 'Not Found', 'Workflow not found');
  }
  if (!workflow.isActive) {
    recordWebhookFailure();
    throw new WebhookError(400, 'Bad Request', 'Workflow is not active');
  }
  if (workflow.triggerType !== 'WEBHOOK') {
    recordWebhookFailure();
    throw new WebhookError(400, 'Bad Request', 'Workflow is not a webhook trigger');
  }

  // ── Secret check ───────────────────────────────────────────────────────
  const triggerConfig = workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : {};
  const secret = triggerConfig.secret as string | undefined;
  if (!secret) {
    recordWebhookFailure();
    throw new WebhookError(500, 'Misconfigured Webhook', 'Workflow webhook secret is not configured');
  }

  // ── Signature + timestamp required ─────────────────────────────────────
  if (!signature || !timestampHeader) {
    recordWebhookFailure();
    throw new WebhookError(401, 'Unauthorized', 'Both X-Webhook-Signature and X-Webhook-Timestamp headers are required');
  }

  const parsedTimestamp = parseWebhookTimestamp(timestampHeader);
  if (!parsedTimestamp) {
    recordWebhookFailure();
    throw new WebhookError(401, 'Unauthorized', 'Invalid webhook timestamp format');
  }

  // ── Timestamp tolerance ────────────────────────────────────────────────
  const now = Date.now();
  const toleranceMs = env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS * 1000;
  if (Math.abs(now - parsedTimestamp) > toleranceMs) {
    recordWebhookFailure();
    logger.warn('webhook_timestamp_rejected', { workflowId, drift: Math.abs(now - parsedTimestamp) });
    throw new WebhookError(401, 'Unauthorized', 'Webhook timestamp outside tolerance window');
  }

  // ── Replay detection ───────────────────────────────────────────────────
  const replayKey = `${workflowId}:${signature}:${timestampHeader}`;
  // ── Signature verification ─────────────────────────────────────────────
  const signedPayload = `${timestampHeader}.${payload}`;
  if (!verifyWebhookSignature(signedPayload, signature, secret)) {
    recordWebhookFailure();
    logger.warn('webhook_signature_invalid', { workflowId });
    throw new WebhookError(401, 'Unauthorized', 'Invalid webhook signature');
  }

  // Mark as seen via Redis (shared) and fallback to memory when Redis is unavailable.
  const replayState = await reserveRedisReplayKey(replayKey, env.WEBHOOK_REPLAY_TTL_SECONDS);
  if (replayState === 'replay') {
    recordWebhookFailure();
    logger.warn('webhook_replay_detected', { workflowId });
    throw new WebhookError(409, 'Conflict', 'Replay detected for webhook signature');
  }

  if (replayState === 'unavailable') {
    cleanupReplayCache(now);
    if (replayCache.has(replayKey)) {
      recordWebhookFailure();
      logger.warn('webhook_replay_detected', { workflowId });
      throw new WebhookError(409, 'Conflict', 'Replay detected for webhook signature');
    }
    replayCache.set(replayKey, now + env.WEBHOOK_REPLAY_TTL_SECONDS * 1000);
  }

  // ── Extract optional clientId / userId from body ───────────────────────
  let clientId: string | undefined;
  let userId: string | undefined;

  if (body.clientId) clientId = String(body.clientId);
  if (body.userId) userId = String(body.userId);

  // ── Validate clientId if provided ──────────────────────────────────────
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      recordWebhookFailure();
      throw new WebhookError(400, 'Bad Request', 'Client not found');
    }
  }

  // ── Fire workflow ──────────────────────────────────────────────────────
  await fireWebhookTrigger(workflowId, body, clientId, userId);

  recordWebhookSuccess();
  logger.info('webhook_processed', { workflowId, hasClientId: Boolean(clientId), hasUserId: Boolean(userId) });

  return {
    success: true,
    message: 'Webhook received and workflow triggered',
    workflowId,
    timestamp: new Date().toISOString(),
  };
}
