import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

function parseActivityMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// All routes require authentication
router.use(authenticateToken);

// GET /api/activities - List activities (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { client_id, limit = '50' } = req.query;
    const take = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);

    // If client_id is provided, verify user owns the client (data isolation)
    if (client_id) {
      const client = await prisma.client.findUnique({
        where: { id: client_id as string },
        select: { createdById: true },
      });
      if (!client) {
        return res.status(404).json({ error: 'Not Found', message: 'Client not found' });
      }
      if (client.createdById !== userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this client' });
      }
    }

    const activities = await prisma.activity.findMany({
      where: client_id
        ? { clientId: client_id as string }
        : { client: { createdById: userId } },
      orderBy: { createdAt: 'desc' },
      take,
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
      metadata: parseActivityMetadata(activity.metadata),
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
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = '20' } = req.query;
    const take = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 200);

    // Get activities for clients owned by the user
    const activities = await prisma.activity.findMany({
      where: {
        client: {
          createdById: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
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
      metadata: parseActivityMetadata(activity.metadata),
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

// POST /api/activities - Log a manual interaction/activity
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { clientId, type, description, metadata, occurredAt } = req.body;

    if (!clientId || !type || !description) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'clientId, type, and description are required',
      });
    }

    // Validate description length
    if (typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Description must be a non-empty string',
      });
    }
    if (description.length > 2000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Description must be 2000 characters or fewer',
      });
    }

    // Validate metadata size if provided
    if (metadata) {
      const metadataStr = JSON.stringify(metadata);
      if (metadataStr.length > 5000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Metadata is too large',
        });
      }
    }

    // Validate the activity type is an interaction type
    const validInteractionTypes = [
      'CALL_PLACED', 'CALL_RECEIVED',
      'EMAIL_SENT', 'EMAIL_RECEIVED',
      'MEETING', 'TEXT_SENT', 'TEXT_RECEIVED',
      'INTERACTION_OTHER',
    ];

    if (!validInteractionTypes.includes(type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid interaction type. Must be one of: ${validInteractionTypes.join(', ')}`,
      });
    }

    // Validate occurredAt is not in the future
    if (occurredAt) {
      const parsedDate = new Date(occurredAt);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'occurredAt must be a valid date',
        });
      }
      if (parsedDate.getTime() > Date.now() + 60000) { // 1 min tolerance for clock skew
        return res.status(400).json({
          error: 'Bad Request',
          message: 'occurredAt cannot be in the future',
        });
      }
    }

    // Verify client exists and user owns it (data isolation)
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Not Found', message: 'Client not found' });
    }
    if (client.createdById !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this client',
      });
    }

    const sanitizedDescription = description.trim();

    const activity = await prisma.activity.create({
      data: {
        clientId,
        userId,
        type,
        description: sanitizedDescription,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        ...(occurredAt ? { createdAt: new Date(occurredAt) } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({
      id: activity.id,
      clientId: activity.clientId,
      type: activity.type,
      description: activity.description,
      metadata: parseActivityMetadata(activity.metadata),
      user: activity.user,
      createdAt: activity.createdAt,
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create activity',
    });
  }
});

export default router;
