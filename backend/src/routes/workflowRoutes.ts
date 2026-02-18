import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import { ServiceError } from '../services/taskService.js';
import * as workflowService from '../services/workflowService.js';
import { TRIGGER_TYPES_META, ACTION_TYPES_META } from '../services/workflowMeta.js';

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

// --- core CRUD ---

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, is_active, is_template, trigger_type, search } = req.query;
    const result = await workflowService.listWorkflows({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      isActive: is_active as string | undefined,
      isTemplate: is_template as string | undefined,
      triggerType: trigger_type as string | undefined,
      search: search as string | undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch workflows');
  }
});

router.get('/meta/trigger-types', async (_req: AuthRequest, res: Response) => {
  try {
    res.json(TRIGGER_TYPES_META);
  } catch (error) {
    handleError(res, error, 'Failed to fetch trigger types');
  }
});

router.get('/meta/action-types', async (_req: AuthRequest, res: Response) => {
  try {
    res.json(ACTION_TYPES_META);
  } catch (error) {
    handleError(res, error, 'Failed to fetch action types');
  }
});

// --- templates ---

router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const { trigger_type, search } = req.query;
    const result = await workflowService.listWorkflowTemplates({
      triggerType: trigger_type as string | undefined,
      search: search as string | undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch workflow templates');
  }
});

router.post('/templates/:id/use', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, customize } = req.body;
    const result = await workflowService.useTemplate(req.params.id, req.user.userId, name, customize);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to use workflow template');
  }
});

// --- execution control (must be before /:id to avoid route shadowing) ---

router.get('/executions', async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, client_id, workflow_id, status } = req.query;
    const result = await workflowService.listExecutions({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      clientId: client_id as string | undefined,
      workflowId: workflow_id as string | undefined,
      status: status as string | undefined,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch workflow executions');
  }
});

router.post('/executions/:id/pause', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.pauseExecution(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to pause workflow execution');
  }
});

router.post('/executions/:id/resume', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.resumeExecution(req.params.id, req.user?.userId);
    (result as any).success === false ? res.status(400).json(result) : res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to resume workflow execution');
  }
});

// --- import / export (must be before /:id to avoid route shadowing) ---

router.post('/import', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { workflowData, asTemplate } = req.body;
    const result = await workflowService.importWorkflow(workflowData, req.user.userId, asTemplate);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to import workflow');
  }
});

// --- single workflow ---

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.getWorkflow(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch workflow');
  }
});

router.post('/', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await workflowService.createWorkflow(req.body, req.user.userId);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to create workflow');
  }
});

router.put('/:id', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.updateWorkflow(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to update workflow');
  }
});

router.delete('/:id', authorizeRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.deleteWorkflow(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to delete workflow');
  }
});

// --- toggle / clone ---

router.patch('/:id/toggle', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await workflowService.toggleWorkflow(req.params.id, req.user.userId, req.ip, req.get('User-Agent'));
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to toggle workflow');
  }
});

router.post('/:id/clone', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await workflowService.cloneWorkflow(req.params.id, req.user.userId);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to clone workflow');
  }
});

// --- versions / rollback ---

router.get('/:id/versions', async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.getVersions(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to fetch workflow versions');
  }
});

router.post('/:id/rollback/:version', authorizeRoles('ADMIN', 'MANAGER', 'MLO'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.rollbackWorkflow(req.params.id, parseInt(req.params.version, 10));
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to rollback workflow');
  }
});

// --- execution ---

router.post('/:id/execute', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { clientId, triggerData } = req.body;
    const result = await workflowService.executeManualWorkflow(req.params.id, { clientId, triggerData, userId: req.user.userId });
    result.success ? res.json(result) : res.status(400).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to execute workflow');
  }
});

router.post('/:id/test', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { clientId, triggerData } = req.body;
    const result = await workflowService.testWorkflowDryRun(req.params.id, { clientId, triggerData, userId: req.user.userId });
    result.success ? res.json(result) : res.status(400).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to test workflow');
  }
});

router.post('/:id/trigger', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { clientId, triggerData } = req.body;
    const result = await workflowService.triggerWorkflow(req.params.id, { clientId, triggerData, userId: req.user.userId });
    result.success ? res.json(result) : res.status(400).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to trigger workflow');
  }
});

// --- import / export ---

router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const result = await workflowService.exportWorkflow(req.params.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + result.fileName + '"');
    res.json({ version: result.version, exportedAt: result.exportedAt, workflow: result.workflow });
  } catch (error) {
    handleError(res, error, 'Failed to export workflow');
  }
});

// --- dev-only test endpoints ---

if (process.env.NODE_ENV === 'development') {
  router.post('/test-action', async (req: AuthRequest, res: Response) => {
    try {
      const { actionType, config, context } = req.body;
      const result = await workflowService.testAction(actionType, config, context);
      result.success ? res.json(result) : res.status(400).json(result);
    } catch (error) {
      handleError(res, error, 'Failed to execute action');
    }
  });

  router.post('/test-condition', async (req: AuthRequest, res: Response) => {
    try {
      const { conditions, clientId } = req.body;
      const result = await workflowService.testCondition(conditions, clientId);
      result.success ? res.json(result) : res.status(400).json(result);
    } catch (error) {
      handleError(res, error, 'Failed to evaluate condition');
    }
  });
}

export default router;
