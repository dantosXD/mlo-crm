import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import prisma from './utils/prisma.js';
import { installConsoleBridge, logger } from './utils/logger.js';
import { getEnv } from './config/env.js';
import { checkOverdueTasks, checkTaskDueDates } from './services/triggerHandler.js';
import { recordWorkerRun, setWorkerInterval } from './monitoring/metrics.js';
import { getRedisClient } from './utils/redis.js';

config();
installConsoleBridge();
const env = getEnv();
const WORKER_INTERVAL_MS = 60 * 60 * 1000;
const WORKER_LOCK_KEY = 'worker:scheduled-triggers:lock';

let intervalRef: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;
let runInProgress = false;

async function runOnce() {
  const start = Date.now();
  try {
    await checkOverdueTasks();
    await checkTaskDueDates(1);
    recordWorkerRun(Date.now() - start, true);
  } catch (error) {
    recordWorkerRun(Date.now() - start, false);
    throw error;
  }
}

async function acquireWorkerLock(): Promise<{ acquired: boolean; token: string | null }> {
  const redis = getRedisClient();
  if (!redis) {
    return { acquired: true, token: null };
  }

  const token = randomUUID();
  try {
    const result = await redis.set(WORKER_LOCK_KEY, token, {
      NX: true,
      EX: env.WORKER_LOCK_TTL_SECONDS,
    });

    if (result !== 'OK') {
      logger.info('worker_lock_not_acquired', {
        lockKey: WORKER_LOCK_KEY,
      });
      return { acquired: false, token: null };
    }

    return { acquired: true, token };
  } catch (error) {
    logger.error('worker_lock_acquire_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail-open so jobs still run if Redis is temporarily unavailable.
    return { acquired: true, token: null };
  }
}

async function releaseWorkerLock(token: string | null): Promise<void> {
  if (!token) {
    return;
  }

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  const releaseScript =
    'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

  try {
    await redis.eval(releaseScript, {
      keys: [WORKER_LOCK_KEY],
      arguments: [token],
    });
  } catch (error) {
    logger.error('worker_lock_release_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runScheduledChecks(trigger: 'startup' | 'interval') {
  if (runInProgress) {
    logger.warn('worker_run_skipped_local_overlap', { trigger });
    return;
  }

  runInProgress = true;
  const lock = await acquireWorkerLock();

  if (!lock.acquired) {
    runInProgress = false;
    return;
  }

  try {
    await runOnce();
    logger.info('worker_scheduled_check_complete', { trigger });
  } catch (error) {
    logger.error('worker_scheduled_check_failed', {
      trigger,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    runInProgress = false;
    await releaseWorkerLock(lock.token);
  }
}

async function startWorker() {
  logger.info('worker_starting', { environment: env.NODE_ENV });
  setWorkerInterval(WORKER_INTERVAL_MS);

  await runScheduledChecks('startup');
  logger.info('worker_initial_check_complete');

  intervalRef = setInterval(async () => {
    if (shuttingDown) {
      return;
    }
    await runScheduledChecks('interval');
  }, WORKER_INTERVAL_MS);
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('worker_shutdown_started', { signal });
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
  await prisma.$disconnect();
  logger.info('worker_shutdown_complete', { signal });
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void startWorker();
