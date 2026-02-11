import prisma from '../utils/prisma.js';
import { ServiceError } from './taskService.js';
import { decodeClientPiiField } from '../utils/clientPiiCodec.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function assertFound<T>(value: T | null | undefined, entity = 'Resource'): asserts value is T {
  if (value === null || value === undefined) {
    throw new ServiceError(404, 'Not Found', `${entity} not found`);
  }
}

export const VALID_TRIGGER_TYPES = [
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
] as const;

export function validateActions(actions: any): boolean {
  if (!Array.isArray(actions)) return false;
  if (actions.length === 0) return false;
  return actions.every(
    (action: any) => typeof action === 'object' && action !== null && typeof action.type === 'string' && action.type.length > 0,
  );
}

export function validateConditions(conditions: any): boolean {
  if (!conditions) return true;
  if (typeof conditions !== 'object') return false;
  if (Array.isArray(conditions)) return false;
  return true;
}

/** Format a raw Prisma workflow row into the API response shape. */
function formatWorkflow(w: any) {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    isActive: w.isActive,
    isTemplate: w.isTemplate,
    triggerType: w.triggerType,
    triggerConfig: w.triggerConfig ? JSON.parse(w.triggerConfig) : null,
    conditions: w.conditions ? JSON.parse(w.conditions) : null,
    actions: JSON.parse(w.actions),
    version: w.version,
    ...(w._count && { executionCount: w._count.executions }),
    ...(w.createdBy && { createdBy: w.createdBy }),
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

/** Decrypt an encrypted client name (best-effort). */
function decodeClientName(encrypted: string | null): string {
  if (!encrypted) return 'Unknown';
  const decoded = decodeClientPiiField(encrypted).trim();
  return decoded || 'Unknown';
}

const CREATED_BY_SELECT = { id: true, name: true, email: true, role: true } as const;

// ─── core CRUD ──────────────────────────────────────────────────────────────

export interface ListWorkflowsParams {
  page?: number;
  limit?: number;
  isActive?: string;
  isTemplate?: string;
  triggerType?: string;
  search?: string;
}

export async function listWorkflows(params: ListWorkflowsParams) {
  const { page = 1, limit = 20, isActive, isTemplate, triggerType, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (isTemplate !== undefined) where.isTemplate = isTemplate === 'true';
  if (triggerType) where.triggerType = triggerType;
  if (search) {
    where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
  }

  const [workflows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: CREATED_BY_SELECT }, _count: { select: { executions: true } } },
    }),
    prisma.workflow.count({ where }),
  ]);

  return {
    workflows: workflows.map(formatWorkflow),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getWorkflow(id: string) {
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: {
      createdBy: { select: CREATED_BY_SELECT },
      executions: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { id: true, nameEncrypted: true } } },
      },
    },
  });
  assertFound(workflow, 'Workflow');

  const formattedExecutions = workflow.executions.map((e) => ({
    id: e.id,
    clientId: e.clientId,
    clientName: e.client ? decodeClientName(e.client.nameEncrypted) : 'Unknown',
    status: e.status,
    currentStep: e.currentStep,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    errorMessage: e.errorMessage,
    createdAt: e.createdAt,
  }));

  return {
    ...formatWorkflow(workflow),
    executions: formattedExecutions,
  };
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  triggerType: string;
  triggerConfig?: any;
  conditions?: any;
  actions: any;
}

export async function createWorkflow(data: CreateWorkflowData, userId: string) {
  if (!data.name || !data.triggerType || !data.actions)
    throw new ServiceError(400, 'Validation Error', 'Name, trigger type, and actions are required');
  if (!(VALID_TRIGGER_TYPES as readonly string[]).includes(data.triggerType))
    throw new ServiceError(400, 'Validation Error', `Invalid trigger type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`);
  if (!validateActions(data.actions))
    throw new ServiceError(400, 'Validation Error', 'Actions must be a non-empty array with valid action objects');
  if (!validateConditions(data.conditions))
    throw new ServiceError(400, 'Validation Error', 'Conditions must be a valid object');

  const workflow = await prisma.workflow.create({
    data: {
      name: data.name,
      description: data.description,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isTemplate: data.isTemplate !== undefined ? data.isTemplate : false,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
      conditions: data.conditions ? JSON.stringify(data.conditions) : null,
      actions: JSON.stringify(data.actions),
      createdById: userId,
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  return formatWorkflow(workflow);
}

export interface UpdateWorkflowData {
  name?: string;
  description?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  triggerType?: string;
  triggerConfig?: any;
  conditions?: any;
  actions?: any;
}

export async function updateWorkflow(id: string, data: UpdateWorkflowData) {
  const existing = await prisma.workflow.findUnique({ where: { id } });
  assertFound(existing, 'Workflow');

  if (data.triggerType && !(VALID_TRIGGER_TYPES as readonly string[]).includes(data.triggerType))
    throw new ServiceError(400, 'Validation Error', `Invalid trigger type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`);
  if (data.actions && !validateActions(data.actions))
    throw new ServiceError(400, 'Validation Error', 'Actions must be a non-empty array with valid action objects');
  if (data.conditions && !validateConditions(data.conditions))
    throw new ServiceError(400, 'Validation Error', 'Conditions must be a valid object');

  // Increment version if logic changes
  let version = existing.version;
  if (data.actions || data.conditions || data.triggerConfig) {
    version += 1;
    await prisma.workflowVersion.create({
      data: {
        workflowId: existing.id,
        version: existing.version,
        name: existing.name,
        description: existing.description,
        triggerType: existing.triggerType,
        triggerConfig: existing.triggerConfig,
        conditions: existing.conditions,
        actions: existing.actions,
        createdById: existing.createdById,
      },
    });
  }

  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.isTemplate !== undefined && { isTemplate: data.isTemplate }),
      ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
      ...(data.triggerConfig !== undefined && { triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : null }),
      ...(data.conditions !== undefined && { conditions: data.conditions ? JSON.stringify(data.conditions) : null }),
      ...(data.actions !== undefined && { actions: JSON.stringify(data.actions) }),
      ...(version !== existing.version && { version }),
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  return formatWorkflow(workflow);
}

export async function deleteWorkflow(id: string) {
  const existing = await prisma.workflow.findUnique({ where: { id } });
  assertFound(existing, 'Workflow');
  await prisma.workflow.delete({ where: { id } });
  return { message: 'Workflow archived successfully' };
}

// ─── toggle / clone ─────────────────────────────────────────────────────────

export async function toggleWorkflow(id: string, userId: string, ip?: string, userAgent?: string) {
  const existing = await prisma.workflow.findUnique({ where: { id } });
  assertFound(existing, 'Workflow');

  const newStatus = !existing.isActive;
  const workflow = await prisma.workflow.update({
    where: { id },
    data: { isActive: newStatus },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  await prisma.activity.create({
    data: {
      userId,
      type: newStatus ? 'WORKFLOW_ENABLED' : 'WORKFLOW_DISABLED',
      description: `Workflow "${workflow.name}" was ${newStatus ? 'enabled' : 'disabled'}`,
      metadata: JSON.stringify({ workflowId: workflow.id, workflowName: workflow.name, previousStatus: existing.isActive, newStatus }),
      ipAddress: ip,
      userAgent,
    },
  });

  return formatWorkflow(workflow);
}

export async function cloneWorkflow(id: string, userId: string) {
  const existing = await prisma.workflow.findUnique({ where: { id } });
  assertFound(existing, 'Workflow');

  const cloned = await prisma.workflow.create({
    data: {
      name: `${existing.name} (Copy)`,
      description: existing.description,
      isActive: false,
      isTemplate: false,
      triggerType: existing.triggerType,
      triggerConfig: existing.triggerConfig,
      conditions: existing.conditions,
      actions: existing.actions,
      version: 1,
      createdById: userId,
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  return formatWorkflow(cloned);
}

// ─── templates ──────────────────────────────────────────────────────────────

export async function listWorkflowTemplates(params: { triggerType?: string; search?: string }) {
  const where: any = { isTemplate: true };
  if (params.triggerType) where.triggerType = params.triggerType;
  if (params.search) {
    where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
  }

  const templates = await prisma.workflow.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { createdBy: { select: CREATED_BY_SELECT }, _count: { select: { executions: true } } },
  });

  return {
    templates: templates.map((t) => ({ ...formatWorkflow(t), usageCount: t._count.executions })),
    count: templates.length,
  };
}

export async function useTemplate(templateId: string, userId: string, name?: string, customize?: any) {
  const template = await prisma.workflow.findUnique({ where: { id: templateId } });
  assertFound(template, 'Workflow template');
  if (!template.isTemplate) throw new ServiceError(400, 'Bad Request', 'This workflow is not a template');

  const workflowName = name || `${template.name} (Custom)`;
  let triggerConfig = template.triggerConfig ? JSON.parse(template.triggerConfig) : null;
  let conditions = template.conditions ? JSON.parse(template.conditions) : null;
  const actions = JSON.parse(template.actions);

  if (customize && typeof customize === 'object') {
    if (customize.triggerConfig && typeof customize.triggerConfig === 'object') {
      triggerConfig = triggerConfig ? { ...triggerConfig, ...customize.triggerConfig } : { ...customize.triggerConfig };
    }
    if (customize.conditions && typeof customize.conditions === 'object') {
      conditions = conditions ? { ...conditions, ...customize.conditions } : { ...customize.conditions };
    }
    if (customize.actions && Array.isArray(customize.actions)) {
      customize.actions.forEach((c: any) => {
        if (c.index !== undefined && actions[c.index]) {
          if (c.config && typeof c.config === 'object') actions[c.index].config = { ...actions[c.index].config, ...c.config };
          if (c.description) actions[c.index].description = c.description;
        }
      });
    }
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: workflowName,
      description: template.description,
      isActive: false,
      isTemplate: false,
      triggerType: template.triggerType,
      triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null,
      conditions: conditions ? JSON.stringify(conditions) : null,
      actions: JSON.stringify(actions),
      version: 1,
      createdById: userId,
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  return { ...formatWorkflow(workflow), message: 'Workflow created from template successfully' };
}

// ─── versions / rollback ────────────────────────────────────────────────────

export async function getVersions(workflowId: string) {
  const versions = await prisma.workflowVersion.findMany({
    where: { workflowId },
    orderBy: { version: 'desc' },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  return {
    versions: versions.map((v) => ({
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
    })),
  };
}

export async function rollbackWorkflow(id: string, targetVersion: number) {
  const existing = await prisma.workflow.findUnique({ where: { id } });
  assertFound(existing, 'Workflow');

  const target = await prisma.workflowVersion.findFirst({ where: { workflowId: id, version: targetVersion } });
  assertFound(target, `Version ${targetVersion}`);

  // Save current version before rollback
  await prisma.workflowVersion.create({
    data: {
      workflowId: existing.id,
      version: existing.version,
      name: existing.name,
      description: existing.description,
      triggerType: existing.triggerType,
      triggerConfig: existing.triggerConfig,
      conditions: existing.conditions,
      actions: existing.actions,
      createdById: existing.createdById,
    },
  });

  const newVersion = existing.version + 1;
  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      name: target.name,
      description: target.description,
      triggerType: target.triggerType,
      triggerConfig: target.triggerConfig,
      conditions: target.conditions,
      actions: target.actions,
      version: newVersion,
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  return { ...formatWorkflow(workflow), message: `Rolled back from version ${targetVersion} to new version ${newVersion}` };
}

// ─── execution ──────────────────────────────────────────────────────────────

export interface ExecuteWorkflowParams {
  clientId?: string;
  triggerData?: any;
  userId: string;
}

async function validateWorkflowAndClient(workflowId: string, clientId?: string) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  assertFound(workflow, 'Workflow');

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new ServiceError(400, 'Bad Request', 'Client not found');
  }

  return workflow;
}

export async function executeManualWorkflow(workflowId: string, params: ExecuteWorkflowParams) {
  await validateWorkflowAndClient(workflowId, params.clientId);
  const { executeWorkflow } = await import('./workflowExecutor.js');
  return executeWorkflow(workflowId, {
    clientId: params.clientId,
    triggerType: 'MANUAL',
    triggerData: params.triggerData,
    userId: params.userId,
  });
}

export async function testWorkflowDryRun(workflowId: string, params: ExecuteWorkflowParams) {
  await validateWorkflowAndClient(workflowId, params.clientId);
  const { testWorkflow } = await import('./workflowExecutor.js');
  return testWorkflow(workflowId, {
    clientId: params.clientId,
    triggerType: 'MANUAL',
    triggerData: params.triggerData,
    userId: params.userId,
  });
}

export async function triggerWorkflow(workflowId: string, params: ExecuteWorkflowParams) {
  await validateWorkflowAndClient(workflowId, params.clientId);
  const { executeWorkflow } = await import('./workflowExecutor.js');
  const result = await executeWorkflow(workflowId, {
    clientId: params.clientId,
    triggerType: 'MANUAL',
    triggerData: params.triggerData,
    userId: params.userId,
  });

  if (result.success) {
    return { success: true, message: 'Workflow triggered successfully', executionId: result.executionId };
  }
  return result;
}

// ─── execution control ──────────────────────────────────────────────────────

export interface ListExecutionsParams {
  page?: number;
  limit?: number;
  clientId?: string;
  workflowId?: string;
  status?: string;
}

export async function listExecutions(params: ListExecutionsParams) {
  const { page = 1, limit = 20, clientId, workflowId, status } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (workflowId) where.workflowId = workflowId;
  if (status) where.status = status;

  const [executions, total] = await Promise.all([
    prisma.workflowExecution.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        workflow: { select: { id: true, name: true, triggerType: true } },
        client: { select: { id: true, nameEncrypted: true } },
      },
    }),
    prisma.workflowExecution.count({ where }),
  ]);

  return {
    executions: executions.map((e) => ({
      id: e.id,
      workflowId: e.workflowId,
      workflowName: e.workflow.name,
      workflowTriggerType: e.workflow.triggerType,
      clientId: e.clientId,
      clientName: e.client ? decodeClientName(e.client.nameEncrypted) : null,
      status: e.status,
      currentStep: e.currentStep,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      errorMessage: e.errorMessage,
      createdAt: e.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function pauseExecution(executionId: string) {
  const execution = await prisma.workflowExecution.findUnique({ where: { id: executionId }, include: { workflow: true } });
  assertFound(execution, 'Workflow execution');
  if (execution.status !== 'RUNNING')
    throw new ServiceError(400, 'Bad Request', `Cannot pause execution with status ${execution.status}. Only RUNNING executions can be paused.`);

  const updated = await prisma.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'PAUSED' },
    include: { workflow: { select: { id: true, name: true } }, client: { select: { id: true, nameEncrypted: true } } },
  });

  return { id: updated.id, status: updated.status, workflow: updated.workflow, clientId: updated.clientId, currentStep: updated.currentStep, message: 'Workflow execution paused successfully' };
}

export async function resumeExecution(executionId: string, userId?: string) {
  const execution = await prisma.workflowExecution.findUnique({ where: { id: executionId }, include: { workflow: true } });
  assertFound(execution, 'Workflow execution');
  if (execution.status !== 'PAUSED')
    throw new ServiceError(400, 'Bad Request', `Cannot resume execution with status ${execution.status}. Only PAUSED executions can be resumed.`);

  const updated = await prisma.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'RUNNING' },
    include: { workflow: { select: { id: true, name: true } }, client: { select: { id: true, nameEncrypted: true } } },
  });

  const { resumeWorkflowExecution } = await import('./workflowExecutor.js');
  const result = await resumeWorkflowExecution(executionId, {
    clientId: execution.clientId || undefined,
    triggerType: 'MANUAL',
    triggerData: execution.triggerData ? JSON.parse(execution.triggerData) : undefined,
    userId: userId || execution.workflow.createdById,
  });

  if (!result.success) {
    await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'PAUSED' } });
    return result;
  }

  return { id: updated.id, status: updated.status, workflow: updated.workflow, clientId: updated.clientId, currentStep: updated.currentStep, message: 'Workflow execution resumed successfully' };
}

// ─── import / export ────────────────────────────────────────────────────────

export async function exportWorkflow(id: string) {
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });
  assertFound(workflow, 'Workflow');

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    workflow: formatWorkflow(workflow),
    fileName: `${workflow.name.replace(/[^a-z0-9]/gi, '_')}_workflow.json`,
  };
}

export async function importWorkflow(workflowData: any, userId: string, asTemplate = false) {
  if (!workflowData) throw new ServiceError(400, 'Validation Error', 'Workflow data is required');

  const toImport = workflowData.workflow || workflowData;
  const { name, triggerType, actions, conditions } = toImport;

  if (!name || !triggerType || !actions)
    throw new ServiceError(400, 'Validation Error', 'Invalid workflow data. Name, trigger type, and actions are required.');
  if (!(VALID_TRIGGER_TYPES as readonly string[]).includes(triggerType))
    throw new ServiceError(400, 'Validation Error', `Invalid trigger type: ${triggerType}`);
  if (!validateActions(actions))
    throw new ServiceError(400, 'Validation Error', 'Actions must be a non-empty array with valid action objects');
  if (conditions && !validateConditions(conditions))
    throw new ServiceError(400, 'Validation Error', 'Conditions must be a valid object');

  const existingWorkflow = await prisma.workflow.findFirst({ where: { name } });
  const finalName = existingWorkflow ? `${name} (Imported ${new Date().toISOString().split('T')[0]})` : name;

  const imported = await prisma.workflow.create({
    data: {
      name: finalName,
      description: toImport.description || '',
      isActive: asTemplate ? false : (toImport.isActive ?? false),
      isTemplate: asTemplate || toImport.isTemplate || false,
      triggerType,
      triggerConfig: toImport.triggerConfig ? JSON.stringify(toImport.triggerConfig) : null,
      conditions: conditions ? JSON.stringify(conditions) : null,
      actions: JSON.stringify(actions),
      version: 1,
      createdById: userId,
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });

  return { ...formatWorkflow(imported), message: 'Workflow imported successfully' };
}

// ─── dev-only test helpers ──────────────────────────────────────────────────

export async function testAction(actionType: string, config: any, context: any) {
  const {
    executeDocumentAction,
    executeCommunicationAction,
    executeTaskAction,
    executeClientAction,
    executeNoteAction,
    executeNotificationAction,
    executeFlowControlAction,
    executeWebhookAction,
  } = await import('./actionExecutor.js');

  if (!actionType || !config || !context)
    throw new ServiceError(400, 'Bad Request', 'actionType, config, and context are required');

  const documentActions = ['UPDATE_DOCUMENT_STATUS', 'REQUEST_DOCUMENT'];
  const communicationActions = ['SEND_EMAIL', 'SEND_SMS', 'GENERATE_LETTER'];
  const taskActions = ['CREATE_TASK', 'COMPLETE_TASK', 'ASSIGN_TASK'];
  const clientActions = ['UPDATE_CLIENT_STATUS', 'ADD_TAG', 'REMOVE_TAG', 'ASSIGN_CLIENT'];
  const noteActions = ['CREATE_NOTE'];
  const notificationActions = ['SEND_NOTIFICATION', 'LOG_ACTIVITY'];
  const flowControlActions = ['WAIT', 'BRANCH', 'PARALLEL'];
  const webhookActions = ['CALL_WEBHOOK'];

  if (documentActions.includes(actionType)) return executeDocumentAction(actionType, config, context);
  if (communicationActions.includes(actionType)) return executeCommunicationAction(actionType, config, context);
  if (taskActions.includes(actionType)) return executeTaskAction(actionType, config, context);
  if (clientActions.includes(actionType)) return executeClientAction(actionType, config, context);
  if (noteActions.includes(actionType)) return executeNoteAction(actionType, config, context);
  if (notificationActions.includes(actionType)) return executeNotificationAction(actionType, config, context);
  if (flowControlActions.includes(actionType)) return executeFlowControlAction(actionType, config, context);
  if (webhookActions.includes(actionType)) return executeWebhookAction(actionType, config, context);

  throw new ServiceError(400, 'Bad Request', `Unknown action type: ${actionType}`);
}

export async function testCondition(conditions: any, clientId: string) {
  if (!conditions) throw new ServiceError(400, 'Bad Request', 'conditions are required');
  if (!clientId) throw new ServiceError(400, 'Bad Request', 'clientId is required');

  const { testConditionEvaluation } = await import('./conditionEvaluator.js');
  return testConditionEvaluation(conditions, clientId);
}
