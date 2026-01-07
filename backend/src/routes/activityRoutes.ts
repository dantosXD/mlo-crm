import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/activities - List activities (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, limit = '50' } = req.query;

    const activities = await prisma.activity.findMany({
      where: client_id ? { clientId: client_id as string } : undefined,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      clientId: activity.clientId,
      type: activity.type,
      description: activity.description,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      user: activity.user,
      createdAt: activity.createdAt,
    }));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch activities',
    });
  }
});

// GET /api/activities/recent - Get recent activities across all clients
router.get('/recent', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { limit = '20' } = req.query;

    // Get activities for clients owned by the user
    const activities = await prisma.activity.findMany({
      where: {
        client: {
          createdById: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      include: {
        user: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true },
        },
      },
    });

    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      clientId: activity.clientId,
      type: activity.type,
      description: activity.description,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      user: activity.user,
      createdAt: activity.createdAt,
    }));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch recent activities',
    });
  }
});

export default router;
