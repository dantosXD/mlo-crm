import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import { decrypt } from '../utils/crypto.js';
import {
  fireTaskCreatedTrigger,
  fireTaskCompletedTrigger,
  fireTaskAssignedTrigger,
} from '../services/triggerHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

const canAccessClientTasks = async (userId: string, clientId: string | null) => {
  if (!clientId) return false;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, createdById: true },
  });
  return !!client && client.createdById === userId;
};

// GET /api/tasks - List tasks (optionally filtered by client_id, status, due_date, priority, assigned_to)
// Supports global filters: today, upcoming, overdue, completed, all
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      client_id,
      status,
      due_date,
      priority,
      assigned_to,
      sort_by = 'createdAt',
      sort_order = 'desc',
      page = '1',
      limit = '50'
    } = req.query;
    const userId = req.user?.userId;

    // Parse pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build date filter for due_date parameter
    let dateFilter: any = {};
    let statusFilter: any = {};

    // Handle special filter combinations
    if (due_date === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = {
        gte: today,
        lt: tomorrow,
      };
      // For today, also exclude completed tasks unless specifically requested
      if (!status) {
        statusFilter = { not: 'COMPLETE' };
      }
    } else if (due_date === 'upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const future = new Date(today);
      future.setDate(future.getDate() + 30); // Next 30 days
      dateFilter = {
        gte: today,
        lte: future,
      };
      if (!status) {
        statusFilter = { not: 'COMPLETE' };
      }
    } else if (due_date === 'overdue') {
      const now = new Date();
      dateFilter = {
        lt: now,
      };
      if (!status) {
        statusFilter = { not: 'COMPLETE' };
      }
    } else if (due_date === 'completed') {
      statusFilter = 'COMPLETE';
      // For completed, show all time periods
      dateFilter = {};
    }

    // Build status filter from query parameter or special filter
    let finalStatusFilter = status ? status as string : statusFilter;

    // Build orderBy object
    const orderBy: any = {};
    const sortField = sort_by as string;
    const sortDir = sort_order as string;

    if (sortField === 'dueDate') {
      orderBy.dueDate = sortDir === 'asc' ? 'asc' : 'desc';
    } else if (sortField === 'priority') {
      // Custom priority ordering
      orderBy.priority = sortDir;
    } else if (sortField === 'text') {
      orderBy.text = sortDir;
    } else {
      orderBy.createdAt = sortDir === 'asc' ? 'asc' : 'desc';
    }

    // Get total count for pagination
    const where: any = {
      ...(client_id && { clientId: client_id as string }),
      ...(finalStatusFilter && { status: finalStatusFilter }),
      ...(Object.keys(dateFilter).length > 0 && { dueDate: dateFilter }),
      ...(priority && { priority: priority as string }),
      ...(assigned_to && { assignedToId: assigned_to as string }),
    };

    // Filter by user's clients if userId provided and not filtering by specific client
    if (userId && !client_id) {
      // Get all client IDs belonging to this user
      const userClients = await prisma.client.findMany({
        where: { createdById: userId },
        select: { id: true },
      });
      const clientIds = userClients.map(c => c.id);

      // Allow tasks that belong to user's clients OR tasks without a client (created by user)
      if (clientIds.length > 0) {
        where.OR = [
          { clientId: { in: clientIds } },
          { clientId: null },
        ];
      } else {
        // If no clients, only show tasks without a client
        where.clientId = null;
      }
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          assignedTo: {
            select: { id: true, name: true },
          },
          subtasks: {
            orderBy: { order: 'asc' },
          },
          client: {
            select: { id: true, nameEncrypted: true },
          },
        },
      }),
      prisma.task.count({ where }),
    ]);

    // Decrypt client names and add to response
    const tasksWithClientName = tasks.map(task => ({
      ...task,
      client: task.client ? {
        id: task.client.id,
        name: decrypt(task.client.nameEncrypted),
      } : null,
    }));

    res.json({
      tasks: tasksWithClientName,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch tasks',
    });
  }
});

// GET /api/tasks/statistics - Get task statistics for dashboard
router.get('/statistics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all client IDs belonging to this user
    const userClients = await prisma.client.findMany({
      where: { createdById: userId },
      select: { id: true },
    });
    const clientIds = userClients.map(c => c.id);

    // Build where clause for tasks - include user's client tasks and standalone tasks
    const taskWhere = clientIds.length > 0
      ? { OR: [{ clientId: { in: clientIds } }, { clientId: null }] }
      : { clientId: null };

    const [
      totalTasks,
      dueTodayTasks,
      overdueTasks,
      completedTasks,
      upcomingTasks,
    ] = await Promise.all([
      // Total tasks (excluding completed)
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: 'COMPLETE' },
        },
      }),
      // Due today
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: 'COMPLETE' },
          dueDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      // Overdue
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: 'COMPLETE' },
          dueDate: { lt: new Date() },
        },
      }),
      // Completed
      prisma.task.count({
        where: {
          ...taskWhere,
          status: 'COMPLETE',
        },
      }),
      // Upcoming (next 7 days)
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: 'COMPLETE' },
          dueDate: {
            gte: tomorrow,
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    res.json({
      total: totalTasks,
      dueToday: dueTodayTasks,
      overdue: overdueTasks,
      completed: completedTasks,
      upcoming: upcomingTasks,
    });
  } catch (error) {
    console.error('Error fetching task statistics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch task statistics',
    });
  }
});

// PATCH /api/tasks/bulk - Bulk update tasks (mark complete, reassign, etc.)
router.patch('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { taskIds, action, data } = req.body;
    const userId = req.user?.userId;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'taskIds must be a non-empty array',
      });
    }

    if (!action) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'action is required',
      });
    }

    // Get user's client IDs
    const userClients = await prisma.client.findMany({
      where: { createdById: userId },
      select: { id: true },
    });
    const clientIds = userClients.map(c => c.id);

    // Verify access to all tasks
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        clientId: { in: clientIds },
      },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (tasks.length !== taskIds.length) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to modify some of these tasks',
      });
    }

    let updateData: any = {};
    let activityType = '';
    let activityDescription = '';

    switch (action) {
      case 'mark_complete':
        updateData = { status: 'COMPLETE', completedAt: new Date() };
        activityType = 'TASKS_BULK_COMPLETED';
        activityDescription = `${taskIds.length} task(s) marked as complete`;
        break;
      case 'mark_incomplete':
        updateData = { status: 'TODO', completedAt: null };
        activityType = 'TASKS_BULK_MARKED_INCOMPLETE';
        activityDescription = `${taskIds.length} task(s) marked as incomplete`;
        break;
      case 'reassign':
        if (!data?.assignedToId) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'assignedToId is required for reassign action',
          });
        }
        updateData = { assignedToId: data.assignedToId };
        activityType = 'TASKS_BULK_REASSIGNED';
        activityDescription = `${taskIds.length} task(s) reassigned`;
        break;
      case 'set_priority':
        if (!data?.priority) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'priority is required for set_priority action',
          });
        }
        updateData = { priority: data.priority };
        activityType = 'TASKS_BULK_PRIORITY_UPDATED';
        activityDescription = `${taskIds.length} task(s) priority updated`;
        break;
      case 'snooze':
        if (!data?.days) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'days is required for snooze action',
          });
        }
        const newDueDate = new Date();
        newDueDate.setDate(newDueDate.getDate() + data.days);
        updateData = { dueDate: newDueDate };
        activityType = 'TASKS_BULK_SNOOZED';
        activityDescription = `${taskIds.length} task(s) snoozed by ${data.days} day(s)`;
        break;
      default:
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid action: ${action}`,
        });
    }

    const updatedTasks = await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
      },
      data: updateData,
    });

    // Log activity for the first client (if any)
    if (tasks[0]?.clientId && activityType) {
      await prisma.activity.create({
        data: {
          clientId: tasks[0].clientId,
          userId: userId!,
          type: activityType,
          description: activityDescription,
        },
      });
    }

    res.json({
      message: `Successfully updated ${updatedTasks.count} tasks`,
      count: updatedTasks.count,
    });
  } catch (error) {
    console.error('Error bulk updating tasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to bulk update tasks',
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
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    const userId = req.user?.userId;
    if (!userId || task.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to access this task',
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

    if (clientId) {
      const hasAccess = await canAccessClientTasks(userId, clientId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You do not have permission to create tasks for this client',
        });
      }
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

      // Fire workflow trigger
      await fireTaskCreatedTrigger(task.id, clientId, userId);
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

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || existingTask.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to update this task',
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

      // Fire workflow trigger
      await fireTaskCompletedTrigger(task.id, existingTask.clientId, userId!);
    }

    // Log activity and fire trigger for task assignment
    if (assignedToId !== undefined && assignedToId !== existingTask.assignedToId && existingTask.clientId) {
      // Fire workflow trigger
      await fireTaskAssignedTrigger(task.id, existingTask.clientId, assignedToId, userId!);
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

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || existingTask.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to update this task',
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

      // Fire workflow trigger
      await fireTaskCompletedTrigger(task.id, existingTask.clientId, userId!);
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

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || existingTask.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to delete this task',
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

// ========== SUBTASK ROUTES ==========

// POST /api/tasks/:taskId/subtasks - Create subtask
router.post('/:taskId/subtasks', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { text, dueDate, assignedToId } = req.body;
    const userId = req.user?.userId;

    if (!text) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Subtask text is required',
      });
    }

    // Verify task ownership
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || task.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to add subtasks to this task',
      });
    }

    // Get next order value
    const maxOrder = await prisma.taskSubtask.findFirst({
      where: { taskId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const subtask = await prisma.taskSubtask.create({
      data: {
        taskId,
        text,
        order: (maxOrder?.order ?? -1) + 1,
      },
    });

    res.status(201).json(subtask);
  } catch (error) {
    console.error('Error creating subtask:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create subtask',
    });
  }
});

// PUT /api/tasks/:taskId/subtasks/:subtaskId - Update subtask
router.put('/:taskId/subtasks/:subtaskId', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { text, isCompleted, dueDate, order } = req.body;
    const userId = req.user?.userId;

    // Verify task ownership
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || task.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to update subtasks of this task',
      });
    }

    const subtask = await prisma.taskSubtask.update({
      where: { id: subtaskId },
      data: {
        ...(text !== undefined && { text }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(order !== undefined && { order }),
      },
    });

    res.json(subtask);
  } catch (error) {
    console.error('Error updating subtask:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update subtask',
    });
  }
});

// DELETE /api/tasks/:taskId/subtasks/:subtaskId - Delete subtask
router.delete('/:taskId/subtasks/:subtaskId', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, subtaskId } = req.params;
    const userId = req.user?.userId;

    // Verify task ownership
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || task.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to delete subtasks of this task',
      });
    }

    await prisma.taskSubtask.delete({
      where: { id: subtaskId },
    });

    res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete subtask',
    });
  }
});

// PATCH /api/tasks/:taskId/subtasks/:subtaskId/toggle - Toggle subtask completion
router.patch('/:taskId/subtasks/:subtaskId/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, subtaskId } = req.params;
    const userId = req.user?.userId;

    // Verify task ownership
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || task.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to toggle subtasks of this task',
      });
    }

    const existingSubtask = await prisma.taskSubtask.findUnique({
      where: { id: subtaskId },
    });

    if (!existingSubtask) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Subtask not found',
      });
    }

    const subtask = await prisma.taskSubtask.update({
      where: { id: subtaskId },
      data: {
        isCompleted: !existingSubtask.isCompleted,
      },
    });

    res.json(subtask);
  } catch (error) {
    console.error('Error toggling subtask:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to toggle subtask',
    });
  }
});

// POST /api/tasks/:taskId/subtasks/reorder - Reorder subtasks
router.post('/:taskId/subtasks/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { subtaskIds } = req.body;
    const userId = req.user?.userId;

    if (!Array.isArray(subtaskIds)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'subtaskIds must be an array',
      });
    }

    // Verify task ownership
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || task.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to reorder subtasks of this task',
      });
    }

    // Update order for each subtask
    await Promise.all(
      subtaskIds.map((subtaskId: string, index: number) =>
        prisma.taskSubtask.update({
          where: { id: subtaskId },
          data: { order: index },
        })
      )
    );

    res.json({ message: 'Subtasks reordered successfully' });
  } catch (error) {
    console.error('Error reordering subtasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reorder subtasks',
    });
  }
});

// Update task reminder settings
router.patch('/:taskId/reminders', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { reminderEnabled, reminderTimes, reminderMessage } = req.body;
    const userId = req.user?.userId;

    // Verify task ownership
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || task.client?.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to update reminder settings for this task',
      });
    }

    // Validate reminder times
    if (reminderTimes !== undefined) {
      const validReminderTypes = ['AT_TIME', '15MIN', '1HR', '1DAY', '1WEEK'];
      if (!Array.isArray(reminderTimes)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'reminderTimes must be an array',
        });
      }
      for (const rt of reminderTimes) {
        if (!validReminderTypes.includes(rt)) {
          return res.status(400).json({
            error: 'Validation Error',
            message: `Invalid reminder type: ${rt}. Must be one of: ${validReminderTypes.join(', ')}`,
          });
        }
      }
    }

    // Update reminder settings
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : task.reminderEnabled,
        reminderTimes: reminderTimes !== undefined ? JSON.stringify(reminderTimes) : task.reminderTimes,
        reminderMessage: reminderMessage !== undefined ? reminderMessage : task.reminderMessage,
      },
    });

    res.json({
      message: 'Reminder settings updated successfully',
      task: {
        id: updatedTask.id,
        reminderEnabled: updatedTask.reminderEnabled,
        reminderTimes: JSON.parse(updatedTask.reminderTimes || '[]'),
        reminderMessage: updatedTask.reminderMessage,
      },
    });
  } catch (error) {
    console.error('Error updating reminder settings:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update reminder settings',
    });
  }
});

// Snooze a task reminder
router.post('/:taskId/snooze', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { duration } = req.body; // '15MIN', '1HR', 'TOMORROW', 'NEXT_WEEK'
    const userId = req.user?.userId;

    if (!duration) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'duration is required (e.g., "15MIN", "1HR", "TOMORROW", "NEXT_WEEK")',
      });
    }

    // Verify task ownership or assignment
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || (task.client?.createdById !== userId && task.assignedToId !== userId)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to snooze this task',
      });
    }

    // Calculate snooze until time
    const now = new Date();
    let snoozedUntil: Date;

    switch (duration) {
      case '15MIN':
        snoozedUntil = new Date(now.getTime() + 15 * 60 * 1000);
        break;
      case '1HR':
        snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'TOMORROW':
        snoozedUntil = new Date(now);
        snoozedUntil.setDate(snoozedUntil.getDate() + 1);
        snoozedUntil.setHours(9, 0, 0, 0); // 9 AM tomorrow
        break;
      case 'NEXT_WEEK':
        snoozedUntil = new Date(now);
        snoozedUntil.setDate(snoozedUntil.getDate() + 7);
        snoozedUntil.setHours(9, 0, 0, 0); // 9 AM next week
        break;
      default:
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid duration. Must be one of: 15MIN, 1HR, TOMORROW, NEXT_WEEK',
        });
    }

    // Update task with snooze time
    await prisma.task.update({
      where: { id: taskId },
      data: { snoozedUntil },
    });

    // Log snooze action
    await prisma.taskReminderHistory.create({
      data: {
        taskId,
        userId,
        reminderType: 'SNOOZE',
        method: 'IN_APP',
        delivered: true,
        metadata: JSON.stringify({ duration, snoozedUntil: snoozedUntil.toISOString() }),
      },
    });

    res.json({
      message: 'Task snoozed successfully',
      snoozedUntil: snoozedUntil.toISOString(),
    });
  } catch (error) {
    console.error('Error snoozing task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to snooze task',
    });
  }
});

// Get reminder history for a task
router.get('/:taskId/reminder-history', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.userId;

    // Verify task ownership or assignment
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: { id: true, createdById: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    if (!userId || (task.client?.createdById !== userId && task.assignedToId !== userId)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to view reminder history for this task',
      });
    }

    // Get reminder history
    const history = await prisma.taskReminderHistory.findMany({
      where: { taskId },
      orderBy: { remindedAt: 'desc' },
      take: 50,
    });

    res.json({
      taskId,
      history: history.map((h) => ({
        id: h.id,
        reminderType: h.reminderType,
        method: h.method,
        delivered: h.delivered,
        remindedAt: h.remindedAt,
        metadata: h.metadata ? JSON.parse(h.metadata) : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching reminder history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch reminder history',
    });
  }
});

export default router;
