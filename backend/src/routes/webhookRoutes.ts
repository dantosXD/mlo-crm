import { Router, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { processWebhook, WebhookError } from '../services/webhookService.js';
import { recordWebhookFailure } from '../monitoring/metrics.js';
import { logger } from '../utils/logger.js';
import { getRedisClient } from '../utils/redis.js';

const router = Router();
const redisClient = getRedisClient();

// Limit webhook payload to 256 KB to prevent oversized body attacks
const webhookBodyLimit = express.json({ limit: '256kb' });

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
  } : {}),
  message: {
    error: 'Too many requests',
    message: 'Webhook rate limit exceeded',
  },
});

if (!redisClient) {
  logger.warn('webhook_rate_limit_memory_store_fallback');
}

// POST /api/webhooks/:workflow_id - Receive webhook trigger from external systems
// This endpoint does NOT require authentication - it's for external systems
router.post('/:workflow_id', webhookBodyLimit, webhookLimiter, async (req: any, res: Response) => {
  try {
    const { workflow_id } = req.params;
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const timestampHeader = req.headers['x-webhook-timestamp'] as string | undefined;
    const payload = JSON.stringify(req.body);

    const result = await processWebhook(workflow_id, payload, req.body, signature, timestampHeader);
    res.json(result);
  } catch (error) {
    if (error instanceof WebhookError) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }
    recordWebhookFailure();
    logger.error('webhook_processing_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process webhook' });
  }
});

export default router;
