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

// GET /api/communication-templates
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type, category, is_active, search, page, limit } = req.query;
    const result = await commService.listTemplates({
      type: type as string | undefined,
      category: category as string | undefined,
      isActive: is_active as string | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch communication templates');
  }
});

// GET /api/communication-templates/meta/types
router.get('/meta/types', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ data: commService.TEMPLATE_TYPES_META });
  } catch (error) {
    handleError(res, error, 'Failed to fetch template types');
  }
});

// GET /api/communication-templates/meta/categories
router.get('/meta/categories', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ data: commService.TEMPLATE_CATEGORIES_META });
  } catch (error) {
    handleError(res, error, 'Failed to fetch template categories');
  }
});

// GET /api/communication-templates/meta/placeholders
router.get('/meta/placeholders', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ data: commService.PLACEHOLDER_VARS_META });
  } catch (error) {
    handleError(res, error, 'Failed to fetch placeholder variables');
  }
});

// GET /api/communication-templates/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.getTemplate(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch communication template');
  }
});

// POST /api/communication-templates
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.createTemplate(req.body);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create communication template');
  }
});

// PUT /api/communication-templates/:id
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.updateTemplate(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update communication template');
  }
});

// DELETE /api/communication-templates/:id
router.delete('/:id', authorizeRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.deleteTemplate(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete communication template');
  }
});

// PATCH /api/communication-templates/:id/toggle
router.patch('/:id/toggle', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await commService.toggleTemplate(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to toggle communication template status');
  }
});

export default router;