import { getRedisClient } from '../utils/redis.js';

interface MetricsState {
  startedAt: number;
  totalRequests: number;
  total5xx: number;
  authAttempts: number;
  authFailures: number;
  webhookSuccesses: number;
  webhookFailures: number;
  workerRuns: number;
  workerFailures: number;
  workerIntervalMs: number | null;
  lastWorkerRunAtMs: number | null;
  lastWorkerRunDurationMs: number | null;
  lastDbLatencyMs: number | null;
}

const WORKER_METRICS_KEY = 'metrics:worker';

const state: MetricsState = {
  startedAt: Date.now(),
  totalRequests: 0,
  total5xx: 0,
  authAttempts: 0,
  authFailures: 0,
  webhookSuccesses: 0,
  webhookFailures: 0,
  workerRuns: 0,
  workerFailures: 0,
  workerIntervalMs: null,
  lastWorkerRunAtMs: null,
  lastWorkerRunDurationMs: null,
  lastDbLatencyMs: null,
};

function parseNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function persistWorkerMetricsToRedis() {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  await redis.hSet(WORKER_METRICS_KEY, {
    workerRuns: String(state.workerRuns),
    workerFailures: String(state.workerFailures),
    workerIntervalMs: String(state.workerIntervalMs ?? ''),
    lastWorkerRunAtMs: String(state.lastWorkerRunAtMs ?? ''),
    lastWorkerRunDurationMs: String(state.lastWorkerRunDurationMs ?? ''),
    workerUpdatedAtMs: String(Date.now()),
  });
}

export function recordRequest(statusCode: number) {
  state.totalRequests += 1;
  if (statusCode >= 500) {
    state.total5xx += 1;
  }
}

export function recordAuthAttempt(success: boolean) {
  state.authAttempts += 1;
  if (!success) {
    state.authFailures += 1;
  }
}

export function recordWebhookSuccess() {
  state.webhookSuccesses += 1;
}

export function recordWebhookFailure() {
  state.webhookFailures += 1;
}

export function setWorkerInterval(intervalMs: number) {
  state.workerIntervalMs = intervalMs;
  void persistWorkerMetricsToRedis().catch(() => {
    // Best-effort metrics fan-out; keep request path unaffected.
  });
}

export function recordWorkerRun(durationMs: number, success: boolean) {
  state.workerRuns += 1;
  state.lastWorkerRunAtMs = Date.now();
  state.lastWorkerRunDurationMs = durationMs;
  if (!success) {
    state.workerFailures += 1;
  }
  void persistWorkerMetricsToRedis().catch(() => {
    // Best-effort metrics fan-out; keep worker path unaffected.
  });
}

export function recordDbLatency(durationMs: number) {
  state.lastDbLatencyMs = durationMs;
}

export async function getMetricsSnapshot() {
  const redis = getRedisClient();
  let workerRuns = state.workerRuns;
  let workerFailures = state.workerFailures;
  let workerIntervalMs = state.workerIntervalMs;
  let lastWorkerRunAtMs = state.lastWorkerRunAtMs;
  let lastWorkerRunDurationMs = state.lastWorkerRunDurationMs;

  if (redis) {
    const workerMetrics: Record<string, string> = await redis
      .hGetAll(WORKER_METRICS_KEY)
      .catch(() => ({}));
    workerRuns = parseNumber(workerMetrics.workerRuns) ?? workerRuns;
    workerFailures = parseNumber(workerMetrics.workerFailures) ?? workerFailures;
    workerIntervalMs = parseNumber(workerMetrics.workerIntervalMs) ?? workerIntervalMs;
    lastWorkerRunAtMs = parseNumber(workerMetrics.lastWorkerRunAtMs) ?? lastWorkerRunAtMs;
    lastWorkerRunDurationMs =
      parseNumber(workerMetrics.lastWorkerRunDurationMs) ?? lastWorkerRunDurationMs;
  }

  const uptimeSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
  const workerLagMs = workerIntervalMs && lastWorkerRunAtMs
    ? Math.max(0, Date.now() - (lastWorkerRunAtMs + workerIntervalMs))
    : null;

  return {
    uptimeSeconds,
    totalRequests: state.totalRequests,
    total5xx: state.total5xx,
    errorRate5xx: state.totalRequests > 0 ? state.total5xx / state.totalRequests : 0,
    authAttempts: state.authAttempts,
    authFailures: state.authFailures,
    authFailureRate: state.authAttempts > 0 ? state.authFailures / state.authAttempts : 0,
    webhookSuccesses: state.webhookSuccesses,
    webhookFailures: state.webhookFailures,
    workerRuns,
    workerFailures,
    workerFailureRate: workerRuns > 0 ? workerFailures / workerRuns : 0,
    workerIntervalMs,
    lastWorkerRunAtMs: lastWorkerRunAtMs ? new Date(lastWorkerRunAtMs).toISOString() : null,
    workerLagMs,
    lastWorkerRunDurationMs,
    lastDbLatencyMs: state.lastDbLatencyMs,
    timestamp: new Date().toISOString(),
  };
}
