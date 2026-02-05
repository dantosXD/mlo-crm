import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/unified-search - Search across tasks, events, and reminders
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { q, type } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchQuery = q.trim();
    if (searchQuery.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const results: any = {
      tasks: [],
      events: [],
      reminders: [],
    };

    // Search tasks
    if (!type || type === 'tasks') {
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { text: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
            { tags: { contains: searchQuery } },
          ],
          deletedAt: null,
          client: {
            createdById: userId,
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
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      results.tasks = tasks;
    }

    // Search events
    if (!type || type === 'events') {
      const events = await prisma.event.findMany({
        where: {
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
            { location: { contains: searchQuery, mode: 'insensitive' } },
          ],
          createdById: userId,
        },
        include: {
          client: {
            select: { id: true, nameEncrypted: true },
          },
        },
        take: 20,
        orderBy: { startTime: 'asc' },
      });
      results.events = events;
    }

    // Search reminders
    if (!type || type === 'reminders') {
      const reminders = await prisma.reminder.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          client: {
            select: { id: true, nameEncrypted: true },
          },
        },
        take: 20,
        orderBy: { remindAt: 'asc' },
      });
      results.reminders = reminders;
    }

    res.json({
      query: searchQuery,
      total: results.tasks.length + results.events.length + results.reminders.length,
      results,
    });
  } catch (error) {
    console.error('Error performing unified search:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

export default router;
