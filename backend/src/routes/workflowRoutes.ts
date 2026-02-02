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
        type: 'TASK_CREATED',
        label: 'Task Created',
        description: 'Triggered when a new task is created',
        configFields: [
          {
            name: 'priority',
            type: 'select',
            label: 'Priority',
            options: ['LOW', 'MEDIUM', 'HIGH'],
            description: 'Only trigger for tasks with this priority (leave empty for all)',
          },
        ],
      },
      {
        type: 'TASK_ASSIGNED',
        label: 'Task Assigned',
        description: 'Triggered when a task is assigned to a user',
        configFields: [
          {
            name: 'assignedToId',
            type: 'text',
            label: 'Assigned To User ID',
            description: 'Only trigger when assigned to this specific user (leave empty for all)',
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
        type: 'NOTE_CREATED',
        label: 'Note Created',
        description: 'Triggered when a note is created',
        configFields: [],
      },
      {
        type: 'NOTE_WITH_TAG',
        label: 'Note with Tag',
        description: 'Triggered when a note is created with a specific tag',
        configFields: [
          {
            name: 'tag',
            type: 'text',
            label: 'Tag Name',
            description: 'Only trigger when this specific tag is added to a note',
          },
        ],
      },
      {
        type: 'CLIENT_INACTIVITY',
        label: 'Client Inactivity',
        description: 'Triggered when a client has been inactive for a specified period',
        configFields: [
          {
            name: 'inactiveDays',
            type: 'number',
            label: 'Inactive Days',
            description: 'Number of days of inactivity to trigger the workflow',
            default: 7,
          },
        ],
      },
      {
        type: 'DOCUMENT_DUE_DATE',
        label: 'Document Due Date',
        description: 'Triggered when a document due date is approaching or has passed',
        configFields: [
          {
            name: 'daysBefore',
            type: 'number',
            label: 'Days Before Due Date',
            description: 'Trigger this many days before the due date (use 0 for due date, negative for after)',
            default: 3,
          },
          {
            name: 'daysAfter',
            type: 'number',
            label: 'Days After Due Date',
            description: 'Also trigger after due date until this many days past (0 means only before)',
            default: 0,
          },
        ],
      },
      {
        type: 'DOCUMENT_EXPIRED',
        label: 'Document Expired',
        description: 'Triggered when a document has expired (expiration date passed)',
        configFields: [],
      },
      {
        type: 'TASK_OVERDUE',
        label: 'Task Overdue',
        description: 'Triggered when a task becomes overdue',
        configFields: [
          {
            name: 'priority',
            type: 'select',
            label: 'Priority',
            options: ['LOW', 'MEDIUM', 'HIGH'],
            description: 'Only trigger for tasks with this priority (leave empty for all)',
          },
          {
            name: 'overdueDays',
            type: 'number',
            label: 'Overdue Days',
            description: 'Number of days overdue to trigger (0 means immediately overdue)',
            default: 0,
          },
        ],
      },
      {
        type: 'PIPELINE_STAGE_ENTRY',
        label: 'Pipeline Stage Entry',
        description: 'Triggered when a client enters a pipeline stage',
        configFields: [
          {
            name: 'stage',
            type: 'select',
            label: 'Stage',
            description: 'Only trigger when entering this specific stage (leave empty for all stages)',
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
        ],
      },
      {
        type: 'PIPELINE_STAGE_EXIT',
        label: 'Pipeline Stage Exit',
        description: 'Triggered when a client exits a pipeline stage',
        configFields: [
          {
            name: 'fromStage',
            type: 'select',
            label: 'From Stage',
            description: 'Only trigger when exiting this specific stage (leave empty for all stages)',
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
          {
            name: 'toStage',
            type: 'select',
            label: 'To Stage',
            description: 'Only trigger when moving to this specific stage (leave empty for all stages)',
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
        ],
      },
      {
        type: 'TIME_IN_STAGE_THRESHOLD',
        label: 'Time in Stage Threshold',
        description: 'Triggered when a client has been in a stage too long',
        configFields: [
          {
            name: 'stage',
            type: 'select',
            label: 'Stage',
            description: 'Only check clients in this stage (leave empty to check all stages)',
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
          {
            name: 'thresholdDays',
            type: 'number',
            label: 'Threshold Days',
            description: 'Number of days in stage to trigger the workflow',
            default: 30,
          },
        ],
      },
      {
        type: 'SCHEDULED',
        label: 'Scheduled',
        description: 'Triggered on a recurring schedule (daily, weekly, monthly)',
        configFields: [
          {
            name: 'schedule',
            type: 'select',
            label: 'Schedule',
            options: ['daily', 'weekly', 'monthly'],
            description: 'How often to trigger the workflow',
          },
          {
            name: 'time',
            type: 'time',
            label: 'Time',
            description: 'Time of day to trigger (HH:MM format)',
          },
          {
            name: 'dayOfWeek',
            type: 'number',
            label: 'Day of Week',
            description: 'For weekly schedules: 0=Sunday, 1=Monday, etc.',
          },
          {
            name: 'dayOfMonth',
            type: 'number',
            label: 'Day of Month',
            description: 'For monthly schedules: 1-31',
          },
        ],
      },
      {
        type: 'DATE_BASED',
        label: 'Date Based',
        description: 'Triggered on a specific date or relative to a client field',
        configFields: [
          {
            name: 'dateField',
            type: 'select',
            label: 'Date Field',
            options: ['client.createdAt', 'client.updatedAt', 'custom'],
            description: 'Which date field to use for triggering',
          },
          {
            name: 'customDate',
            type: 'date',
            label: 'Custom Date',
            description: 'Specific date to trigger (only if dateField is "custom")',
          },
          {
            name: 'offsetDays',
            type: 'number',
            label: 'Offset Days',
            description: 'Number of days before/after the date to trigger (negative for before, positive for after)',
          },
        ],
      },
      {
        type: 'MANUAL',
        label: 'Manual Trigger',
        description: 'Triggered manually by a user',
        configFields: [],
      },
      {
        type: 'WEBHOOK',
        label: 'Webhook',
        description: 'Triggered by an external system via webhook',
        configFields: [
          {
            name: 'secret',
            type: 'text',
            label: 'Webhook Secret',
            description: 'Secret key for verifying webhook signatures (leave empty to auto-generate)',
            required: false,
          },
        ],
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
        type: 'UPDATE_CLIENT_STATUS',
        label: 'Update Client Status',
        description: 'Change the status of a client',
        configFields: [
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            required: true,
            options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
          },
        ],
      },
      {
        type: 'ADD_TAG',
        label: 'Add Tag',
        description: 'Add tags to a client',
        configFields: [
          {
            name: 'tags',
            type: 'text',
            label: 'Tags',
            required: true,
            description: 'Comma-separated list of tags to add',
          },
        ],
      },
      {
        type: 'REMOVE_TAG',
        label: 'Remove Tag',
        description: 'Remove tags from a client',
        configFields: [
          {
            name: 'tags',
            type: 'text',
            label: 'Tags',
            required: true,
            description: 'Comma-separated list of tags to remove',
          },
        ],
      },
      {
        type: 'ASSIGN_CLIENT',
        label: 'Assign Client',
        description: 'Assign or reassign a client to a user',
        configFields: [
          {
            name: 'assignedToId',
            type: 'select',
            label: 'Assign To',
            required: true,
            description: 'User to assign the client to',
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
        type: 'SEND_NOTIFICATION',
        label: 'Send Notification',
        description: 'Send an in-app notification to a user',
        configFields: [
          {
            name: 'userId',
            type: 'select',
            label: 'User',
            description: 'User to notify (leave blank to use workflow creator)',
          },
          {
            name: 'title',
            type: 'text',
            label: 'Title',
            required: true,
          },
          {
            name: 'message',
            type: 'textarea',
            label: 'Message',
            required: true,
          },
          {
            name: 'link',
            type: 'text',
            label: 'Link',
            description: 'Optional link to related resource',
          },
        ],
      },
      {
        type: 'CALL_WEBHOOK',
        label: 'Call Webhook',
        description: 'Call an external webhook/API with optional retry logic',
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
            options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            default: 'POST',
          },
          {
            name: 'headers',
            type: 'json',
            label: 'Headers',
            description: 'JSON object of headers (e.g., {"Authorization": "Bearer token"})',
          },
          {
            name: 'bodyTemplate',
            type: 'textarea',
            label: 'Body Template',
            description: 'JSON body template with placeholders (use {{client_name}}, {{client_email}}, etc.)',
          },
          {
            name: 'retryOnFailure',
            type: 'checkbox',
            label: 'Retry on Failure',
            default: true,
          },
          {
            name: 'maxRetries',
            type: 'number',
            label: 'Max Retries',
            default: 3,
            description: 'Maximum number of retry attempts',
          },
          {
            name: 'retryDelaySeconds',
            type: 'number',
            label: 'Retry Delay (seconds)',
            default: 5,
            description: 'Delay between retry attempts',
          },
          {
            name: 'timeoutSeconds',
            type: 'number',
            label: 'Timeout (seconds)',
            default: 30,
            description: 'Request timeout in seconds',
          },
        ],
      },
      {
        type: 'WAIT',
        label: 'Wait',
        description: 'Pause workflow execution for a specified period',
        configFields: [
          {
            name: 'duration',
            type: 'number',
            label: 'Duration',
            required: true,
            default: 1,
          },
          {
            name: 'unit',
            type: 'select',
            label: 'Unit',
            required: true,
            options: ['minutes', 'hours', 'days'],
            default: 'hours',
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
      'CLIENT_INACTIVITY',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_STATUS_CHANGED',
      'DOCUMENT_DUE_DATE',
      'DOCUMENT_EXPIRED',
      'TASK_CREATED',
      'TASK_ASSIGNED',
      'TASK_DUE',
      'TASK_OVERDUE',
      'TASK_COMPLETED',
      'NOTE_CREATED',
      'NOTE_WITH_TAG',
      'SCHEDULED',
      'DATE_BASED',
      'PIPELINE_STAGE_ENTRY',
      'PIPELINE_STAGE_EXIT',
      'TIME_IN_STAGE_THRESHOLD',
      'MANUAL',
      'WEBHOOK',
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
        'CLIENT_INACTIVITY',
        'DOCUMENT_UPLOADED',
        'DOCUMENT_STATUS_CHANGED',
        'DOCUMENT_DUE_DATE',
        'DOCUMENT_EXPIRED',
        'TASK_CREATED',
        'TASK_ASSIGNED',
        'TASK_DUE',
        'TASK_OVERDUE',
        'TASK_COMPLETED',
        'PIPELINE_STAGE_ENTRY',
        'PIPELINE_STAGE_EXIT',
        'TIME_IN_STAGE_THRESHOLD',
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
    const shouldCreateVersion = actions || conditions || triggerConfig;

    if (shouldCreateVersion) {
      version = version + 1;

      // Save current version to workflow_versions before updating
      await prisma.workflowVersion.create({
        data: {
          workflowId: existingWorkflow.id,
          version: existingWorkflow.version,
          name: existingWorkflow.name,
          description: existingWorkflow.description,
          triggerType: existingWorkflow.triggerType,
          triggerConfig: existingWorkflow.triggerConfig,
          conditions: existingWorkflow.conditions,
          actions: existingWorkflow.actions,
          createdById: existingWorkflow.createdById,
        },
      });
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

// POST /api/workflows/:id/clone - Clone workflow (ADMIN, MANAGER only)
router.post('/:id/clone', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const existingWorkflow = await prisma.workflow.findUnique({ where: { id } });

    if (!existingWorkflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    // Clone the workflow with modified name and reset values
    const clonedName = `${existingWorkflow.name} (Copy)`;
    const clonedWorkflow = await prisma.workflow.create({
      data: {
        name: clonedName,
        description: existingWorkflow.description,
        isActive: false, // Always start as inactive
        isTemplate: false, // Cloned workflows are not templates
        triggerType: existingWorkflow.triggerType,
        triggerConfig: existingWorkflow.triggerConfig,
        conditions: existingWorkflow.conditions,
        actions: existingWorkflow.actions,
        version: 1, // Reset to version 1
        createdById: userId!,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.status(201).json({
      id: clonedWorkflow.id,
      name: clonedWorkflow.name,
      description: clonedWorkflow.description,
      isActive: clonedWorkflow.isActive,
      isTemplate: clonedWorkflow.isTemplate,
      triggerType: clonedWorkflow.triggerType,
      triggerConfig: clonedWorkflow.triggerConfig ? JSON.parse(clonedWorkflow.triggerConfig) : null,
      conditions: clonedWorkflow.conditions ? JSON.parse(clonedWorkflow.conditions) : null,
      actions: JSON.parse(clonedWorkflow.actions),
      version: clonedWorkflow.version,
      createdBy: clonedWorkflow.createdBy,
      createdAt: clonedWorkflow.createdAt,
      updatedAt: clonedWorkflow.updatedAt,
    });
  } catch (error) {
    console.error('Error cloning workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clone workflow',
    });
  }
});

// POST /api/workflows/test-action - Test endpoint for workflow actions (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-action', async (req: AuthRequest, res: Response) => {
    try {
      const { actionType, config, context } = req.body;
      const {
        executeDocumentAction,
        executeCommunicationAction,
        executeTaskAction,
        executeClientAction,
        executeNoteAction,
        executeNotificationAction,
        executeFlowControlAction,
        executeWebhookAction
      } = await import('../services/actionExecutor.js');

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
      const noteActions = ['CREATE_NOTE'];
      const notificationActions = ['SEND_NOTIFICATION', 'LOG_ACTIVITY'];
      const flowControlActions = ['WAIT', 'BRANCH', 'PARALLEL'];
      const webhookActions = ['CALL_WEBHOOK'];

      if (documentActions.includes(actionType)) {
        result = await executeDocumentAction(actionType, config, context);
      } else if (communicationActions.includes(actionType)) {
        result = await executeCommunicationAction(actionType, config, context);
      } else if (taskActions.includes(actionType)) {
        result = await executeTaskAction(actionType, config, context);
      } else if (clientActions.includes(actionType)) {
        result = await executeClientAction(actionType, config, context);
      } else if (noteActions.includes(actionType)) {
        result = await executeNoteAction(actionType, config, context);
      } else if (notificationActions.includes(actionType)) {
        result = await executeNotificationAction(actionType, config, context);
      } else if (flowControlActions.includes(actionType)) {
        result = await executeFlowControlAction(actionType, config, context);
      } else if (webhookActions.includes(actionType)) {
        result = await executeWebhookAction(actionType, config, context);
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

// POST /api/workflows/test-condition - Test endpoint for condition evaluation (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-condition', async (req: AuthRequest, res: Response) => {
    try {
      const { conditions, clientId } = req.body;
      const { testConditionEvaluation } = await import('../services/conditionEvaluator.js');

      if (!conditions) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'conditions are required',
        });
      }

      if (!clientId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'clientId is required',
        });
      }

      const result = await testConditionEvaluation(conditions, clientId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error evaluating test condition:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to evaluate condition',
      });
    }
  });
}

// =============================================================================
// WORKFLOW EXECUTION ROUTES
// =============================================================================

// POST /api/workflows/:id/execute - Manually execute a workflow
router.post('/:id/execute', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { clientId, triggerData } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Validate workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    // Validate clientId if provided
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Client not found',
        });
      }
    }

    // Execute workflow
    const { executeWorkflow } = await import('../services/workflowExecutor.js');
    const result = await executeWorkflow(id, {
      clientId,
      triggerType: 'MANUAL',
      triggerData,
      userId,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to execute workflow',
    });
  }
});

// POST /api/workflows/:id/test - Test workflow without executing (dry run)
router.post('/:id/test', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { clientId, triggerData } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Validate workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    // Validate clientId if provided
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Client not found',
        });
      }
    }

    // Test workflow (dry run)
    const { testWorkflow } = await import('../services/workflowExecutor.js');
    const result = await testWorkflow(id, {
      clientId,
      triggerType: 'MANUAL',
      triggerData,
      userId,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error testing workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to test workflow',
    });
  }
});

// POST /api/workflows/:id/trigger - Manually trigger a workflow
router.post('/:id/trigger', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { clientId, triggerData } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Validate workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    // Validate clientId if provided
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Client not found',
        });
      }
    }

    // Execute workflow
    const { executeWorkflow } = await import('../services/workflowExecutor.js');
    const result = await executeWorkflow(id, {
      clientId,
      triggerType: 'MANUAL',
      triggerData,
      userId,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Workflow triggered successfully',
        executionId: result.executionId,
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error triggering workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to trigger workflow',
    });
  }
});

// GET /api/workflows/:id/versions - Get workflow version history
router.get('/:id/versions', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { version: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const formattedVersions = versions.map((v) => ({
      id: v.id,
      version: v.version,
      name: v.name,
      description: v.description,
      triggerType: v.triggerType,
      triggerConfig: v.triggerConfig ? JSON.parse(v.triggerConfig) : null,
      conditions: v.conditions ? JSON.parse(v.conditions) : null,
      actions: JSON.parse(v.actions),
      createdAt: v.createdAt,
      createdBy: v.createdBy,
    }));

    res.json({ versions: formattedVersions });
  } catch (error) {
    console.error('Error fetching workflow versions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch workflow versions',
    });
  }
});

// POST /api/workflows/:id/rollback/:version - Rollback workflow to specific version
router.post(
  '/:id/rollback/:version',
  authorizeRoles('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, version } = req.params;
      const targetVersion = parseInt(version, 10);
      const userId = req.user?.userId;

      const existingWorkflow = await prisma.workflow.findUnique({ where: { id } });

      if (!existingWorkflow) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Workflow not found',
        });
      }

      // Find the target version
      const targetWorkflowVersion = await prisma.workflowVersion.findFirst({
        where: {
          workflowId: id,
          version: targetVersion,
        },
      });

      if (!targetWorkflowVersion) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Version ${targetVersion} not found`,
        });
      }

      // Save current version before rolling back
      await prisma.workflowVersion.create({
        data: {
          workflowId: existingWorkflow.id,
          version: existingWorkflow.version,
          name: existingWorkflow.name,
          description: existingWorkflow.description,
          triggerType: existingWorkflow.triggerType,
          triggerConfig: existingWorkflow.triggerConfig,
          conditions: existingWorkflow.conditions,
          actions: existingWorkflow.actions,
          createdById: existingWorkflow.createdById,
        },
      });

      // Rollback to target version
      const newVersion = existingWorkflow.version + 1;
      const workflow = await prisma.workflow.update({
        where: { id },
        data: {
          name: targetWorkflowVersion.name,
          description: targetWorkflowVersion.description,
          triggerType: targetWorkflowVersion.triggerType,
          triggerConfig: targetWorkflowVersion.triggerConfig,
          conditions: targetWorkflowVersion.conditions,
          actions: targetWorkflowVersion.actions,
          version: newVersion,
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
        message: `Rolled back from version ${targetVersion} to new version ${newVersion}`,
      });
    } catch (error) {
      console.error('Error rolling back workflow:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to rollback workflow',
      });
    }
  }
);

// =============================================================================
// WORKFLOW EXECUTION CONTROL ROUTES
// =============================================================================

// GET /api/workflows/executions - List workflow executions with filtering
router.get('/executions', async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      client_id,
      workflow_id,
      status,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (client_id) {
      where.clientId = client_id as string;
    }

    if (workflow_id) {
      where.workflowId = workflow_id as string;
    }

    if (status) {
      where.status = status as string;
    }

    // Get total count
    const total = await prisma.workflowExecution.count({ where });

    // Get executions with pagination
    const executions = await prisma.workflowExecution.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        workflow: {
          select: { id: true, name: true, triggerType: true },
        },
        client: {
          select: { id: true, nameEncrypted: true },
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

// POST /api/workflows/executions/:id/pause - Pause a running workflow execution
router.post('/executions/:id/pause', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        workflow: true,
      },
    });

    if (!execution) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow execution not found',
      });
    }

    // Can only pause running executions
    if (execution.status !== 'RUNNING') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot pause execution with status ${execution.status}. Only RUNNING executions can be paused.`,
      });
    }

    // Update execution status to PAUSED
    const updatedExecution = await prisma.workflowExecution.update({
      where: { id },
      data: { status: 'PAUSED' },
      include: {
        workflow: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, nameEncrypted: true },
        },
      },
    });

    res.json({
      id: updatedExecution.id,
      status: updatedExecution.status,
      workflow: updatedExecution.workflow,
      clientId: updatedExecution.clientId,
      currentStep: updatedExecution.currentStep,
      message: 'Workflow execution paused successfully',
    });
  } catch (error) {
    console.error('Error pausing workflow execution:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to pause workflow execution',
    });
  }
});

// POST /api/workflows/executions/:id/resume - Resume a paused workflow execution
router.post('/executions/:id/resume', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        workflow: true,
      },
    });

    if (!execution) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow execution not found',
      });
    }

    // Can only resume paused executions
    if (execution.status !== 'PAUSED') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot resume execution with status ${execution.status}. Only PAUSED executions can be resumed.`,
      });
    }

    // Update execution status back to RUNNING
    const updatedExecution = await prisma.workflowExecution.update({
      where: { id },
      data: { status: 'RUNNING' },
      include: {
        workflow: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, nameEncrypted: true },
        },
      },
    });

    // Trigger workflow executor to continue from current step
    const { resumeWorkflowExecution } = await import('../services/workflowExecutor.js');
    const result = await resumeWorkflowExecution(id, {
      clientId: execution.clientId || undefined,
      triggerType: 'MANUAL',
      triggerData: execution.triggerData ? JSON.parse(execution.triggerData) : undefined,
      userId: userId || execution.workflow.createdById,
    });

    if (result.success) {
      res.json({
        id: updatedExecution.id,
        status: updatedExecution.status,
        workflow: updatedExecution.workflow,
        clientId: updatedExecution.clientId,
        currentStep: updatedExecution.currentStep,
        message: 'Workflow execution resumed successfully',
      });
    } else {
      // If resume failed, set status back to PAUSED
      await prisma.workflowExecution.update({
        where: { id },
        data: { status: 'PAUSED' },
      });

      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error resuming workflow execution:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to resume workflow execution',
    });
  }
});

// =============================================================================
// WORKFLOW IMPORT/EXPORT ROUTES
// =============================================================================

// GET /api/workflows/:id/export - Export workflow as JSON
router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    // Create export object with all workflow data
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflow: {
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
      },
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '_')}_workflow.json"`);

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export workflow',
    });
  }
});

// POST /api/workflows/import - Import workflow from JSON
router.post('/import', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { workflowData, asTemplate = false } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Validate workflowData exists
    if (!workflowData) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Workflow data is required',
      });
    }

    // Support both direct workflow data and wrapped export format
    const workflowToImport = workflowData.workflow || workflowData;

    // Validate required fields
    const { name, triggerType, actions } = workflowToImport;

    if (!name || !triggerType || !actions) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid workflow data. Name, trigger type, and actions are required.',
      });
    }

    // Validate trigger type
    const validTriggerTypes = [
      'CLIENT_CREATED',
      'CLIENT_STATUS_CHANGED',
      'CLIENT_INACTIVITY',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_STATUS_CHANGED',
      'DOCUMENT_DUE_DATE',
      'DOCUMENT_EXPIRED',
      'TASK_CREATED',
      'TASK_ASSIGNED',
      'TASK_DUE',
      'TASK_OVERDUE',
      'TASK_COMPLETED',
      'NOTE_CREATED',
      'NOTE_WITH_TAG',
      'SCHEDULED',
      'DATE_BASED',
      'PIPELINE_STAGE_ENTRY',
      'PIPELINE_STAGE_EXIT',
      'TIME_IN_STAGE_THRESHOLD',
      'MANUAL',
      'WEBHOOK',
    ];

    if (!validTriggerTypes.includes(triggerType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid trigger type: ${triggerType}`,
      });
    }

    // Validate actions
    if (!validateActions(actions)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Actions must be a non-empty array with valid action objects',
      });
    }

    // Validate conditions if present
    const { conditions } = workflowToImport;
    if (conditions && !validateConditions(conditions)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Conditions must be a valid object',
      });
    }

    // Check if workflow with same name exists
    const existingWorkflow = await prisma.workflow.findFirst({
      where: { name },
    });

    let finalName = name;
    if (existingWorkflow) {
      // Append timestamp to avoid name conflicts
      finalName = `${name} (Imported ${new Date().toISOString().split('T')[0]})`;
    }

    // Create the imported workflow
    const importedWorkflow = await prisma.workflow.create({
      data: {
        name: finalName,
        description: workflowToImport.description || '',
        isActive: asTemplate ? false : (workflowToImport.isActive ?? false),
        isTemplate: asTemplate || workflowToImport.isTemplate || false,
        triggerType,
        triggerConfig: workflowToImport.triggerConfig
          ? JSON.stringify(workflowToImport.triggerConfig)
          : null,
        conditions: workflowToImport.conditions
          ? JSON.stringify(workflowToImport.conditions)
          : null,
        actions: JSON.stringify(actions),
        version: 1, // Reset to version 1 for imported workflows
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.status(201).json({
      id: importedWorkflow.id,
      name: importedWorkflow.name,
      description: importedWorkflow.description,
      isActive: importedWorkflow.isActive,
      isTemplate: importedWorkflow.isTemplate,
      triggerType: importedWorkflow.triggerType,
      triggerConfig: importedWorkflow.triggerConfig ? JSON.parse(importedWorkflow.triggerConfig) : null,
      conditions: importedWorkflow.conditions ? JSON.parse(importedWorkflow.conditions) : null,
      actions: JSON.parse(importedWorkflow.actions),
      version: importedWorkflow.version,
      createdBy: importedWorkflow.createdBy,
      createdAt: importedWorkflow.createdAt,
      updatedAt: importedWorkflow.updatedAt,
      message: 'Workflow imported successfully',
    });
  } catch (error) {
    console.error('Error importing workflow:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to import workflow',
    });
  }
});

// =============================================================================
// WEBHOOK ROUTES
// =============================================================================

// POST /api/webhooks/:workflow_id - Receive webhook trigger from external systems
// This endpoint does NOT require authentication - it's for external systems
router.post('/webhooks/:workflow_id', async (req: any, res: Response) => {
  try {
    const { workflow_id } = req.params;
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const payload = JSON.stringify(req.body);

    // Get workflow
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflow_id },
    });

    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    if (!workflow.isActive) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Workflow is not active',
      });
    }

    if (workflow.triggerType !== 'WEBHOOK') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Workflow is not a webhook trigger',
      });
    }

    // Get webhook secret from trigger config
    const triggerConfig = workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : {};
    const secret = triggerConfig.secret;

    // Verify signature if secret is configured
    if (secret && signature) {
      const { verifyWebhookSignature } = await import('../services/triggerHandler.js');
      const isValid = verifyWebhookSignature(payload, signature, secret);

      if (!isValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
        });
      }
    } else if (secret && !signature) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Webhook signature is required',
      });
    }

    // Parse webhook payload
    const webhookData = req.body;
    let clientId: string | undefined;
    let userId: string | undefined;

    // Extract clientId and userId from payload if provided
    if (webhookData.clientId) {
      clientId = String(webhookData.clientId);
    }
    if (webhookData.userId) {
      userId = String(webhookData.userId);
    }

    // Validate clientId if provided
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Client not found',
        });
      }
    }

    // Fire webhook trigger
    const { fireWebhookTrigger } = await import('../services/triggerHandler.js');
    await fireWebhookTrigger(workflow_id, webhookData, clientId, userId);

    res.json({
      success: true,
      message: 'Webhook received and workflow triggered',
      workflowId: workflow_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to process webhook',
    });
  }
});

export default router;
