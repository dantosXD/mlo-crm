import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import { ServiceError } from '../services/taskService.js';
import * as commService from '../services/communicationService.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : fallbackMessage });
}

// GET /api/communications
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, type, status, scheduled, follow_up, start_date, end_date, page, limit } = req.query;
    const result = await commService.listCommunications({
      userId: req.user!.userId,
      userRole: req.user!.role,
      clientId: client_id as string | undefined,
      type: type as string | undefined,
      status: status as string | undefined,
      scheduled: scheduled as string | undefined,
      followUp: follow_up as string | undefined,
      startDate: start_date as string | undefined,
      endDate: end_date as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch communications');
  }
});

// GET /api/communications/search
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q, type, status, page, limit } = req.query;
    const result = await commService.searchCommunications({
      userId: req.user!.userId,
      userRole: req.user!.role,
      q: q as string,
      type: type as string | undefined,
      status: status as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to search communications');
  }
});

// GET /api/communications/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.getCommunication(req.params.id, req.user!.userId, req.user!.role);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch communication');
  }
});

// POST /api/communications
router.post('/', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await commService.createCommunication(req.body, req.user.userId);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create communication');
  }
});

// PUT /api/communications/:id
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.updateCommunication(req.params.id, req.body, req.user!.userId, req.user!.role);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update communication');
  }
});

// DELETE /api/communications/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.deleteCommunication(req.params.id, req.user!.userId, req.user!.role);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete communication');
  }
});

// PATCH /api/communications/:id/status
router.patch('/:id/status', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.updateCommunicationStatus(req.params.id, req.body.status, req.user!.userId, req.user!.role);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update communication status');
  }
});

// POST /api/communications/:id/send
router.post('/:id/send', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.sendCommunication(req.params.id, req.user!.userId, req.user!.role, req.body.metadata);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to send communication');
  }
});

// POST /api/communications/preview
router.post('/preview', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { clientId, body, subject, additionalContext } = req.body;
    const result = await commService.previewCommunicationContent(clientId, body, req.user.userId, subject, additionalContext);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to preview communication');
  }
});

export default router;