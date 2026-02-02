import prisma from '../utils/prisma.js';
import { executeWorkflow } from './workflowExecutor.js';

export interface TriggerData {
  clientId: string;
  userId: string;
  [key: string]: any;
}

/**
 * Fire workflows for a specific trigger type
 * @param triggerType - The type of trigger to fire
 * @param triggerData - Data about the trigger event
 */
export async function fireTrigger(
  triggerType: string,
  triggerData: TriggerData
): Promise<void> {
  try {
    // Find all active workflows that match this trigger type
    const workflows = await prisma.workflow.findMany({
      where: {
        triggerType,
        isActive: true,
      },
    });

    if (workflows.length === 0) {
      return; // No workflows to execute
    }

    // Execute each matching workflow
    for (const workflow of workflows) {
      try {
        await executeWorkflow(workflow.id, {
          clientId: triggerData.clientId,
          triggerType,
          triggerData,
          userId: triggerData.userId,
        });
      } catch (error) {
        // Log workflow execution error but don't block other workflows
        console.error(
          `[Trigger Handler] Failed to execute workflow ${workflow.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(`[Trigger Handler] Failed to fire trigger ${triggerType}:`, error);
  }
}

/**
 * Fire CLIENT_CREATED trigger
 * @param clientId - ID of the created client
 * @param userId - ID of the user who created the client
 */
export async function fireClientCreatedTrigger(
  clientId: string,
  userId: string
): Promise<void> {
  await fireTrigger('CLIENT_CREATED', {
    clientId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire CLIENT_UPDATED trigger
 * @param clientId - ID of the updated client
 * @param userId - ID of the user who updated the client
 * @param changes - Object containing what fields changed
 */
export async function fireClientUpdatedTrigger(
  clientId: string,
  userId: string,
  changes?: Record<string, any>
): Promise<void> {
  await fireTrigger('CLIENT_UPDATED', {
    clientId,
    userId,
    changes,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire CLIENT_STATUS_CHANGED trigger
 * @param clientId - ID of the client whose status changed
 * @param userId - ID of the user who changed the status
 * @param fromStatus - Previous status
 * @param toStatus - New status
 */
export async function fireClientStatusChangedTrigger(
  clientId: string,
  userId: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  await fireTrigger('CLIENT_STATUS_CHANGED', {
    clientId,
    userId,
    fromStatus,
    toStatus,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire PIPELINE_STAGE_ENTRY trigger
 * @param clientId - ID of the client entering the stage
 * @param userId - ID of the user who triggered the change
 * @param stage - The stage being entered
 */
export async function firePipelineStageEntryTrigger(
  clientId: string,
  userId: string,
  stage: string
): Promise<void> {
  await fireTrigger('PIPELINE_STAGE_ENTRY', {
    clientId,
    userId,
    stage,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire PIPELINE_STAGE_EXIT trigger
 * @param clientId - ID of the client exiting the stage
 * @param userId - ID of the user who triggered the change
 * @param fromStage - The stage being exited
 * @param toStage - The stage being entered
 */
export async function firePipelineStageExitTrigger(
  clientId: string,
  userId: string,
  fromStage: string,
  toStage: string
): Promise<void> {
  await fireTrigger('PIPELINE_STAGE_EXIT', {
    clientId,
    userId,
    fromStage,
    toStage,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check for clients in stage too long and fire TIME_IN_STAGE_THRESHOLD trigger
 * This should be called by a scheduled job (e.g., daily)
 * @param stage - The stage to check (optional, checks all stages if not provided)
 * @param thresholdDays - Number of days in stage to trigger on
 */
export async function checkTimeInStageThreshold(
  stage?: string,
  thresholdDays: number = 30
): Promise<void> {
  try {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

    // Find clients who have been in their current status/stage longer than threshold
    const whereClause: any = {
      updatedAt: {
        lt: cutoffDate,
      },
    };

    // If specific stage provided, only check that stage
    if (stage) {
      whereClause.status = stage;
    }

    const clientsInStageTooLong = await prisma.client.findMany({
      where: whereClause,
      take: 100, // Process in batches
    });

    // Get workflows with TIME_IN_STAGE_THRESHOLD trigger
    const thresholdWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'TIME_IN_STAGE_THRESHOLD',
        isActive: true,
      },
    });

    if (thresholdWorkflows.length === 0) {
      return; // No threshold workflows configured
    }

    // Execute workflows for each client exceeding threshold
    for (const client of clientsInStageTooLong) {
      for (const workflow of thresholdWorkflows) {
        try {
          // Check if workflow has custom stage or threshold in triggerConfig
          const triggerConfig = workflow.triggerConfig
            ? JSON.parse(workflow.triggerConfig)
            : {};
          const workflowStage = triggerConfig.stage;
          const workflowThresholdDays = triggerConfig.thresholdDays || thresholdDays;

          // Calculate how long client has been in current stage
          const daysInStage = Math.floor(
            (Date.now() - client.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Check if this client matches the workflow's criteria
          const stageMatches = !workflowStage || workflowStage === client.status;
          const thresholdMatches = daysInStage >= workflowThresholdDays;

          if (stageMatches && thresholdMatches) {
            await executeWorkflow(workflow.id, {
              clientId: client.id,
              triggerType: 'TIME_IN_STAGE_THRESHOLD',
              triggerData: {
                clientId: client.id,
                stage: client.status,
                daysInStage,
                stageEntryDate: client.updatedAt.toISOString(),
              },
              userId: client.createdById,
            });
          }
        } catch (error) {
          console.error(
            `[Trigger Handler] Failed to execute threshold workflow ${workflow.id} for client ${client.id}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('[Trigger Handler] Failed to check time in stage threshold:', error);
  }
}

/**
 * Fire DOCUMENT_UPLOADED trigger
 * @param documentId - ID of the uploaded document
 * @param clientId - ID of the client who owns the document
 * @param userId - ID of the user who uploaded the document
 */
export async function fireDocumentUploadedTrigger(
  documentId: string,
  clientId: string,
  userId: string
): Promise<void> {
  await fireTrigger('DOCUMENT_UPLOADED', {
    documentId,
    clientId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire DOCUMENT_STATUS_CHANGED trigger
 * @param documentId - ID of the document
 * @param clientId - ID of the client who owns the document
 * @param userId - ID of the user who changed the status
 * @param fromStatus - Previous status
 * @param toStatus - New status
 */
export async function fireDocumentStatusChangedTrigger(
  documentId: string,
  clientId: string,
  userId: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  await fireTrigger('DOCUMENT_STATUS_CHANGED', {
    documentId,
    clientId,
    userId,
    fromStatus,
    toStatus,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check for documents due soon and fire DOCUMENT_DUE_DATE trigger
 * This should be called by a scheduled job (e.g., daily)
 * @param daysBefore - Number of days before due date to trigger (default: 3)
 * @param daysAfter - Number of days after due date to trigger (default: 0)
 */
export async function checkDocumentDueDates(
  daysBefore: number = 3,
  daysAfter: number = 0
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate date range
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + daysAfter);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysBefore);

    // Find documents with due dates in the target range
    const documentsDue = await prisma.document.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['APPROVED', 'REJECTED'], // Ignore completed documents
        },
      },
      include: {
        client: true,
      },
      take: 100,
    });

    // Get workflows with DOCUMENT_DUE_DATE trigger
    const dueDateWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'DOCUMENT_DUE_DATE',
        isActive: true,
      },
    });

    if (dueDateWorkflows.length === 0) {
      return;
    }

    // Execute workflows for each due document
    for (const document of documentsDue) {
      for (const workflow of dueDateWorkflows) {
        try {
          const triggerConfig = workflow.triggerConfig
            ? JSON.parse(workflow.triggerConfig)
            : {};
          const workflowDaysBefore = triggerConfig.daysBefore ?? daysBefore;
          const workflowDaysAfter = triggerConfig.daysAfter ?? daysAfter;

          // Calculate days until due
          const daysUntilDue = Math.ceil(
            (document.dueDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          // Check if this document matches the workflow's criteria
          const matchesBefore = daysUntilDue <= workflowDaysBefore && daysUntilDue >= workflowDaysAfter;

          if (matchesBefore) {
            await executeWorkflow(workflow.id, {
              clientId: document.clientId,
              triggerType: 'DOCUMENT_DUE_DATE',
              triggerData: {
                documentId: document.id,
                clientId: document.clientId,
                dueDate: document.dueDate!.toISOString(),
                daysUntilDue,
              },
              userId: document.client.createdById,
            });
          }
        } catch (error) {
          console.error(
            `[Trigger Handler] Failed to execute due date workflow ${workflow.id} for document ${document.id}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('[Trigger Handler] Failed to check document due dates:', error);
  }
}

/**
 * Check for expired documents and fire DOCUMENT_EXPIRED trigger
 * This should be called by a scheduled job (e.g., daily)
 */
export async function checkExpiredDocuments(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find documents with expiration date that has passed
    // and are not already marked as EXPIRED
    const expiredDocuments = await prisma.document.findMany({
      where: {
        expiresAt: {
          lt: today,
        },
        status: {
          notIn: ['EXPIRED', 'REJECTED'],
        },
      },
      include: {
        client: true,
      },
      take: 100,
    });

    // Get workflows with DOCUMENT_EXPIRED trigger
    const expiredWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'DOCUMENT_EXPIRED',
        isActive: true,
      },
    });

    if (expiredWorkflows.length === 0) {
      return;
    }

    // Execute workflows for each expired document
    for (const document of expiredDocuments) {
      for (const workflow of expiredWorkflows) {
        try {
          await executeWorkflow(workflow.id, {
            clientId: document.clientId,
            triggerType: 'DOCUMENT_EXPIRED',
            triggerData: {
              documentId: document.id,
              clientId: document.clientId,
              expirationDate: document.expiresAt!.toISOString(),
              daysExpired: Math.floor(
                (Date.now() - document.expiresAt!.getTime()) / (1000 * 60 * 60 * 24)
              ),
            },
            userId: document.client.createdById,
          });
        } catch (error) {
          console.error(
            `[Trigger Handler] Failed to execute expired workflow ${workflow.id} for document ${document.id}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('[Trigger Handler] Failed to check expired documents:', error);
  }
}

/**
 * Check for inactive clients and fire CLIENT_INACTIVITY trigger
 * This should be called by a scheduled job (e.g., daily)
 * @param inactiveDays - Number of days of inactivity to check for
 */
export async function checkInactiveClients(inactiveDays: number = 7): Promise<void> {
  try {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    // Find all clients that haven't been updated since the cutoff date
    // and have at least one activity (to exclude brand new clients)
    const inactiveClients = await prisma.client.findMany({
      where: {
        updatedAt: {
          lt: cutoffDate,
        },
        // Exclude clients created within the inactivity period
        createdAt: {
          lt: cutoffDate,
        },
      },
      take: 100, // Process in batches to avoid memory issues
    });

    // Get workflows with CLIENT_INACTIVITY trigger
    const inactivityWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'CLIENT_INACTIVITY',
        isActive: true,
      },
    });

    if (inactivityWorkflows.length === 0) {
      return; // No inactivity workflows configured
    }

    // Execute workflows for each inactive client
    for (const client of inactiveClients) {
      for (const workflow of inactivityWorkflows) {
        try {
          // Check if workflow has custom inactivity threshold in triggerConfig
          const triggerConfig = workflow.triggerConfig
            ? JSON.parse(workflow.triggerConfig)
            : {};
          const workflowInactiveDays = triggerConfig.inactiveDays || inactiveDays;

          // Only trigger if this client matches the workflow's threshold
          const daysSinceUpdate = Math.floor(
            (Date.now() - client.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceUpdate >= workflowInactiveDays) {
            await executeWorkflow(workflow.id, {
              clientId: client.id,
              triggerType: 'CLIENT_INACTIVITY',
              triggerData: {
                clientId: client.id,
                inactiveDays: daysSinceUpdate,
                lastActivityDate: client.updatedAt.toISOString(),
              },
              userId: client.createdById, // Use the client's owner as the user
            });
          }
        } catch (error) {
          console.error(
            `[Trigger Handler] Failed to execute inactivity workflow ${workflow.id} for client ${client.id}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('[Trigger Handler] Failed to check inactive clients:', error);
  }
}

// ============================================================================
// TASK TRIGGERS
// ============================================================================

/**
 * Fire TASK_CREATED trigger
 * @param taskId - ID of the created task
 * @param clientId - ID of the client (optional, task may not be linked to a client)
 * @param userId - ID of the user who created the task
 */
export async function fireTaskCreatedTrigger(
  taskId: string,
  clientId: string | null,
  userId: string
): Promise<void> {
  if (!clientId) {
    return; // Skip workflow triggers for tasks not linked to clients
  }

  await fireTrigger('TASK_CREATED', {
    taskId,
    clientId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire TASK_COMPLETED trigger
 * @param taskId - ID of the completed task
 * @param clientId - ID of the client (optional)
 * @param userId - ID of the user who completed the task
 */
export async function fireTaskCompletedTrigger(
  taskId: string,
  clientId: string | null,
  userId: string
): Promise<void> {
  if (!clientId) {
    return; // Skip workflow triggers for tasks not linked to clients
  }

  await fireTrigger('TASK_COMPLETED', {
    taskId,
    clientId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire TASK_OVERDUE trigger
 * @param taskId - ID of the overdue task
 * @param clientId - ID of the client (optional)
 * @param dueDate - Original due date of the task
 * @param daysOverdue - Number of days overdue
 */
export async function fireTaskOverdueTrigger(
  taskId: string,
  clientId: string | null,
  dueDate: Date,
  daysOverdue: number
): Promise<void> {
  if (!clientId) {
    return; // Skip workflow triggers for tasks not linked to clients
  }

  await fireTrigger('TASK_OVERDUE', {
    taskId,
    clientId,
    userId: '', // Will be set by scheduled job
    dueDate: dueDate.toISOString(),
    daysOverdue,
    timestamp: new Date().toISOString(),
  } as any);
}

/**
 * Fire TASK_ASSIGNED trigger
 * @param taskId - ID of the assigned task
 * @param clientId - ID of the client (optional)
 * @param assignedToId - ID of the user the task was assigned to
 * @param assignedBy - ID of the user who made the assignment
 */
export async function fireTaskAssignedTrigger(
  taskId: string,
  clientId: string | null,
  assignedToId: string,
  assignedBy: string
): Promise<void> {
  if (!clientId) {
    return; // Skip workflow triggers for tasks not linked to clients
  }

  await fireTrigger('TASK_ASSIGNED', {
    taskId,
    clientId,
    userId: assignedBy,
    assignedToId,
    assignedBy,
    timestamp: new Date().toISOString(),
  } as any);
}

/**
 * Check for overdue tasks and fire TASK_OVERDUE trigger
 * This should be called by a scheduled job (e.g., daily)
 */
export async function checkOverdueTasks(): Promise<void> {
  try {
    const now = new Date();

    // Find all tasks that are overdue (due date has passed)
    // and are not yet complete
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: {
          lt: now,
        },
        status: {
          not: 'COMPLETE',
        },
      },
      include: {
        client: true,
      },
      take: 100,
    });

    // Get workflows with TASK_OVERDUE trigger
    const overdueWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'TASK_OVERDUE',
        isActive: true,
      },
    });

    if (overdueWorkflows.length === 0) {
      return; // No overdue workflows configured
    }

    // Execute workflows for each overdue task
    for (const task of overdueTasks) {
      if (!task.clientId) {
        continue; // Skip tasks not linked to clients
      }

      for (const workflow of overdueWorkflows) {
        try {
          // Calculate days overdue
          const daysOverdue = Math.floor(
            (now.getTime() - task.dueDate!.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Check if workflow has custom threshold in triggerConfig
          const triggerConfig = workflow.triggerConfig
            ? JSON.parse(workflow.triggerConfig)
            : {};
          const workflowDaysThreshold = triggerConfig.daysThreshold || 0;

          // Only trigger if task is at least as many days overdue as threshold
          if (daysOverdue >= workflowDaysThreshold) {
            await executeWorkflow(workflow.id, {
              clientId: task.clientId,
              triggerType: 'TASK_OVERDUE',
              triggerData: {
                taskId: task.id,
                clientId: task.clientId,
                dueDate: task.dueDate!.toISOString(),
                daysOverdue,
              },
              userId: task.client!.createdById,
            });
          }
        } catch (error) {
          console.error(
            `[Trigger Handler] Failed to execute overdue workflow ${workflow.id} for task ${task.id}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('[Trigger Handler] Failed to check overdue tasks:', error);
  }
}

/**
 * Check for tasks due soon and fire TASK_DUE trigger
 * This should be called by a scheduled job (e.g., daily)
 * @param daysBefore - Number of days before due date to trigger (default: 1)
 */
export async function checkTaskDueDates(daysBefore: number = 1): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate target date
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBefore);

    // Find tasks due on the target date that are not complete
    const tasksDue = await prisma.task.findMany({
      where: {
        dueDate: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000), // Same day
        },
        status: {
          not: 'COMPLETE',
        },
      },
      include: {
        client: true,
      },
      take: 100,
    });

    // Get workflows with TASK_DUE trigger
    const dueWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'TASK_DUE',
        isActive: true,
      },
    });

    if (dueWorkflows.length === 0) {
      return; // No task due workflows configured
    }

    // Execute workflows for each due task
    for (const task of tasksDue) {
      if (!task.clientId) {
        continue; // Skip tasks not linked to clients
      }

      for (const workflow of dueWorkflows) {
        try {
          await executeWorkflow(workflow.id, {
            clientId: task.clientId,
            triggerType: 'TASK_DUE',
            triggerData: {
              taskId: task.id,
              clientId: task.clientId,
              dueDate: task.dueDate!.toISOString(),
              daysUntilDue: daysBefore,
            },
            userId: task.client!.createdById,
          });
        } catch (error) {
          console.error(
            `[Trigger Handler] Failed to execute task due workflow ${workflow.id} for task ${task.id}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('[Trigger Handler] Failed to check task due dates:', error);
  }
}

// ============================================================================
// WEBHOOK TRIGGER
// ============================================================================

/**
 * Fire WEBHOOK trigger
 * @param workflowId - ID of the workflow to trigger
 * @param payload - The webhook payload data
 * @param clientId - Optional client ID if payload contains client information
 * @param userId - Optional user ID (defaults to system user or workflow creator)
 */
export async function fireWebhookTrigger(
  workflowId: string,
  payload: any,
  clientId?: string,
  userId?: string
): Promise<void> {
  try {
    // Verify the workflow exists and is active
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { createdBy: true },
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (!workflow.isActive) {
      throw new Error(`Workflow ${workflowId} is not active`);
    }

    if (workflow.triggerType !== 'WEBHOOK') {
      throw new Error(`Workflow ${workflowId} is not a webhook trigger`);
    }

    // Use provided userId or default to workflow creator
    const executorUserId = userId || workflow.createdById;

    // Execute the workflow with the webhook payload
    await executeWorkflow(workflowId, {
      clientId,
      triggerType: 'WEBHOOK',
      triggerData: {
        ...payload,
        timestamp: new Date().toISOString(),
      },
      userId: executorUserId,
    });

    console.log(`[Trigger Handler] Webhook trigger executed for workflow ${workflowId}`);
  } catch (error) {
    console.error(`[Trigger Handler] Failed to fire webhook trigger for workflow ${workflowId}:`, error);
    throw error; // Re-throw to allow caller to handle
  }
}

/**
 * Generate a webhook secret for a workflow
 * @returns A random 32-character hex string
 */
export function generateWebhookSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verify webhook signature
 * @param payload - The raw request body
 * @param signature - The signature from the X-Webhook-Signature header
 * @param secret - The webhook secret
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

// ============================================================================
// NOTE TRIGGERS
// ============================================================================

/**
 * Fire NOTE_CREATED trigger
 * @param noteId - ID of the created note
 * @param clientId - ID of the client
 * @param userId - ID of the user who created the note
 */
export async function fireNoteCreatedTrigger(
  noteId: string,
  clientId: string,
  userId: string
): Promise<void> {
  await fireTrigger('NOTE_CREATED', {
    noteId,
    clientId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Fire NOTE_WITH_TAG trigger
 * @param noteId - ID of the note
 * @param clientId - ID of the client
 * @param tag - The tag that was added
 * @param userId - ID of the user who added the tag
 */
export async function fireNoteWithTagTrigger(
  noteId: string,
  clientId: string,
  tag: string,
  userId: string
): Promise<void> {
  await fireTrigger('NOTE_WITH_TAG', {
    noteId,
    clientId,
    tag,
    userId,
    timestamp: new Date().toISOString(),
  });
}
