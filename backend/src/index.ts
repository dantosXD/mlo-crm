import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import authRoutes from './routes/authRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import documentPackageRoutes from './routes/documentPackageRoutes.js';
import loanScenarioRoutes from './routes/loanScenarioRoutes.js';
import loanProgramTemplateRoutes from './routes/loanProgramTemplateRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import workflowExecutionRoutes from './routes/workflowExecutionRoutes.js';
import workflowAnalyticsRoutes from './routes/workflowAnalyticsRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import communicationRoutes from './routes/communicationRoutes.js';
import communicationTemplateRoutes from './routes/communicationTemplateRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import unifiedSearchRoutes from './routes/unifiedSearchRoutes.js';
import todayRoutes from './routes/todayRoutes.js';
import calendarSyncRoutes from './routes/calendarSyncRoutes.js';
import calendarShareRoutes from './routes/calendarShareRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import dataLifecycleRoutes from './routes/dataLifecycleRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import { generateCsrfToken, validateCsrfToken } from './middleware/csrf.js';
import { initializeWebSocket } from './services/websocketService.js';
import prisma from './utils/prisma.js';
import { getEnv } from './config/env.js';
import { installConsoleBridge, logger } from './utils/logger.js';
import { requestIdMiddleware, requestLoggingMiddleware } from './middleware/requestLogging.js';
import { checkS3Health } from './utils/s3.js';
import { initSentry, sentryErrorHandler, captureException } from './monitoring/sentry.js';
import { getMetricsSnapshot, recordDbLatency } from './monitoring/metrics.js';
import { getRedisClient } from './utils/redis.js';
import { runWithRequestContext } from './utils/requestContext.js';

installConsoleBridge();
const env = getEnv();
const app = express();
const PORT = env.PORT;

const httpServer = createServer(app);
const io = initializeWebSocket(httpServer);

initSentry(app);

app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);
app.use((req, res, next) => runWithRequestContext({}, () => next()));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isLocalDevOrigin =
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

      const allowedOrigins = [env.FRONTEND_URL].filter(Boolean);
      if (isLocalDevOrigin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['X-CSRF-Token'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(generateCsrfToken);

app.get('/health/live', (_req, res) => {
  res.status(200).json({
    status: 'live',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', async (_req, res) => {
  const dbStart = Date.now();
  const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  recordDbLatency(Date.now() - dbStart);
  const s3Healthy = await checkS3Health();
  let redisHealthy = true;
  if (env.REDIS_URL) {
    const redisClient = getRedisClient();
    redisHealthy = await redisClient?.ping().then(() => true).catch(() => false) ?? false;
  }

  const ready = dbHealthy && s3Healthy && redisHealthy;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    services: {
      database: dbHealthy ? 'ok' : 'error',
      objectStorage: s3Healthy ? 'ok' : 'error',
      redis: !env.REDIS_URL ? 'disabled' : redisHealthy ? 'ok' : 'error',
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/metrics', async (_req, res) => {
  const snapshot = await getMetricsSnapshot();
  res.status(200).json(snapshot);
});

app.get('/api', (_req, res) => {
  res.json({
    message: 'MLO Dashboard API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      health: '/health/live, /health/ready, /api/health/*',
      clients: '/api/clients/*',
      notes: '/api/notes/*',
      tasks: '/api/tasks/*',
      documents: '/api/documents/*',
      loanScenarios: '/api/loan-scenarios/*',
      activities: '/api/activities/*',
      analytics: '/api/analytics/*',
      workflows: '/api/workflows/*',
      communications: '/api/communications/*',
      communicationTemplates: '/api/communication-templates/*',
      events: '/api/events/*',
      calendarSync: '/api/calendar-sync/*',
      dataLifecycle: '/api/data-lifecycle/*',
    },
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', validateCsrfToken, clientRoutes);
app.use('/api/notes', validateCsrfToken, noteRoutes);
app.use('/api/tasks', validateCsrfToken, taskRoutes);
app.use('/api/users', validateCsrfToken, userRoutes);
app.use('/api/documents', validateCsrfToken, documentRoutes);
app.use('/api/document-packages', validateCsrfToken, documentPackageRoutes);
app.use('/api/loan-scenarios', validateCsrfToken, loanScenarioRoutes);
app.use('/api/loan-program-templates', validateCsrfToken, loanProgramTemplateRoutes);
app.use('/api/activities', validateCsrfToken, activityRoutes);
app.use('/api/notifications', validateCsrfToken, notificationRoutes);
app.use('/api/workflows', validateCsrfToken, workflowRoutes);
app.use('/api/workflow-executions', validateCsrfToken, workflowExecutionRoutes);
app.use('/api/communications', validateCsrfToken, communicationRoutes);
app.use('/api/communication-templates', validateCsrfToken, communicationTemplateRoutes);
app.use('/api/attachments', validateCsrfToken, attachmentRoutes);
app.use('/api/events', validateCsrfToken, eventRoutes);
app.use('/api/calendar-sync', validateCsrfToken, calendarSyncRoutes);
app.use('/api/calendar', validateCsrfToken, calendarShareRoutes);
app.use('/api/reminders', validateCsrfToken, reminderRoutes);
app.use('/api/integration', validateCsrfToken, integrationRoutes);
app.use('/api/unified-search', validateCsrfToken, unifiedSearchRoutes);
app.use('/api/today', validateCsrfToken, todayRoutes);
app.use('/api/analytics', validateCsrfToken, workflowAnalyticsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/data-lifecycle', validateCsrfToken, dataLifecycleRoutes);

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

app.use(sentryErrorHandler());
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as express.Request & { requestId?: string }).requestId;
  captureException(err, { requestId, path: req.path, method: req.method });
  logger.error('http_unhandled_error', {
    requestId,
    path: req.path,
    method: req.method,
    error: err.message,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

httpServer.listen(PORT, () => {
  logger.info('api_server_started', {
    port: PORT,
    mode: env.NODE_ENV,
    healthLive: `http://localhost:${PORT}/health/live`,
    healthReady: `http://localhost:${PORT}/health/ready`,
    apiRoot: `http://localhost:${PORT}/api`,
  });
});

let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('api_shutdown_started', { signal });

  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  await io.close();
  await prisma.$disconnect();
  logger.info('api_shutdown_complete', { signal });
  process.exit(0);
}

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

export default app;
