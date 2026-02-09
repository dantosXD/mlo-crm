import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ServiceError } from '../services/taskService.js';
import * as eventService from '../services/eventService.js';

const router = Router();

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : fallbackMessage });
}

// GET /api/events
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { startDate, endDate, clientId, eventType } = req.query;
    const result = await eventService.listEvents({
      userId: req.user.userId,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      clientId: clientId as string | undefined,
      eventType: eventType as string | undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch events');
  }
});

// GET /api/events/check-conflicts
router.get('/check-conflicts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { startTime, endTime, excludeEventId } = req.query;
    const result = await eventService.checkConflicts(
      req.user.userId,
      startTime as string,
      endTime as string,
      excludeEventId as string | undefined,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to check for conflicts');
  }
});

// GET /api/events/availability
router.get('/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { date, duration } = req.query;
    const result = await eventService.getAvailability(
      req.user.userId,
      date as string,
      duration ? parseInt(duration as string) : undefined,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to check availability');
  }
});

// GET /api/events/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await eventService.getEvent(req.params.id, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch event');
  }
});

// POST /api/events
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await eventService.createEvent(req.body, req.user.userId);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create event');
  }
});

// PUT /api/events/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await eventService.updateEvent(req.params.id, req.body, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update event');
  }
});

// DELETE /api/events/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await eventService.deleteEvent(req.params.id, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete event');
  }
});

// PATCH /api/events/:id/status
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await eventService.updateEventStatus(req.params.id, req.body.status, req.user.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update event status');
  }
});

// PATCH /api/events/:id/rsvp
router.patch('/:id/rsvp', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { attendeeId, rsvpStatus } = req.body;
    const result = await eventService.updateRsvp(req.params.id, attendeeId, rsvpStatus);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update RSVP status');
  }
});

// POST /api/events/:id/create-task
router.post('/:id/create-task', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { dueDate, priority } = req.body;
    const result = await eventService.createTaskFromEvent(req.params.id, req.user.userId, dueDate, priority);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create task from event');
  }
});

// POST /api/events/:id/create-reminder
router.post('/:id/create-reminder', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { remindAt, category, priority } = req.body;
    const result = await eventService.createReminderFromEvent(req.params.id, req.user.userId, remindAt, category, priority);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create reminder from event');
  }
});

export default router;