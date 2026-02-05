import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/today - Get unified view of tasks, events, and reminders for today
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch tasks due today
    const tasksDueToday = await prisma.task.findMany({
      where: {
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        deletedAt: null,
        client: {
          createdById: userId,
        },
        status: {
          not: 'COMPLETE',
        },
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
        assignedTo: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });

    // Fetch events for today
    const eventsToday = await prisma.event.findMany({
      where: {
        startTime: {
          gte: today,
          lt: tomorrow,
        },
        createdById: userId,
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Fetch reminders due today
    const remindersToday = await prisma.reminder.findMany({
      where: {
        remindAt: {
          gte: today,
          lt: tomorrow,
        },
        userId,
        status: {
          in: ['PENDING', 'SNOOZED'],
        },
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { remindAt: 'asc' },
      ],
    });

    // Fetch overdue items
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: {
          lt: today,
        },
        deletedAt: null,
        client: {
          createdById: userId,
        },
        status: {
          not: 'COMPLETE',
        },
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
      },
      take: 10,
      orderBy: {
        dueDate: 'asc',
      },
    });

    const overdueReminders = await prisma.reminder.findMany({
      where: {
        remindAt: {
          lt: today,
        },
        userId,
        status: {
          in: ['PENDING', 'SNOOZED'],
        },
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
      },
      take: 10,
      orderBy: {
        remindAt: 'asc',
      },
    });

    // Calculate summary statistics
    const summary = {
      tasksDueToday: tasksDueToday.length,
      eventsToday: eventsToday.length,
      remindersToday: remindersToday.length,
      overdueTasks: overdueTasks.length,
      overdueReminders: overdueReminders.length,
      totalPending: tasksDueToday.length + remindersToday.length,
    };

    res.json({
      date: today.toISOString(),
      summary,
      tasks: tasksDueToday,
      events: eventsToday,
      reminders: remindersToday,
      overdue: {
        tasks: overdueTasks,
        reminders: overdueReminders,
      },
    });
  } catch (error) {
    console.error('Error fetching today view:', error);
    res.status(500).json({ error: 'Failed to fetch today view' });
  }
});

export default router;
