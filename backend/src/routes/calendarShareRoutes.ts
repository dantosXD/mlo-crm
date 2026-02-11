import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { randomBytes } from 'crypto';
import prisma from '../utils/prisma.js';

const router = Router();

// GET /api/calendar/shares - Get all shares for my calendar (shares I created)
router.get('/shares', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const shares = await prisma.calendarShare.findMany({
      where: {
        ownerId: userId,
        isActive: true
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(shares);
  } catch (error) {
    console.error('Error fetching calendar shares:', error);
    res.status(500).json({ error: 'Failed to fetch calendar shares' });
  }
});

// GET /api/calendar/shared-with-me - Get calendars shared with me
router.get('/shared-with-me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const shares = await prisma.calendarShare.findMany({
      where: {
        sharedWithId: userId,
        isActive: true,
        // Check if not expired
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(shares);
  } catch (error) {
    console.error('Error fetching shared calendars:', error);
    res.status(500).json({ error: 'Failed to fetch shared calendars' });
  }
});

// GET /api/calendar/shares/:id - Get a specific share
router.get('/shares/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const share = await prisma.calendarShare.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          { sharedWithId: userId }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    res.json(share);
  } catch (error) {
    console.error('Error fetching calendar share:', error);
    res.status(500).json({ error: 'Failed to fetch calendar share' });
  }
});

// GET /api/calendar/public/:token - Access shared calendar via public link
router.get('/public/:token', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = (req as any).user.userId;

    const share = await prisma.calendarShare.findUnique({
      where: {
        shareToken: token
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!share || !share.isPublicLink || !share.isActive) {
      return res.status(404).json({ error: 'Invalid or expired share link' });
    }

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    res.json(share);
  } catch (error) {
    console.error('Error accessing public calendar:', error);
    res.status(500).json({ error: 'Failed to access shared calendar' });
  }
});

// GET /api/calendar/:ownerId/events - Get events from a shared calendar
router.get('/:ownerId/events', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const userId = (req as any).user.userId;
    const { startDate, endDate } = req.query;

    // Check if user has access to this calendar
    const share = await prisma.calendarShare.findFirst({
      where: {
        ownerId,
        sharedWithId: userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!share) {
      return res.status(403).json({ error: 'Access denied to this calendar' });
    }

    // Build where clause
    const where: any = {
      createdById: ownerId,
      status: { not: 'CANCELLED' }
    };

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    // Fetch events based on visibility level
    let events;
    if (share.visibilityLevel === 'BUSY_ONLY') {
      // Only return time blocks (no details)
      events = await prisma.event.findMany({
        where,
        select: {
          id: true,
          startTime: true,
          endTime: true,
          allDay: true,
          title: true, // Will be overridden as "Busy"
          eventType: true,
          status: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      // Override titles to "Busy"
      events = events.map(event => ({
        ...event,
        title: 'Busy',
        description: null,
        location: null,
        clientId: null,
        taskId: null
      }));
    } else if (share.visibilityLevel === 'LIMITED_DETAILS') {
      // Return basic info without sensitive data
      events = await prisma.event.findMany({
        where,
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          allDay: true,
          eventType: true,
          status: true,
          location: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });
    } else {
      // FULL_DETAILS - return everything
      events = await prisma.event.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              nameEncrypted: true
            }
          },
          eventAttendees: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });
    }

    // Add share metadata
    res.json({
      events,
      share: {
        id: share.id,
        visibilityLevel: share.visibilityLevel,
        permissionLevel: share.permissionLevel,
        canEdit: share.canEdit,
        color: share.color,
        owner: {
          id: share.ownerId,
          name: share.owner?.name || 'Unknown'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching shared calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch shared calendar events' });
  }
});

// POST /api/calendar/shares - Share calendar with someone
router.post('/shares', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      sharedWithEmail,
      visibilityLevel = 'FULL_DETAILS',
      permissionLevel = 'VIEW_ONLY',
      canEdit = false,
      color,
      expiresAt,
      isPublicLink = false
    } = req.body;

    // Find the user to share with
    const sharedWithUser = await prisma.user.findUnique({
      where: { email: sharedWithEmail }
    });

    if (!sharedWithUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (sharedWithUser.id === userId) {
      return res.status(400).json({ error: 'Cannot share calendar with yourself' });
    }

    // Check if share already exists
    const existingShare = await prisma.calendarShare.findUnique({
      where: {
        ownerId_sharedWithId: {
          ownerId: userId,
          sharedWithId: sharedWithUser.id
        }
      }
    });

    if (existingShare) {
      // Update existing share
      const updated = await prisma.calendarShare.update({
        where: { id: existingShare.id },
        data: {
          visibilityLevel,
          permissionLevel,
          canEdit,
          color,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive: true,
          updatedAt: new Date()
        },
        include: {
          sharedWith: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      return res.json(updated);
    }

    // Generate share token for public links
    let shareToken = null;
    if (isPublicLink) {
      shareToken = randomBytes(32).toString('hex');
    }

    // Create new share
    const share = await prisma.calendarShare.create({
      data: {
        ownerId: userId,
        sharedWithId: sharedWithUser.id,
        visibilityLevel,
        permissionLevel,
        canEdit,
        color,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        shareToken,
        isPublicLink,
        isActive: true
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    res.status(201).json(share);
  } catch (error) {
    console.error('Error creating calendar share:', error);
    res.status(500).json({ error: 'Failed to create calendar share' });
  }
});

// PUT /api/calendar/shares/:id - Update share settings
router.put('/shares/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const {
      visibilityLevel,
      permissionLevel,
      canEdit,
      color,
      expiresAt,
      isActive
    } = req.body;

    // Verify ownership
    const share = await prisma.calendarShare.findFirst({
      where: {
        id,
        ownerId: userId
      }
    });

    if (!share) {
      return res.status(404).json({ error: 'Share not found or access denied' });
    }

    const updated = await prisma.calendarShare.update({
      where: { id },
      data: {
        ...(visibilityLevel && { visibilityLevel }),
        ...(permissionLevel && { permissionLevel }),
        ...(canEdit !== undefined && { canEdit }),
        ...(color !== undefined && { color }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating calendar share:', error);
    res.status(500).json({ error: 'Failed to update calendar share' });
  }
});

// DELETE /api/calendar/shares/:id - Revoke calendar share
router.delete('/shares/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Verify ownership
    const share = await prisma.calendarShare.findFirst({
      where: {
        id,
        ownerId: userId
      }
    });

    if (!share) {
      return res.status(404).json({ error: 'Share not found or access denied' });
    }

    // Soft delete (set isActive to false)
    await prisma.calendarShare.update({
      where: { id },
      data: {
        isActive: false
      }
    });

    res.json({ success: true, message: 'Calendar share revoked' });
  } catch (error) {
    console.error('Error revoking calendar share:', error);
    res.status(500).json({ error: 'Failed to revoke calendar share' });
  }
});

export default router;
