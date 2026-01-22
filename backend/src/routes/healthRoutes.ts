import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * Comprehensive API Health Check Endpoint
 * GET /api/health
 *
 * Checks:
 * - API status
 * - Database connectivity
 * - Service dependencies
 * - System information
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    responseTime: 0,
    services: {
      database: {
        status: 'unknown',
        message: '',
        responseTime: 0,
      },
      api: {
        status: 'ok',
        message: 'API is running',
        version: '1.0.0',
      },
    },
    environment: process.env.NODE_ENV || 'development',
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        total: process.memoryUsage().heapTotal / 1024 / 1024, // MB
      },
    },
  } as any;

  // Check database connectivity
  const dbStartTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbTime = Date.now() - dbStartTime;

    healthStatus.services.database = {
      status: 'ok',
      message: 'Database connection successful',
      responseTime: dbTime,
    };
  } catch (error) {
    healthStatus.status = 'degraded';
    healthStatus.services.database = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown database error',
      responseTime: Date.now() - dbStartTime,
    };
  }

  // Calculate overall response time
  healthStatus.responseTime = Date.now() - startTime;

  // Determine overall health status
  const allServicesOk = Object.values(healthStatus.services).every(
    (service: any) => service.status === 'ok'
  );

  if (allServicesOk) {
    healthStatus.status = 'healthy';
    return res.status(200).json(healthStatus);
  } else {
    healthStatus.status = 'degraded';
    return res.status(503).json(healthStatus);
  }
});

/**
 * Simple health check endpoint (for load balancers)
 * GET /api/health/simple
 */
router.get('/simple', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
