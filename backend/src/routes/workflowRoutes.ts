import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Helper function to validate workflow actions JSON
const validateActions = (actions: any): boolean => {
  if (!Array.isArray(actions)) return false;
  if (actions.length === 0) return false;

  // Each action should have at least a type property
  return actions.every((action) => {
    return (
      typeof action === 'object' &&
      action !== null &&
      typeof action.type === 'string' &&
      action.type.length > 0
    );
  });
};

// Helper function to validate workflow conditions JSON
const validateConditions = (conditions: any): boolean => {
  if (!conditions) return true; // conditions are optional
  if (typeof conditions !== 'object') return false;
  if (Array.isArray(conditions)) return false;
  return true;
};

// GET /api/workflows - List workflows with filtering and pagination
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      is_active,
      is_template,
      trigger_type,
      search,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (is_active !== undefined) {
      where.isActive = is_active === 'true';
    }

    if (is_template !== undefined) {
      where.isTemplate = is_template === 'true';
    }

    if (trigger_type) {
      where.triggerType = trigger_type as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.workflow.count({ where });

    // Get workflows with pagination
    const workflows = await prisma.workflow.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { executions: true },
        },
      },
    });

    const formattedWorkflows = workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      isTemplate: workflow.isTemplate,
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : null,
      conditions: workflow.conditions ? JSON.parse(workflow.conditions) : null,
      actions: JSON.parse(workflow.actions),
      version: workflow.version,
      executionCount: workflow._count.executions,
      createdBy: workflow.createdBy,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    }));

    res.json({
      workflows: formattedWorkflows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch workflows',
    });
  }
});

// GET /api/workflows/meta/trigger-types - Get available trigger types (MUST come before /:id route!)
router.get('/meta/trigger-types', async (req: AuthRequest, res: Response) => {
  try {
    const triggerTypes = [
      {
        type: 'CLIENT_CREATED',
        label: 'Client Created',
        description: 'Triggered when a new client is created',
        configFields: [],
      },
      {
        type: 'CLIENT_STATUS_CHANGED',
        label: 'Client Status Changed',
        description: 'Triggered when a client status changes',
        configFields: [
          {
            name: 'fromStatus',
            type: 'select',
            label: 'From Status',
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
          {
            name: 'toStatus',
            type: 'select',
            label: 'To Status',
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
        ],
      },
      {
        type: 'DOCUMENT_UPLOADED',
        label: 'Document Uploaded',
        description: 'Triggered when a document is uploaded',
        configFields: [
          {
            name: 'category',
            type: 'select',
            label: 'Document Category',
            options: ['INCOME', 'EMPLOYMENT', 'ASSETS', 'PROPERTY', 'INSURANCE', 'CREDIT', 'OTHER'],
          },
        ],
      },
      {
        type: 'DOCUMENT_STATUS_CHANGED',
        label: 'Document Status Changed',
        description: 'Triggered when a document status changes',
        configFields: [
          {
            name: 'fromStatus',
            type: 'select',
            label: 'From Status',
            options: ['REQUIRED', 'REQUESTED', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
          },
          {
            name: 'toStatus',
            type: 'select',
            label: 'To Status',
            options: ['REQUIRED', 'REQUESTED', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
          },
        ],
      },
      {
        type: 'TASK_DUE',
        label: 'Task Due',
        description: 'Triggered when a task becomes due',
        configFields: [
          {
            name: 'priority',
            type: 'select',
            label: 'Priority',
            options: ['LOW', 'MEDIUM', 'HIGH'],
          },
        ],
      },
      {
        type: 'TASK_COMPLETED',
        label: 'Task Completed',
        description: 'Triggered when a task is marked complete',
        configFields: [],
      },
      {
        type: 'MANUAL',
        label: 'Manual Trigger',
        description: 'Triggered manually by a user',
        configFields: [],
      },
    ];

    res.json(triggerTypes);
  } catch (error) {
    console.error('Error fetching trigger types:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch trigger types',
    });
  }
});

// GET /api/workflows/meta/action-types - Get available action types (MUST come before /:id route!)
router.get('/meta/action-types', async (req: AuthRequest, res: Response) => {
  try {
    const actionTypes = [
      {
        type: 'SEND_EMAIL',
        label: 'Send Email',
        description: 'Send an email to the client',
        configFields: [
          {
            name: 'templateId',
            type: 'select',
            label: 'Email Template',
            required: true,
          },
          {
            name: 'to',
            type: 'text',
            label: 'To Email',
            description: 'Leave blank to use client email',
          },
        ],
      },
      {
        type: 'SEND_SMS',
        label: 'Send SMS',
        description: 'Send an SMS to the client',
        configFields: [
          {
            name: 'templateId',
            type: 'select',
            label: 'SMS Template',
            required: true,
          },
          {
            name: 'to',
            type: 'text',
            label: 'To Phone',
            description: 'Leave blank to use client phone',
          },
        ],
      },
      {
        type: 'CREATE_TASK',
        label: 'Create Task',
        description: 'Create a new task',
        configFields: [
          {
            name: 'text',
            type: 'text',
            label: 'Task Description',
            required: true,
          },
          {
            name: 'priority',
            type: 'select',
            label: 'Priority',
            options: ['LOW', 'MEDIUM', 'HIGH'],
            default: 'MEDIUM',
          },
          {
            name: 'dueDays',
            type: 'number',
            label: 'Due in Days',
            default: 7,
          },
          {
            name: 'assignedToId',
            type: 'select',
            label: 'Assign To',
            description: 'Leave blank to assign to workflow creator',
          },
        ],
      },
      {
        type: 'UPDATE_CLIENT',
        label: 'Update Client',
        description: 'Update client fields',
        configFields: [
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
          {
            name: 'addTags',
            type: 'text',
            label: 'Add Tags',
            description: 'Comma-separated list of tags to add',
          },
        ],
      },
      {
        type: 'REQUEST_DOCUMENT',
        label: 'Request Document',
        description: 'Request a document from the client',
        configFields: [
          {
            name: 'category',
            type: 'select',
            label: 'Document Category',
            required: true,
            options: ['INCOME', 'EMPLOYMENT', 'ASSETS', 'PROPERTY', 'INSURANCE', 'CREDIT', 'OTHER'],
          },
          {
            name: 'name',
            type: 'text',
            label: 'Document Name',
            required: true,
          },
          {
            name: 'dueDays',
            type: 'number',
            label: 'Due in Days',
            default: 7,
          },
        ],
      },
      {
        type: 'ADD_NOTE',
        label: 'Add Note',
        description: 'Add a note to the client',
        configFields: [
          {
            name: 'text',
            type: 'textarea',
            label: 'Note Text',
            required: true,
          },
          {
            name: 'tags',
            type: 'text',
            label: 'Tags',
            description: 'Comma-separated list of tags',
          },
        ],
      },
      {
        type: 'WEBHOOK',
        label: 'Webhook',
        description: 'Send data to an external webhook',
        configFields: [
          {
            name: 'url',
            type: 'text',
            label: 'Webhook URL',
            required: true,
          },
          {
            name: 'method',
            type: 'select',
            label: 'HTTP Method',
            options: ['POST', 'PUT', 'PATCH'],
            default: 'POST',
          },
          {
            name: 'headers',
            type: 'json',
            label: 'Headers',
            description: 'JSON object of headers',
          },
        ],
      },
    ];

    res.json(actionTypes);
  } catch (error) {
    console.error('Error fetching action types:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch action types',
    });
  }
});

// GET /api/workflows/:id - Get single workflow
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        executions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            client: {
              select: { id: true, nameEncrypted: true },
            },
          },
        },
      },
    });

    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
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

    const formattedExecutions = workflow.executions.map((execution) => ({
      id: execution.id,
      clientId: execution.clientId,
      clientName: execution.client ? decryptName(execution.client.nameEncrypted) : 'Unknown',
      status: execution.status,
      currentStep: execution.currentStep,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      errorMessage: execution.errorMessage,
      createdAt: execution.createdAt,
    }));

    res.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      isTemplate: workflow.isTemplate,
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : null,
      conditions: workflow.conditions ? JSON.parse(workflow.conditions) : null,
      actions: JSON.parse(workflow.actions),
      version: workflow.version,
      createdBy: workflow.createdBy,
      executions: formattedExecutions,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch workflow',
    });
  }
});

// POST /api/workflows - Create new workflow (ADMIN, MANAGER only)
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isActive, isTemplate, triggerType, triggerConfig, conditions, actions } =
      req.body;
    const userId = req.user?.userId;

    // Validation
    if (!name || !triggerType || !actions) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name, trigger type, and actions are required',
      });
    }

    // Validate trigger type
    const validTriggerTypes = [
      'CLIENT_CREATED',
      'CLIENT_STATUS_CHANGED',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_STATUS_CHANGED',
      'TASK_DUE',
      'TASK_COMPLETED',
      'MANUAL',
    ];

    if (!validTriggerTypes.includes(triggerType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid trigger type. Must be one of: ${validTriggerTypes.join(', ')}`,
      });
    }

    // Validate actions JSON
    if (!validateActions(actions)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Actions must be a non-empty array with valid action objects',
      });
    }

    // Validate conditions JSON if provided
    if (!validateConditions(conditions)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Conditions must be a valid object',
      });
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description,
        isActive: isActive !== undefined ? isActive : true,
        isTemplate: isTemplate !== undefined ? isTemplate : false,
        triggerType,
        triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null,
        conditions: conditions ? JSON.stringify(conditions) : null,
        actions: JSON.stringify(actions),
        createdById: userId!,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.status(201).json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      isTemplate: workflow.isTemplate,
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : null,
      conditions: workflow.conditions ? JSON.parse(workflow.conditions) : null,
      actions: JSON.parse(workflow.actions),
      version: workflow.version,
      createdBy: workflow.createdBy,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create workflow',
    });
  }
});

// PUT /api/workflows/:id - Update workflow (ADMIN, MANAGER only)
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, isTemplate, triggerType, triggerConfig, conditions, actions } =
      req.body;
    const userId = req.user?.userId;

    const existingWorkflow = await prisma.workflow.findUnique({ where: { id } });

    if (!existingWorkflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    // Validate trigger type if provided
    if (triggerType) {
      const validTriggerTypes = [
        'CLIENT_CREATED',
        'CLIENT_STATUS_CHANGED',
        'DOCUMENT_UPLOADED',
        'DOCUMENT_STATUS_CHANGED',
        'TASK_DUE',
        'TASK_COMPLETED',
        'MANUAL',
      ];

      if (!validTriggerTypes.includes(triggerType)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid trigger type. Must be one of: ${validTriggerTypes.join(', ')}`,
        });
      }
    }

    // Validate actions JSON if provided
    if (actions && !validateActions(actions)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Actions must be a non-empty array with valid action objects',
      });
    }

    // Validate conditions JSON if provided
    if (conditions && !validateConditions(conditions)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Conditions must be a valid object',
      });
    }

    // Increment version if actions, conditions, or trigger config changes
    let version = existingWorkflow.version;
    if (actions || conditions || triggerConfig) {
      version = version + 1;
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(isTemplate !== undefined && { isTemplate }),
        ...(triggerType !== undefined && { triggerType }),
        ...(triggerConfig !== undefined && { triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null }),
        ...(conditions !== undefined && { conditions: conditions ? JSON.stringify(conditions) : null }),
        ...(actions !== undefined && { actions: JSON.stringify(actions) }),
        ...(version !== existingWorkflow.version && { version }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      isTemplate: workflow.isTemplate,
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : null,
      conditions: workflow.conditions ? JSON.parse(workflow.conditions) : null,
      actions: JSON.parse(workflow.actions),
      version: workflow.version,
      createdBy: workflow.createdBy,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update workflow',
    });
  }
});

// DELETE /api/workflows/:id - Delete workflow (ADMIN only)
router.delete('/:id', authorizeRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingWorkflow = await prisma.workflow.findUnique({ where: { id } });

    if (!existingWorkflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    // Delete workflow (cascade will delete executions and logs)
    await prisma.workflow.delete({ where: { id } });

    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete workflow',
    });
  }
});

// PATCH /api/workflows/:id/toggle - Toggle workflow active status (ADMIN, MANAGER only)
router.patch('/:id/toggle', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingWorkflow = await prisma.workflow.findUnique({ where: { id } });

    if (!existingWorkflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: { isActive: !existingWorkflow.isActive },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      isTemplate: workflow.isTemplate,
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : null,
      conditions: workflow.conditions ? JSON.parse(workflow.conditions) : null,
      actions: JSON.parse(workflow.actions),
      version: workflow.version,
      createdBy: workflow.createdBy,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to toggle workflow',
    });
  }
});

// POST /api/workflows/test-action - Test endpoint for workflow actions (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-action', async (req: AuthRequest, res: Response) => {
    try {
      const { actionType, config, context } = req.body;
      const { executeDocumentAction, executeCommunicationAction, executeTaskAction, executeClientAction } = await import('../services/actionExecutor.js');

      if (!actionType || !config || !context) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'actionType, config, and context are required',
        });
      }

      // Determine action category and execute
      let result;
      const documentActions = ['UPDATE_DOCUMENT_STATUS', 'REQUEST_DOCUMENT'];
      const communicationActions = ['SEND_EMAIL', 'SEND_SMS', 'GENERATE_LETTER'];
      const taskActions = ['CREATE_TASK', 'COMPLETE_TASK', 'ASSIGN_TASK'];
      const clientActions = ['UPDATE_CLIENT_STATUS', 'ADD_TAG', 'REMOVE_TAG', 'ASSIGN_CLIENT'];

      if (documentActions.includes(actionType)) {
        result = await executeDocumentAction(actionType, config, context);
      } else if (communicationActions.includes(actionType)) {
        result = await executeCommunicationAction(actionType, config, context);
      } else if (taskActions.includes(actionType)) {
        result = await executeTaskAction(actionType, config, context);
      } else if (clientActions.includes(actionType)) {
        result = await executeClientAction(actionType, config, context);
      } else {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unknown action type: ${actionType}`,
        });
      }

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error executing test action:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to execute action',
      });
    }
  });
}

export default router;
