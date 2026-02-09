import * as Sentry from '@sentry/node';
import { ErrorRequestHandler, Express } from 'express';
import { getEnv } from '../config/env.js';

let initialized = false;

export function initSentry(_app: Express) {
  const env = getEnv();
  if (!env.SENTRY_DSN || initialized) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
    release: env.SENTRY_RELEASE || undefined,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [Sentry.expressIntegration()],
  });

  initialized = true;
}

export function sentryErrorHandler(): ErrorRequestHandler {
  if (!initialized) {
    return (error, _req, _res, next) => next(error);
  }
  return Sentry.expressErrorHandler();
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    return;
  }
  Sentry.captureException(error, {
    extra: context,
  });
}
