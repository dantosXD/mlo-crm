/**
 * Scheduled trigger checks — meant to be called by cron jobs / scheduled tasks.
 * Extracted from triggerHandler.ts to separate scheduled batch logic
 * from simple event-driven trigger firing.
 */
import prisma from '../utils/prisma.js';
import { executeWorkflow } from './workflowExecutor.js';
import { logger } from '../utils/logger.js';

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
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

    const whereClause: any = { updatedAt: { lt: cutoffDate } };
    if (stage) whereClause.status = stage;

    const clientsInStageTooLong = await prisma.client.findMany({
      where: whereClause,
      take: 100,
    });

    const thresholdWorkflows = await prisma.workflow.findMany({
      where: { triggerType: 'TIME_IN_STAGE_THRESHOLD', isActive: true },
    });

    if (thresholdWorkflows.length === 0) return;

    for (const client of clientsInStageTooLong) {
      for (const workflow of thresholdWorkflows) {
        try {
          const triggerConfig = workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : {};
          const workflowStage = triggerConfig.stage;
          const workflowThresholdDays = triggerConfig.thresholdDays || thresholdDays;
          const daysInStage = Math.floor((Date.now() - client.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
          const stageMatches = !workflowStage || workflowStage === client.status;
          const thresholdMatches = daysInStage >= workflowThresholdDays;

          if (stageMatches && thresholdMatches) {
            await executeWorkflow(workflow.id, {
              clientId: client.id,
              triggerType: 'TIME_IN_STAGE_THRESHOLD',
              triggerData: { clientId: client.id, stage: client.status, daysInStage, stageEntryDate: client.updatedAt.toISOString() },
              userId: client.createdById,
            });
          }
        } catch (error) {
          logger.error('scheduled_trigger_threshold_workflow_failed', { workflowId: workflow.id, clientId: client.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  } catch (error) {
    logger.error('scheduled_trigger_check_time_in_stage_failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Check for documents due soon and fire DOCUMENT_DUE_DATE trigger
 * This should be called by a scheduled job (e.g., daily)
 */
export async function checkDocumentDueDates(
  daysBefore: number = 3,
  daysAfter: number = 0
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + daysAfter);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysBefore);

    const documentsDue = await prisma.document.findMany({
      where: { dueDate: { gte: startDate, lte: endDate }, status: { notIn: ['APPROVED', 'REJECTED'] } },
      include: { client: true },
      take: 100,
    });

    const dueDateWorkflows = await prisma.workflow.findMany({
      where: { triggerType: 'DOCUMENT_DUE_DATE', isActive: true },
    });

    if (dueDateWorkflows.length === 0) return;

    for (const document of documentsDue) {
      for (const workflow of dueDateWorkflows) {
        try {
          const triggerConfig = workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : {};
          const workflowDaysBefore = triggerConfig.daysBefore ?? daysBefore;
          const workflowDaysAfter = triggerConfig.daysAfter ?? daysAfter;
          const daysUntilDue = Math.ceil((document.dueDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const matchesBefore = daysUntilDue <= workflowDaysBefore && daysUntilDue >= workflowDaysAfter;

          if (matchesBefore) {
            await executeWorkflow(workflow.id, {
              clientId: document.clientId,
              triggerType: 'DOCUMENT_DUE_DATE',
              triggerData: { documentId: document.id, clientId: document.clientId, dueDate: document.dueDate!.toISOString(), daysUntilDue },
              userId: document.client.createdById,
            });
          }
        } catch (error) {
          logger.error('scheduled_trigger_due_date_workflow_failed', { workflowId: workflow.id, documentId: document.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  } catch (error) {
    logger.error('scheduled_trigger_check_document_due_dates_failed', { error: error instanceof Error ? error.message : String(error) });
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

    const expiredDocuments = await prisma.document.findMany({
      where: { expiresAt: { lt: today }, status: { notIn: ['EXPIRED', 'REJECTED'] } },
      include: { client: true },
      take: 100,
    });

    const expiredWorkflows = await prisma.workflow.findMany({
      where: { triggerType: 'DOCUMENT_EXPIRED', isActive: true },
    });

    if (expiredWorkflows.length === 0) return;

    for (const document of expiredDocuments) {
      for (const workflow of expiredWorkflows) {
        try {
          await executeWorkflow(workflow.id, {
            clientId: document.clientId,
            triggerType: 'DOCUMENT_EXPIRED',
            triggerData: {
              documentId: document.id, clientId: document.clientId,
              expirationDate: document.expiresAt!.toISOString(),
              daysExpired: Math.floor((Date.now() - document.expiresAt!.getTime()) / (1000 * 60 * 60 * 24)),
            },
            userId: document.client.createdById,
          });
        } catch (error) {
          logger.error('scheduled_trigger_expired_workflow_failed', { workflowId: workflow.id, documentId: document.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  } catch (error) {
    logger.error('scheduled_trigger_check_expired_documents_failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Check for inactive clients and fire CLIENT_INACTIVITY trigger
 * This should be called by a scheduled job (e.g., daily)
 */
export async function checkInactiveClients(inactiveDays: number = 7): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const inactiveClients = await prisma.client.findMany({
      where: { updatedAt: { lt: cutoffDate }, createdAt: { lt: cutoffDate } },
      take: 100,
    });

    const inactivityWorkflows = await prisma.workflow.findMany({
      where: { triggerType: 'CLIENT_INACTIVITY', isActive: true },
    });

    if (inactivityWorkflows.length === 0) return;

    for (const client of inactiveClients) {
      for (const workflow of inactivityWorkflows) {
        try {
          const triggerConfig = workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : {};
          const workflowInactiveDays = triggerConfig.inactiveDays || inactiveDays;
          const daysSinceUpdate = Math.floor((Date.now() - client.updatedAt.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSinceUpdate >= workflowInactiveDays) {
            await executeWorkflow(workflow.id, {
              clientId: client.id,
              triggerType: 'CLIENT_INACTIVITY',
              triggerData: { clientId: client.id, inactiveDays: daysSinceUpdate, lastActivityDate: client.updatedAt.toISOString() },
              userId: client.createdById,
            });
          }
        } catch (error) {
          logger.error('scheduled_trigger_inactivity_workflow_failed', { workflowId: workflow.id, clientId: client.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  } catch (error) {
    logger.error('scheduled_trigger_check_inactive_clients_failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Check for overdue tasks and fire TASK_OVERDUE trigger
 * This should be called by a scheduled job (e.g., daily)
 */
export async function checkOverdueTasks(): Promise<void> {
  try {
    const now = new Date();

    const overdueTasks = await prisma.task.findMany({
      where: { dueDate: { lt: now }, status: { not: 'COMPLETE' } },
      include: { client: true },
      take: 100,
    });

    const overdueWorkflows = await prisma.workflow.findMany({
      where: { triggerType: 'TASK_OVERDUE', isActive: true },
    });

    if (overdueWorkflows.length === 0) return;

    for (const task of overdueTasks) {
      if (!task.clientId) continue;

      for (const workflow of overdueWorkflows) {
        try {
          const daysOverdue = Math.floor((now.getTime() - task.dueDate!.getTime()) / (1000 * 60 * 60 * 24));
          const triggerConfig = workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : {};
          const workflowDaysThreshold = triggerConfig.daysThreshold || 0;

          if (daysOverdue >= workflowDaysThreshold) {
            await executeWorkflow(workflow.id, {
              clientId: task.clientId,
              triggerType: 'TASK_OVERDUE',
              triggerData: { taskId: task.id, clientId: task.clientId, dueDate: task.dueDate!.toISOString(), daysOverdue },
              userId: task.client!.createdById,
            });
          }
        } catch (error) {
          logger.error('scheduled_trigger_overdue_workflow_failed', { workflowId: workflow.id, taskId: task.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  } catch (error) {
    logger.error('scheduled_trigger_check_overdue_tasks_failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Check for tasks due soon and fire TASK_DUE trigger
 * This should be called by a scheduled job (e.g., daily)
 */
export async function checkTaskDueDates(daysBefore: number = 1): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBefore);

    const tasksDue = await prisma.task.findMany({
      where: { dueDate: { gte: targetDate, lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) }, status: { not: 'COMPLETE' } },
      include: { client: true },
      take: 100,
    });

    const dueWorkflows = await prisma.workflow.findMany({
      where: { triggerType: 'TASK_DUE', isActive: true },
    });

    if (dueWorkflows.length === 0) return;

    for (const task of tasksDue) {
      if (!task.clientId) continue;

      for (const workflow of dueWorkflows) {
        try {
          await executeWorkflow(workflow.id, {
            clientId: task.clientId,
            triggerType: 'TASK_DUE',
            triggerData: { taskId: task.id, clientId: task.clientId, dueDate: task.dueDate!.toISOString(), daysUntilDue: daysBefore },
            userId: task.client!.createdById,
          });
        } catch (error) {
          logger.error('scheduled_trigger_task_due_workflow_failed', { workflowId: workflow.id, taskId: task.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  } catch (error) {
    logger.error('scheduled_trigger_check_task_due_dates_failed', { error: error instanceof Error ? error.message : String(error) });
  }
}
