import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/workflow-executions - List workflow executions with filtering
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      workflow_id,
      client_id,
      status,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (workflow_id) {
      where.workflowId = workflow_id as string;
    }

    if (client_id) {
      where.clientId = client_id as string;
    }

    if (status) {
      where.status = status as string;
    }

    // Get total count for pagination
    const total = await prisma.workflowExecution.count({ where });

    // Get executions with pagination
    const executions = await prisma.workflowExecution.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            triggerType: true,
          },
        },
        client: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
      },
    });

    // Helper to decrypt client name
    const decryptName = (encrypted: string | null): string => {
      if (!encrypted) return 'Unknown';
      try {
        const parsed = JSON.parse(encrypted);
        return parsed.data || 'Unknown';
      } catch {
        return encrypted;
      }
    };

    const formattedExecutions = executions.map((execution) => ({
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflow.name,
      workflowTriggerType: execution.workflow.triggerType,
      clientId: execution.clientId,
      clientName: execution.client ? decryptName(execution.client.nameEncrypted) : null,
      status: execution.status,
      triggerData: execution.triggerData ? JSON.parse(execution.triggerData) : null,
      currentStep: execution.currentStep,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      errorMessage: execution.errorMessage,
      createdAt: execution.createdAt,
    }));

    res.json({
      executions: formattedExecutions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch workflow executions',
    });
  }
});

// GET /api/workflow-executions/:id - Get single workflow execution
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
            triggerType: true,
            actions: true,
          },
        },
        client: {
          select: {
            id: true,
            nameEncrypted: true,
            status: true,
          },
        },
      },
    });

    if (!execution) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow execution not found',
      });
    }

    // Helper to decrypt client name
    const decryptName = (encrypted: string | null): string => {
      if (!encrypted) return 'Unknown';
      try {
        const parsed = JSON.parse(encrypted);
        return parsed.data || 'Unknown';
      } catch {
        return encrypted;
      }
    };

    res.json({
      id: execution.id,
      workflowId: execution.workflowId,
      workflow: execution.workflow,
      clientId: execution.clientId,
      client: execution.client
        ? {
            id: execution.client.id,
            name: decryptName(execution.client.nameEncrypted),
            status: execution.client.status,
          }
        : null,
      status: execution.status,
      triggerData: execution.triggerData ? JSON.parse(execution.triggerData) : null,
      currentStep: execution.currentStep,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      errorMessage: execution.errorMessage,
      logs: execution.logs ? JSON.parse(execution.logs) : [],
      createdAt: execution.createdAt,
    });
  } catch (error) {
    console.error('Error fetching workflow execution:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch workflow execution',
    });
  }
});

// POST /api/workflow-executions/:id/cancel - Cancel a running workflow execution
router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { cancelWorkflowExecution } = await import('../services/workflowExecutor.js');
    const result = await cancelWorkflowExecution(id, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error cancelling workflow execution:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to cancel workflow execution',
    });
  }
});

// GET /api/workflow-executions/:id/logs - Get execution logs
router.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { getExecutionLogs } = await import('../services/workflowExecutor.js');
    const result = await getExecutionLogs(id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error fetching execution logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch execution logs',
    });
  }
});

// POST /api/workflow-executions/:id/retry - Manually retry a failed workflow execution
router.post('/:id/retry', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { retryWorkflowExecution } = await import('../services/workflowExecutor.js');
    const result = await retryWorkflowExecution(id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error retrying workflow execution:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to retry workflow execution',
    });
  }
});

export default router;
