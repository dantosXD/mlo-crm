import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { reminderDeliveryLimiter } from '../middleware/rateLimiter.js';
import { ServiceError } from '../services/taskService.js';
import * as reminderService from '../services/reminderService.js';

const router = Router();

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : fallbackMessage });
}

// GET /api/reminders
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { status, category, priority, clientId, upcoming, overdue, limit, offset } = req.query;
    const result = await reminderService.listReminders({
      userId: req.user.userId,
      status: status as string | undefined,
      category: category as string | undefined,
      priority: priority as string | undefined,
      clientId: clientId as string | undefined,
      upcoming: upcoming as string | undefined,
      overdue: overdue as string | undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch reminders');
  }
});

// GET /api/reminders/stats/summary
router.get('/stats/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.getReminderStats(req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch reminder stats');
  }
});

// GET /api/reminders/suggestions
router.get('/suggestions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.getSuggestions(req.user.userId, req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to generate suggestions');
  }
});

// GET /api/reminders/suggestions/analytics
router.get('/suggestions/analytics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.getSuggestionAnalytics(req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch suggestion analytics');
  }
});

// GET /api/reminders/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.getReminder(req.params.id, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch reminder');
  }
});

// POST /api/reminders
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.createReminder(req.body, req.user.userId);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create reminder');
  }
});

// PUT /api/reminders/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.updateReminder(req.params.id, req.body, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update reminder');
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.deleteReminder(req.params.id, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete reminder');
  }
});

// POST /api/reminders/:id/complete
router.post('/:id/complete', authenticateToken, reminderDeliveryLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.completeReminder(req.params.id, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to complete reminder');
  }
});

// POST /api/reminders/:id/dismiss
router.post('/:id/dismiss', authenticateToken, reminderDeliveryLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.dismissReminder(req.params.id, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to dismiss reminder');
  }
});

// POST /api/reminders/:id/snooze
router.post('/:id/snooze', authenticateToken, reminderDeliveryLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { minutes, hours, days } = req.body;
    const result = await reminderService.snoozeReminder(req.params.id, req.user.userId, minutes, hours, days);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to snooze reminder');
  }
});

// POST /api/reminders/bulk
router.post('/bulk', authenticateToken, reminderDeliveryLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { action, reminderIds } = req.body;
    const result = await reminderService.bulkOperation(req.user.userId, action, reminderIds);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to perform bulk operation');
  }
});

// POST /api/reminders/:id/create-task
router.post('/:id/create-task', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.createTaskFromReminder(req.params.id, req.user.userId, req.body.dueDate);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create task from reminder');
  }
});

// POST /api/reminders/:id/create-event
router.post('/:id/create-event', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { startTime, duration, allDay } = req.body;
    const result = await reminderService.createEventFromReminder(req.params.id, req.user.userId, startTime, duration, allDay);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create event from reminder');
  }
});

// POST /api/reminders/suggestions/accept
router.post('/suggestions/accept', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.acceptSuggestion(req.user.userId, req.body.suggestion);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create reminder from suggestion');
  }
});

// POST /api/reminders/suggestions/dismiss
router.post('/suggestions/dismiss', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { suggestionType, metadata } = req.body;
    const result = await reminderService.dismissSuggestion(req.user.userId, suggestionType, metadata);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to dismiss suggestion');
  }
});

// PUT /api/reminders/suggestions/config
router.put('/suggestions/config', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await reminderService.updateSuggestionConfig(req.user.userId, req.body);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update suggestion settings');
  }
});

export default router;