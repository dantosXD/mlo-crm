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
