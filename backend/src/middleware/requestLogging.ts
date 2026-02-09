import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { recordRequest } from '../monitoring/metrics.js';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const requestIdString = Array.isArray(requestId) ? requestId[0] : String(requestId);
  (req as Request & { requestId?: string }).requestId = requestIdString;
  res.setHeader('X-Request-Id', requestIdString);
  next();
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const requestId = (req as Request & { requestId?: string }).requestId;

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    recordRequest(res.statusCode);
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
  });

  next();
}
