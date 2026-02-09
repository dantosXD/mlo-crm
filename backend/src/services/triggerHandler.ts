import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { executeWorkflow } from './workflowExecutor.js';
import { logger } from '../utils/logger.js';

// Re-export scheduled batch-check functions from their new home
export {
  checkTimeInStageThreshold,
  checkDocumentDueDates,
  checkExpiredDocuments,
  checkInactiveClients,
  checkOverdueTasks,
  checkTaskDueDates,
} from './scheduledTriggers.js';

export interface TriggerData {
  clientId: string;
  userId: string;
  [key: string]: any;
}

/**
 * Fire workflows for a specific trigger type
 */
export async function fireTrigger(
  triggerType: string,
  triggerData: TriggerData
): Promise<void> {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { triggerType, isActive: true },
    });

    if (workflows.length === 0) return;

    for (const workflow of workflows) {
      try {
        await executeWorkflow(workflow.id, {
          clientId: triggerData.clientId,
          triggerType,
          triggerData,
          userId: triggerData.userId,
        });
      } catch (error) {
        logger.error('trigger_workflow_execute_failed', {
          workflowId: workflow.id,
          triggerType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error('trigger_fire_failed', {
      triggerType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── client triggers ────────────────────────────────────────────────────────

export async function fireClientCreatedTrigger(clientId: string, userId: string): Promise<void> {
  await fireTrigger('CLIENT_CREATED', { clientId, userId, timestamp: new Date().toISOString() });
}

export async function fireClientUpdatedTrigger(clientId: string, userId: string, changes?: Record<string, any>): Promise<void> {
  await fireTrigger('CLIENT_UPDATED', { clientId, userId, changes, timestamp: new Date().toISOString() });
}

export async function fireClientStatusChangedTrigger(clientId: string, userId: string, fromStatus: string, toStatus: string): Promise<void> {
  await fireTrigger('CLIENT_STATUS_CHANGED', { clientId, userId, fromStatus, toStatus, timestamp: new Date().toISOString() });
}

// ─── pipeline triggers ─────────────────────────────────────────────────────

export async function firePipelineStageEntryTrigger(clientId: string, userId: string, stage: string): Promise<void> {
  await fireTrigger('PIPELINE_STAGE_ENTRY', { clientId, userId, stage, timestamp: new Date().toISOString() });
}

export async function firePipelineStageExitTrigger(clientId: string, userId: string, fromStage: string, toStage: string): Promise<void> {
  await fireTrigger('PIPELINE_STAGE_EXIT', { clientId, userId, fromStage, toStage, timestamp: new Date().toISOString() });
}

// ─── document triggers ─────────────────────────────────────────────────────

export async function fireDocumentUploadedTrigger(documentId: string, clientId: string, userId: string): Promise<void> {
  await fireTrigger('DOCUMENT_UPLOADED', { documentId, clientId, userId, timestamp: new Date().toISOString() });
}

export async function fireDocumentStatusChangedTrigger(documentId: string, clientId: string, userId: string, fromStatus: string, toStatus: string): Promise<void> {
  await fireTrigger('DOCUMENT_STATUS_CHANGED', { documentId, clientId, userId, fromStatus, toStatus, timestamp: new Date().toISOString() });
}

// ─── task triggers ──────────────────────────────────────────────────────────

export async function fireTaskCreatedTrigger(taskId: string, clientId: string | null, userId: string): Promise<void> {
  if (!clientId) return;
  await fireTrigger('TASK_CREATED', { taskId, clientId, userId, timestamp: new Date().toISOString() });
}

export async function fireTaskCompletedTrigger(taskId: string, clientId: string | null, userId: string): Promise<void> {
  if (!clientId) return;
  await fireTrigger('TASK_COMPLETED', { taskId, clientId, userId, timestamp: new Date().toISOString() });
}

export async function fireTaskOverdueTrigger(taskId: string, clientId: string | null, dueDate: Date, daysOverdue: number): Promise<void> {
  if (!clientId) return;
  await fireTrigger('TASK_OVERDUE', { taskId, clientId, userId: '', dueDate: dueDate.toISOString(), daysOverdue, timestamp: new Date().toISOString() } as any);
}

export async function fireTaskAssignedTrigger(taskId: string, clientId: string | null, assignedToId: string, assignedBy: string): Promise<void> {
  if (!clientId) return;
  await fireTrigger('TASK_ASSIGNED', { taskId, clientId, userId: assignedBy, assignedToId, assignedBy, timestamp: new Date().toISOString() } as any);
}

// ─── webhook triggers ───────────────────────────────────────────────────────

export async function fireWebhookTrigger(workflowId: string, payload: any, clientId?: string, userId?: string): Promise<void> {
  try {
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId }, include: { createdBy: true } });
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
    if (!workflow.isActive) throw new Error(`Workflow ${workflowId} is not active`);
    if (workflow.triggerType !== 'WEBHOOK') throw new Error(`Workflow ${workflowId} is not a webhook trigger`);

    const executorUserId = userId || workflow.createdById;
    await executeWorkflow(workflowId, {
      clientId,
      triggerType: 'WEBHOOK',
      triggerData: { ...payload, timestamp: new Date().toISOString() },
      userId: executorUserId,
    });

    logger.info('trigger_webhook_executed', { workflowId });
  } catch (error) {
    logger.error('trigger_webhook_failed', {
      workflowId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
  } catch {
    return false;
  }
}

// ─── note triggers ──────────────────────────────────────────────────────────

export async function fireNoteCreatedTrigger(noteId: string, clientId: string, userId: string): Promise<void> {
  await fireTrigger('NOTE_CREATED', { noteId, clientId, userId, timestamp: new Date().toISOString() });
}

export async function fireNoteWithTagTrigger(noteId: string, clientId: string, tag: string, userId: string): Promise<void> {
  await fireTrigger('NOTE_WITH_TAG', { noteId, clientId, tag, userId, timestamp: new Date().toISOString() });
}
