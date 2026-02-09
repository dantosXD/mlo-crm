import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { bulkOperationLimiter } from '../middleware/rateLimiter.js';
import { ServiceError } from '../services/taskService.js';
import * as taskService from '../services/taskService.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/** Standardised error handler — maps ServiceError to HTTP responses. */
function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ error: 'Internal Server Error', message: fallbackMessage });
}

// GET /api/tasks - List tasks (optionally filtered by client_id, status, due_date, priority, assigned_to)
// Supports global filters: today, upcoming, overdue, completed, all
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, status, due_date, priority, assigned_to, sort_by, sort_order, page, limit } = req.query;
    const result = await taskService.listTasks({
      userId: req.user!.userId,
      clientId: client_id as string | undefined,
      status: status as string | undefined,
      dueDate: due_date as string | undefined,
      priority: priority as string | undefined,
      assignedTo: assigned_to as string | undefined,
      sortBy: sort_by as string | undefined,
      sortOrder: sort_order as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch tasks');
  }
});

// GET /api/tasks/statistics - Get task statistics for dashboard
router.get('/statistics', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await taskService.getTaskStatistics(req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch task statistics');
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const task = await taskService.getTask(req.params.id, req.user!.userId);
    res.json(task);
  } catch (error) {
    handleError(res, error, 'Failed to fetch task');
  }
});

// POST /api/tasks - Create new task
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const task = await taskService.createTask(req.body, req.user!.userId);
    res.status(201).json(task);
  } catch (error) {
    handleError(res, error, 'Failed to create task');
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body, req.user!.userId);
    res.json(task);
  } catch (error) {
    handleError(res, error, 'Failed to update task');
  }
});

// PATCH /api/tasks/:id/status - Update task status only
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const task = await taskService.updateTaskStatus(req.params.id, req.body.status, req.user!.userId);
    res.json(task);
  } catch (error) {
    handleError(res, error, 'Failed to update task status');
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.deleteTask(req.params.id, req.user!.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete task');
  }
});

// PATCH /api/tasks/bulk - Bulk update tasks (mark complete, reassign, etc.)
router.patch('/bulk', bulkOperationLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { taskIds, action, data } = req.body;
    const result = await taskService.bulkUpdateTasks({ taskIds, action, data, userId: req.user!.userId });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to bulk update tasks');
  }
});

// POST /api/tasks/:taskId/subtasks - Create subtask
router.post('/:taskId/subtasks', async (req: AuthRequest, res: Response) => {
  try {
    const subtask = await taskService.createSubtask(req.params.taskId, req.body.text, req.user!.userId);
    res.status(201).json(subtask);
  } catch (error) {
    handleError(res, error, 'Failed to create subtask');
  }
});

// PUT /api/tasks/:taskId/subtasks/:subtaskId - Update subtask
router.put('/:taskId/subtasks/:subtaskId', async (req: AuthRequest, res: Response) => {
  try {
    const subtask = await taskService.updateSubtask(req.params.taskId, req.params.subtaskId, req.body, req.user!.userId);
    res.json(subtask);
  } catch (error) {
    handleError(res, error, 'Failed to update subtask');
  }
});

// DELETE /api/tasks/:taskId/subtasks/:subtaskId - Delete subtask
router.delete('/:taskId/subtasks/:subtaskId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.deleteSubtask(req.params.taskId, req.params.subtaskId, req.user!.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete subtask');
  }
});

// PATCH /api/tasks/:taskId/subtasks/:subtaskId/toggle - Toggle subtask completion
router.patch('/:taskId/subtasks/:subtaskId/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const subtask = await taskService.toggleSubtask(req.params.taskId, req.params.subtaskId, req.user!.userId);
    res.json(subtask);
  } catch (error) {
    handleError(res, error, 'Failed to toggle subtask');
  }
});

// POST /api/tasks/:taskId/subtasks/reorder - Reorder subtasks
router.post('/:taskId/subtasks/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.reorderSubtasks(req.params.taskId, req.body.subtaskIds, req.user!.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to reorder subtasks');
  }
});

// PATCH /api/tasks/:taskId/reminders - Update task reminder settings
router.patch('/:taskId/reminders', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.updateTaskReminders(req.params.taskId, req.body, req.user!.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update reminder settings');
  }
});

// POST /api/tasks/:taskId/snooze - Snooze a task reminder
router.post('/:taskId/snooze', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.snoozeTask(req.params.taskId, req.body.duration, req.user!.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to snooze task');
  }
});

// GET /api/tasks/:taskId/reminder-history - Get reminder history for a task
router.get('/:taskId/reminder-history', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.getReminderHistory(req.params.taskId, req.user!.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch reminder history');
  }
});

// GET /api/tasks/templates - Get all task templates
router.get('/templates', async (_req: AuthRequest, res: Response) => {
  try {
    const templates = await taskService.listTaskTemplates();
    res.json(templates);
  } catch (error) {
    handleError(res, error, 'Failed to fetch task templates');
  }
});

// POST /api/tasks/templates - Create task template
router.post('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const template = await taskService.createTaskTemplate(req.body, req.user!.userId);
    res.status(201).json(template);
  } catch (error) {
    handleError(res, error, 'Failed to create task template');
  }
});

// DELETE /api/tasks/templates/:id - Delete task template
router.delete('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.deleteTaskTemplate(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete task template');
  }
});

// GET /api/tasks/:taskId/attachments - Get task attachments
router.get('/:taskId/attachments', async (req: AuthRequest, res: Response) => {
  try {
    const attachments = await taskService.listTaskAttachments(req.params.taskId, req.user!.userId);
    res.json(attachments);
  } catch (error) {
    handleError(res, error, 'Failed to fetch task attachments');
  }
});

// POST /api/tasks/:taskId/attachments - Add task attachment
router.post('/:taskId/attachments', async (req: AuthRequest, res: Response) => {
  try {
    const attachment = await taskService.createTaskAttachment(req.params.taskId, req.body, req.user!.userId);
    res.status(201).json(attachment);
  } catch (error) {
    handleError(res, error, 'Failed to create task attachment');
  }
});

// DELETE /api/tasks/:taskId/attachments/:attachmentId - Delete task attachment
router.delete('/:taskId/attachments/:attachmentId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await taskService.deleteTaskAttachment(req.params.taskId, req.params.attachmentId, req.user!.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete task attachment');
  }
});

// POST /api/tasks/:id/claim - Claim an unassigned task
router.post('/:id/claim', async (req: AuthRequest, res: Response) => {
  try {
    const task = await taskService.claimTask(req.params.id, req.user!.userId);
    res.json(task);
  } catch (error) {
    handleError(res, error, 'Failed to claim task');
  }
});

// POST /api/tasks/:id/clone - Clone a task
router.post('/:id/clone', async (req: AuthRequest, res: Response) => {
  try {
    const clonedTask = await taskService.cloneTask(req.params.id, req.user!.userId);
    res.status(201).json(clonedTask);
  } catch (error) {
    handleError(res, error, 'Failed to clone task');
  }
});

// POST /api/tasks/:id/create-event - Create a calendar event from a task
router.post('/:id/create-event', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const event = await taskService.createEventFromTask(req.params.id, req.body, req.user.userId);
    res.status(201).json(event);
  } catch (error) {
    handleError(res, error, 'Failed to create event from task');
  }
});

// POST /api/tasks/:id/create-reminder - Create a reminder from a task
router.post('/:id/create-reminder', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const reminder = await taskService.createReminderFromTask(req.params.id, req.body, req.user.userId);
    res.status(201).json(reminder);
  } catch (error) {
    handleError(res, error, 'Failed to create reminder from task');
  }
});

export default router;
