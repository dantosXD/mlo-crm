import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/tasks - List tasks (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, status } = req.query;

    const tasks = await prisma.task.findMany({
      where: {
        ...(client_id && { clientId: client_id as string }),
        ...(status && { status: status as string }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
        subtasks: true,
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch tasks',
    });
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
        subtasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch task',
    });
  }
});

// POST /api/tasks - Create new task
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, text, description, status, priority, dueDate, assignedToId } = req.body;
    const userId = req.user?.userId;

    if (!text || !userId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Task text is required',
      });
    }

    const task = await prisma.task.create({
      data: {
        clientId,
        text,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    });

    // Log activity
    if (clientId) {
      await prisma.activity.create({
        data: {
          clientId,
          userId,
          type: 'TASK_CREATED',
          description: `Task "${text}" created`,
        },
      });
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create task',
    });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text, description, status, priority, dueDate, assignedToId } = req.body;
    const userId = req.user?.userId;

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(text !== undefined && { text }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(status === 'COMPLETE' && !existingTask.completedAt && { completedAt: new Date() }),
      },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
        subtasks: true,
      },
    });

    // Log activity for task completion
    if (status === 'COMPLETE' && existingTask.status !== 'COMPLETE' && existingTask.clientId) {
      await prisma.activity.create({
        data: {
          clientId: existingTask.clientId,
          userId: userId!,
          type: 'TASK_COMPLETED',
          description: `Task "${existingTask.text}" completed`,
        },
      });
    }

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update task',
    });
  }
});

// PATCH /api/tasks/:id/status - Update task status only
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;

    if (!status) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Status is required',
      });
    }

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        status,
        ...(status === 'COMPLETE' && !existingTask.completedAt && { completedAt: new Date() }),
      },
    });

    // Log activity for task completion
    if (status === 'COMPLETE' && existingTask.status !== 'COMPLETE' && existingTask.clientId) {
      await prisma.activity.create({
        data: {
          clientId: existingTask.clientId,
          userId: userId!,
          type: 'TASK_COMPLETED',
          description: `Task "${existingTask.text}" completed`,
        },
      });
    }

    res.json(task);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update task status',
    });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    await prisma.task.delete({ where: { id } });

    // Log activity
    if (existingTask.clientId) {
      await prisma.activity.create({
        data: {
          clientId: existingTask.clientId,
          userId: userId!,
          type: 'TASK_DELETED',
          description: `Task "${existingTask.text}" deleted`,
        },
      });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete task',
    });
  }
});

export default router;
