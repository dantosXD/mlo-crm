import { createClient, RedisClientType } from 'redis';
import { getEnv } from '../config/env.js';
import { logger } from './logger.js';

let client: RedisClientType | null = null;
let attemptedInit = false;

export function getRedisClient(): RedisClientType | null {
  if (client || attemptedInit) {
    return client;
  }

  attemptedInit = true;
  const env = getEnv();
  if (!env.REDIS_URL) {
    return null;
  }

  client = createClient({ url: env.REDIS_URL });
  client.on('error', (error) => {
    logger.error('redis_client_error', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  void client.connect().then(() => {
    logger.info('redis_client_connected');
  }).catch((error) => {
    logger.error('redis_client_connect_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return client;
}

export function hasRedisClient(): boolean {
  return Boolean(getRedisClient());
}
