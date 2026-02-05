import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reminders - Get all reminders for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status,
      category,
      priority,
      clientId,
      upcoming,
      overdue,
      limit = 50,
      offset = 0,
    } = req.query;

    const where: any = { userId };

    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (clientId) where.clientId = clientId;

    // Upcoming reminders (remindAt in the future)
    if (upcoming === 'true') {
      where.remindAt = { gte: new Date() };
      where.status = { in: ['PENDING', 'SNOOZED'] };
    }

    // Overdue reminders (remindAt in the past and not completed/dismissed)
    if (overdue === 'true') {
      where.remindAt = { lt: new Date() };
      where.status = { in: ['PENDING', 'SNOOZED'] };
    }

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        client: {
          select: { id: true, nameHash: true },
        },
      },
      orderBy: { remindAt: 'asc' },
      take: Number(limit),
      skip: Number(offset),
    });

    // Decrypt client names if present
    const remindersWithDecryptedClients = reminders.map((reminder) => ({
      ...reminder,
      client: reminder.client
        ? {
            ...reminder.client,
            name: reminder.client.nameHash, // In production, use decryption
          }
        : null,
    }));

    res.json(remindersWithDecryptedClients);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// GET /api/reminders/:id - Get a specific reminder
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reminder = await prisma.reminder.findFirst({
      where: { id, userId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        client: {
          select: { id: true, nameHash: true },
        },
      },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    res.json(reminder);
  } catch (error) {
    console.error('Error fetching reminder:', error);
    res.status(500).json({ error: 'Failed to fetch reminder' });
  }
});

// POST /api/reminders - Create a new reminder
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      category = 'GENERAL',
      priority = 'MEDIUM',
      remindAt,
      dueDate,
      clientId,
      isRecurring = false,
      recurringPattern,
      recurringInterval,
      recurringEndDate,
      tags,
      metadata,
    } = req.body;

    // Validation
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!remindAt) {
      return res.status(400).json({ error: 'Remind at date is required' });
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId,
        title,
        description,
        category,
        priority,
        remindAt: new Date(remindAt),
        dueDate: dueDate ? new Date(dueDate) : null,
        clientId: clientId || null,
        isRecurring,
        recurringPattern: isRecurring ? recurringPattern : null,
        recurringInterval: isRecurring ? recurringInterval : null,
        recurringEndDate: isRecurring ? recurringEndDate : null,
        tags: tags ? JSON.stringify(tags) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        client: {
          select: { id: true, nameHash: true },
        },
      },
    });

    // Create notification for the reminder
    await prisma.notification.create({
      data: {
        userId,
        type: 'REMINDER_CREATED',
        title: 'Reminder Created',
        message: `Reminder "${title}" scheduled for ${new Date(remindAt).toLocaleDateString()}`,
        metadata: JSON.stringify({ reminderId: reminder.id }),
      },
    });

    res.status(201).json(reminder);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// PUT /api/reminders/:id - Update a reminder
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      title,
      description,
      category,
      priority,
      remindAt,
      dueDate,
      clientId,
      isRecurring,
      recurringPattern,
      recurringInterval,
      recurringEndDate,
      tags,
      metadata,
    } = req.body;

    // Check ownership
    const existing = await prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        description: description !== undefined ? description : existing.description,
        category: category !== undefined ? category : existing.category,
        priority: priority !== undefined ? priority : existing.priority,
        remindAt: remindAt !== undefined ? new Date(remindAt) : existing.remindAt,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
        clientId: clientId !== undefined ? clientId : existing.clientId,
        isRecurring: isRecurring !== undefined ? isRecurring : existing.isRecurring,
        recurringPattern: recurringPattern !== undefined ? recurringPattern : existing.recurringPattern,
        recurringInterval: recurringInterval !== undefined ? recurringInterval : existing.recurringInterval,
        recurringEndDate: recurringEndDate !== undefined ? recurringEndDate : existing.recurringEndDate,
        tags: tags !== undefined ? (tags ? JSON.stringify(tags) : null) : existing.tags,
        metadata: metadata !== undefined ? (metadata ? JSON.stringify(metadata) : null) : existing.metadata,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        client: {
          select: { id: true, nameHash: true },
        },
      },
    });

    res.json(reminder);
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// POST /api/reminders/:id/complete - Mark reminder as completed
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reminder = await prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // If this is a recurring reminder, create the next occurrence
    if (reminder.isRecurring && reminder.recurringPattern) {
      const nextRemindAt = calculateNextReminderDate(
        reminder.remindAt,
        reminder.recurringPattern,
        reminder.recurringInterval
      );

      // Check if we're still within the recurring end date
      if (
        !reminder.recurringEndDate ||
        nextRemindAt <= reminder.recurringEndDate
      ) {
        await prisma.reminder.create({
          data: {
            userId: reminder.userId,
            clientId: reminder.clientId,
            title: reminder.title,
            description: reminder.description,
            category: reminder.category,
            priority: reminder.priority,
            remindAt: nextRemindAt,
            dueDate:
              reminder.dueDate &&
              new Date(
                new Date(reminder.dueDate).getTime() +
                  (nextRemindAt.getTime() - reminder.remindAt.getTime())
              ),
            isRecurring: true,
            recurringPattern: reminder.recurringPattern,
            recurringInterval: reminder.recurringInterval,
            recurringEndDate: reminder.recurringEndDate,
            recurringReminderId: reminder.id,
            tags: reminder.tags,
            metadata: reminder.metadata,
          },
        });
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error completing reminder:', error);
    res.status(500).json({ error: 'Failed to complete reminder' });
  }
});

// POST /api/reminders/:id/dismiss - Dismiss a reminder
router.post('/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reminder = await prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        dismissedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error dismissing reminder:', error);
    res.status(500).json({ error: 'Failed to dismiss reminder' });
  }
});

// POST /api/reminders/:id/snooze - Snooze a reminder
router.post('/:id/snooze', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { minutes = 15, hours = 0, days = 0 } = req.body;

    const reminder = await prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const snoozeUntil = new Date();
    snoozeUntil.setMinutes(snoozeUntil.getMinutes() + minutes);
    snoozeUntil.setHours(snoozeUntil.getHours() + hours);
    snoozeUntil.setDate(snoozeUntil.getDate() + days);

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        status: 'SNOOZED',
        snoozedUntil,
        snoozeCount: reminder.snoozeCount + 1,
        remindAt: snoozeUntil,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error snoozing reminder:', error);
    res.status(500).json({ error: 'Failed to snooze reminder' });
  }
});

// DELETE /api/reminders/:id - Delete a reminder
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reminder = await prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    await prisma.reminder.delete({
      where: { id },
    });

    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// POST /api/reminders/bulk - Bulk operations on reminders
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { action, reminderIds } = req.body;

    if (!action || !reminderIds || !Array.isArray(reminderIds)) {
      return res.status(400).json({ error: 'Action and reminderIds are required' });
    }

    // Verify all reminders belong to the user
    const reminders = await prisma.reminder.findMany({
      where: {
        id: { in: reminderIds },
        userId,
      },
    });

    if (reminders.length !== reminderIds.length) {
      return res.status(403).json({ error: 'Some reminders not found or access denied' });
    }

    let result;

    switch (action) {
      case 'complete':
        result = await prisma.reminder.updateMany({
          where: { id: { in: reminderIds } },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        break;

      case 'dismiss':
        result = await prisma.reminder.updateMany({
          where: { id: { in: reminderIds } },
          data: {
            status: 'DISMISSED',
            dismissedAt: new Date(),
          },
        });
        break;

      case 'delete':
        result = await prisma.reminder.deleteMany({
          where: { id: { in: reminderIds } },
        });
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({
      message: `Bulk ${action} completed`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// GET /api/reminders/stats/summary - Get reminder statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      total,
      pending,
      overdue,
      completed,
      snoozed,
      byCategory,
      byPriority,
    ] = await Promise.all([
      prisma.reminder.count({ where: { userId } }),
      prisma.reminder.count({ where: { userId, status: 'PENDING' } }),
      prisma.reminder.count({
        where: {
          userId,
          status: { in: ['PENDING', 'SNOOZED'] },
          remindAt: { lt: new Date() },
        },
      }),
      prisma.reminder.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.reminder.count({ where: { userId, status: 'SNOOZED' } }),
      prisma.reminder.groupBy({
        by: ['category'],
        where: { userId, status: { in: ['PENDING', 'SNOOZED'] } },
        _count: true,
      }),
      prisma.reminder.groupBy({
        by: ['priority'],
        where: { userId, status: { in: ['PENDING', 'SNOOZED'] } },
        _count: true,
      }),
    ]);

    res.json({
      total,
      pending,
      overdue,
      completed,
      snoozed,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item.priority] = item._count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Error fetching reminder stats:', error);
    res.status(500).json({ error: 'Failed to fetch reminder stats' });
  }
});

// Helper function to calculate next reminder date
function calculateNextReminderDate(
  fromDate: Date,
  pattern: string,
  interval: number | null
): Date {
  const next = new Date(fromDate);

  switch (pattern) {
    case 'DAILY':
      next.setDate(next.getDate() + (interval || 1));
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7 * (interval || 1));
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + (interval || 1));
      break;
    case 'CUSTOM':
      // For custom patterns, interval is required and represents days
      next.setDate(next.getDate() + (interval || 1));
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

export default router;
