import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import { decrypt } from '../utils/crypto.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/integration/today - Get unified today view data
router.get('/today', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch tasks due today
    const tasksDueToday = await prisma.task.findMany({
      where: {
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
        dueDate: {
          gte: today.toISOString(),
          lt: tomorrow.toISOString(),
        },
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Decrypt client names
    const tasksWithDecryptedClients = tasksDueToday.map(task => ({
      ...task,
      client: task.client ? {
        ...task.client,
        name: decrypt(task.client.nameEncrypted),
      } : null,
    }));

    // Fetch events for today
    const eventsToday = await prisma.event.findMany({
      where: {
        createdById: userId,
        startTime: {
          gte: today.toISOString(),
          lt: tomorrow.toISOString(),
        },
      },
      include: {
        client: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
        eventAttendees: {
          select: {
            id: true,
            userId: true,
            email: true,
            name: true,
            rsvpStatus: true,
            respondedAt: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Decrypt client names for events
    const eventsWithDecryptedClients = eventsToday.map(event => ({
      ...event,
      client: event.client ? {
        ...event.client,
        name: decrypt(event.client.nameEncrypted),
      } : null,
    }));

    // Fetch reminders due today
    const remindersToday = await prisma.reminder.findMany({
      where: {
        userId,
        remindAt: {
          gte: today.toISOString(),
          lt: tomorrow.toISOString(),
        },
        status: {
          in: ['PENDING', 'SNOOZED'],
        },
      },
      include: {
        client: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
      },
      orderBy: {
        remindAt: 'asc',
      },
    });

    // Decrypt client names for reminders
    const remindersWithDecryptedClients = remindersToday.map(reminder => ({
      ...reminder,
      client: reminder.client ? {
        ...reminder.client,
        name: decrypt(reminder.client.nameEncrypted),
      } : null,
    }));

    // Get statistics
    const [totalTasks, overdueTasks, completedTasksToday] = await Promise.all([
      prisma.task.count({
        where: {
          OR: [
            { createdById: userId },
            { assignedToId: userId },
          ],
          deletedAt: null,
        },
      }),
      prisma.task.count({
        where: {
          OR: [
            { createdById: userId },
            { assignedToId: userId },
          ],
          dueDate: {
            lt: today.toISOString(),
          },
          status: {
            not: 'COMPLETE',
          },
          deletedAt: null,
        },
      }),
      prisma.task.count({
        where: {
          OR: [
            { createdById: userId },
            { assignedToId: userId },
          ],
          completedAt: {
            gte: today.toISOString(),
            lt: tomorrow.toISOString(),
          },
          deletedAt: null,
        },
      }),
    ]);

    res.json({
      tasks: tasksWithDecryptedClients,
      events: eventsWithDecryptedClients,
      reminders: remindersWithDecryptedClients,
      statistics: {
        totalTasks,
        overdueTasks,
        completedTasksToday,
        tasksDueToday: tasksDueToday.length,
        eventsToday: eventsToday.length,
        remindersToday: remindersToday.length,
      },
    });
  } catch (error) {
    console.error('Error fetching today data:', error);
    res.status(500).json({ error: 'Failed to fetch today data' });
  }
});

// POST /api/integration/task-to-event - Convert task to calendar event
router.post('/task-to-event', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, eventData } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Fetch the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access
    if (task.createdById !== userId && task.assignedToId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this task' });
    }

    // Create event from task
    const event = await prisma.event.create({
      data: {
        title: eventData?.title || `Task: ${task.text}`,
        description: eventData?.description || task.description || '',
        eventType: eventData?.eventType || 'TASK',
        startTime: eventData?.startTime || task.dueDate || new Date().toISOString(),
        endTime: eventData?.endTime,
        allDay: eventData?.allDay ?? true,
        location: eventData?.location,
        clientId: task.clientId,
        taskId: task.id,
        status: 'CONFIRMED',
        createdById: userId,
      },
    });

    res.json(event);
  } catch (error) {
    console.error('Error converting task to event:', error);
    res.status(500).json({ error: 'Failed to convert task to event' });
  }
});

// POST /api/integration/task-to-reminder - Create reminder from task
router.post('/task-to-reminder', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, reminderData } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Fetch the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access
    if (task.createdById !== userId && task.assignedToId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this task' });
    }

    // Create reminder from task
    const reminder = await prisma.reminder.create({
      data: {
        userId: userId!,
        title: reminderData?.title || `Reminder: ${task.text}`,
        description: reminderData?.description || task.description || '',
        category: reminderData?.category || 'CLIENT',
        priority: reminderData?.priority || task.priority || 'MEDIUM',
        remindAt: reminderData?.remindAt || task.dueDate || new Date().toISOString(),
        dueDate: reminderData?.dueDate || task.dueDate,
        clientId: task.clientId,
        status: 'PENDING',
      },
    });

    res.json(reminder);
  } catch (error) {
    console.error('Error creating reminder from task:', error);
    res.status(500).json({ error: 'Failed to create reminder from task' });
  }
});

// POST /api/integration/event-to-task - Create task from calendar event
router.post('/event-to-task', async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, taskData } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    // Fetch the event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check access
    if (event.createdById !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this event' });
    }

    // Create task from event
    const task = await prisma.task.create({
      data: {
        text: taskData?.text || event.title,
        description: taskData?.description || event.description,
        type: taskData?.type || 'GENERAL',
        priority: taskData?.priority || 'MEDIUM',
        dueDate: taskData?.dueDate || event.startTime,
        clientId: event.clientId,
        status: 'TODO',
        createdById: userId,
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Error creating task from event:', error);
    res.status(500).json({ error: 'Failed to create task from event' });
  }
});

// POST /api/integration/event-to-reminder - Create reminder from calendar event
router.post('/event-to-reminder', async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, reminderData } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    // Fetch the event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check access
    if (event.createdById !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this event' });
    }

    // Create reminder from event
    const reminder = await prisma.reminder.create({
      data: {
        userId: userId!,
        title: reminderData?.title || `Reminder: ${event.title}`,
        description: reminderData?.description || event.description,
        category: reminderData?.category || 'GENERAL',
        priority: reminderData?.priority || 'MEDIUM',
        remindAt: reminderData?.remindAt || event.startTime,
        dueDate: reminderData?.dueDate || event.startTime,
        clientId: event.clientId,
        status: 'PENDING',
      },
    });

    res.json(reminder);
  } catch (error) {
    console.error('Error creating reminder from event:', error);
    res.status(500).json({ error: 'Failed to create reminder from event' });
  }
});

// GET /api/integration/unified-search - Search across tasks, events, and reminders
router.get('/unified-search', async (req: AuthRequest, res: Response) => {
  try {
    const { q, types } = req.query;
    const userId = req.user?.userId;
    const query = q as string;
    const searchTypes = types ? (types as string).split(',') : ['tasks', 'events', 'reminders'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results: any = {
      tasks: [],
      events: [],
      reminders: [],
    };

    // Search tasks
    if (searchTypes.includes('tasks')) {
      const tasks = await prisma.task.findMany({
        where: {
          AND: [
            {
              OR: [
                { createdById: userId },
                { assignedToId: userId },
              ],
            },
            {
              OR: [
                { text: { contains: query } },
                { description: { contains: query } },
              ],
            },
          ],
          deletedAt: null,
        },
        include: {
          client: {
            select: {
              id: true,
              nameEncrypted: true,
            },
          },
        },
        take: 20,
      });

      results.tasks = tasks.map(task => ({
        ...task,
        client: task.client ? {
          ...task.client,
          name: decrypt(task.client.nameEncrypted),
        } : null,
        type: 'task',
      }));
    }

    // Search events
    if (searchTypes.includes('events')) {
      const events = await prisma.event.findMany({
        where: {
          createdById: userId,
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { location: { contains: query } },
          ],
        },
        include: {
          client: {
            select: {
              id: true,
              nameEncrypted: true,
            },
          },
        },
        take: 20,
      });

      results.events = events.map(event => ({
        ...event,
        client: event.client ? {
          ...event.client,
          name: decrypt(event.client.nameEncrypted),
        } : null,
        type: 'event',
      }));
    }

    // Search reminders
    if (searchTypes.includes('reminders')) {
      const reminders = await prisma.reminder.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
          ],
        },
        include: {
          client: {
            select: {
              id: true,
              nameEncrypted: true,
            },
          },
        },
        take: 20,
      });

      results.reminders = reminders.map(reminder => ({
        ...reminder,
        client: reminder.client ? {
          ...reminder.client,
          name: decrypt(reminder.client.nameEncrypted),
        } : null,
        type: 'reminder',
      }));
    }

    res.json(results);
  } catch (error) {
    console.error('Error performing unified search:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

// GET /api/integration/unified-activity - Get combined activity feed
router.get('/unified-activity', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { limit = '50' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch recent activities
    const [tasks, events, reminders] = await Promise.all([
      prisma.task.findMany({
        where: {
          OR: [
            { createdById: userId },
            { assignedToId: userId },
          ],
          deletedAt: null,
        },
        include: {
          client: {
            select: {
              id: true,
              nameEncrypted: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: parseInt(limit as string),
      }),
      prisma.event.findMany({
        where: {
          createdById: userId,
        },
        include: {
          client: {
            select: {
              id: true,
              nameEncrypted: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: parseInt(limit as string),
      }),
      prisma.reminder.findMany({
        where: {
          userId,
        },
        include: {
          client: {
            select: {
              id: true,
              nameEncrypted: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: parseInt(limit as string),
      }),
    ]);

    // Combine and sort all activities by date
    const allActivities = [
      ...tasks.map(item => ({
        ...item,
        activityType: 'task',
        timestamp: item.createdAt,
        client: item.client ? {
          ...item.client,
          name: decrypt(item.client.nameEncrypted),
        } : null,
      })),
      ...events.map(item => ({
        ...item,
        activityType: 'event',
        timestamp: item.createdAt,
        client: item.client ? {
          ...item.client,
          name: decrypt(item.client.nameEncrypted),
        } : null,
      })),
      ...reminders.map(item => ({
        ...item,
        activityType: 'reminder',
        timestamp: item.createdAt,
        client: item.client ? {
          ...item.client,
          name: decrypt(item.client.nameEncrypted),
        } : null,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, parseInt(limit as string));

    res.json(allActivities);
  } catch (error) {
    console.error('Error fetching unified activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

export default router;
