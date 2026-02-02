/**
 * Scheduled Workflow Runner
 *
 * This module handles scheduled and date-based workflow triggers.
 * It should be registered with a cron job scheduler (node-cron or similar).
 *
 * Usage:
 * 1. Install node-cron: npm install node-cron @types/node-cron
 * 2. In your server startup (server.ts or index.ts):
 *
 *    import cron from 'node-cron';
 *    import { registerScheduledWorkflows } from './jobs/scheduledWorkflowRunner.js';
 *
 *    // Run every hour
 *    cron.schedule('0 * * * *', async () => {
 *      await runScheduledWorkflows('hourly');
 *    });
 *
 *    // Run every day at midnight
 *    cron.schedule('0 0 * * *', async () => {
 *      await runScheduledWorkflows('daily');
 *      await checkDateBasedWorkflows();
 *    });
 *
 *    // Register workflows on startup
 *    await registerScheduledWorkflows();
 */

import prisma from '../utils/prisma.js';
import { executeWorkflow } from '../services/workflowExecutor.js';

/**
 * Run all scheduled workflows based on schedule type
 * @param scheduleType - The type of schedule to run ('hourly', 'daily', 'weekly', 'monthly')
 */
export async function runScheduledWorkflows(scheduleType: string): Promise<void> {
  try {
    console.log(`[Scheduled Workflows] Running ${scheduleType} workflows...`);

    // Find all active workflows with SCHEDULED trigger type
    const scheduledWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'SCHEDULED',
        isActive: true,
      },
    });

    if (scheduledWorkflows.length === 0) {
      console.log('[Scheduled Workflows] No scheduled workflows found');
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentDayOfMonth = now.getDate();

    // Execute workflows that match the current schedule
    for (const workflow of scheduledWorkflows) {
      try {
        const triggerConfig = workflow.triggerConfig
          ? JSON.parse(workflow.triggerConfig)
          : {};

        const schedule = triggerConfig.schedule || 'daily';
        const scheduledTime = triggerConfig.time || '00:00'; // Default to midnight

        // Parse the scheduled time
        const [hour, minute] = scheduledTime.split(':').map(Number);
        const scheduledHour = hour || 0;

        // Check if this workflow should run now
        let shouldRun = false;

        if (schedule === 'hourly' && scheduleType === 'hourly') {
          shouldRun = true;
        } else if (schedule === 'daily' && scheduleType === 'daily') {
          // Check if we're at the right hour
          shouldRun = currentHour === scheduledHour;
        } else if (schedule === 'weekly' && scheduleType === 'daily') {
          // Check if we're at the right day of week and hour
          const targetDayOfWeek = triggerConfig.dayOfWeek ?? 1; // Default to Monday
          shouldRun = currentDayOfWeek === targetDayOfWeek && currentHour === scheduledHour;
        } else if (schedule === 'monthly' && scheduleType === 'daily') {
          // Check if we're at the right day of month and hour
          const targetDayOfMonth = triggerConfig.dayOfMonth ?? 1; // Default to 1st
          shouldRun = currentDayOfMonth === targetDayOfMonth && currentHour === scheduledHour;
        }

        if (shouldRun) {
          console.log(`[Scheduled Workflows] Executing workflow: ${workflow.name}`);

          // For scheduled workflows, we don't have a specific client
          // The workflow actions should handle what to do (e.g., send notifications, create reports, etc.)
          await executeWorkflow(workflow.id, {
            clientId: null, // No specific client
            triggerType: 'SCHEDULED',
            triggerData: {
              schedule,
              scheduleType,
              executedAt: now.toISOString(),
            },
            userId: workflow.createdById, // Use workflow creator as the user
          });
        }
      } catch (error) {
        console.error(
          `[Scheduled Workflows] Failed to execute workflow ${workflow.id}:`,
          error
        );
      }
    }

    console.log(`[Scheduled Workflows] Completed ${scheduleType} run`);
  } catch (error) {
    console.error('[Scheduled Workflows] Failed to run scheduled workflows:', error);
  }
}

/**
 * Check for and run date-based workflows
 * This checks for clients matching date-based triggers
 */
export async function checkDateBasedWorkflows(): Promise<void> {
  try {
    console.log('[Date-Based Workflows] Checking date-based workflows...');

    // Find all active workflows with DATE_BASED trigger type
    const dateBasedWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'DATE_BASED',
        isActive: true,
      },
    });

    if (dateBasedWorkflows.length === 0) {
      console.log('[Date-Based Workflows] No date-based workflows found');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const workflow of dateBasedWorkflows) {
      try {
        const triggerConfig = workflow.triggerConfig
          ? JSON.parse(workflow.triggerConfig)
          : {};

        const dateField = triggerConfig.dateField || 'client.createdAt';
        const offsetDays = triggerConfig.offsetDays || 0;
        const customDate = triggerConfig.customDate;

        // Calculate target date
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - offsetDays); // Negative offset = future, Positive = past

        // Find clients matching the date criteria
        let clients: any[] = [];

        if (dateField === 'client.createdAt' || dateField === 'client.updatedAt') {
          const fieldName = dateField.split('.')[1];
          const startDate = new Date(targetDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(targetDate);
          endDate.setHours(23, 59, 59, 999);

          clients = await prisma.client.findMany({
            where: {
              [fieldName]: {
                gte: startDate,
                lte: endDate,
              },
            },
            take: 100,
          });
        } else if (customDate) {
          // For custom dates, we need to find clients that match some criteria
          // This is a placeholder - in practice, you might have a client.customDate field or similar
          // For now, we'll skip custom date workflows
          console.log(`[Date-Based Workflows] Skipping custom date workflow ${workflow.id} (not implemented)`);
          continue;
        }

        // Execute workflow for each matching client
        for (const client of clients) {
          try {
            console.log(
              `[Date-Based Workflows] Executing workflow ${workflow.name} for client ${client.id}`
            );

            await executeWorkflow(workflow.id, {
              clientId: client.id,
              triggerType: 'DATE_BASED',
              triggerData: {
                dateField,
                targetDate: targetDate.toISOString(),
                offsetDays,
              },
              userId: client.createdById,
            });
          } catch (error) {
            console.error(
              `[Date-Based Workflows] Failed to execute workflow ${workflow.id} for client ${client.id}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error(
          `[Date-Based Workflows] Failed to process date-based workflow ${workflow.id}:`,
          error
        );
      }
    }

    console.log('[Date-Based Workflows] Completed check');
  } catch (error) {
    console.error('[Date-Based Workflows] Failed to check date-based workflows:', error);
  }
}

/**
 * Register all scheduled workflows
 * This function can be called on server startup to initialize scheduled workflows
 */
export async function registerScheduledWorkflows(): Promise<void> {
  try {
    const scheduledWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: 'SCHEDULED',
        isActive: true,
      },
    });

    console.log(`[Scheduled Workflows] Found ${scheduledWorkflows.length} scheduled workflows`);

    // In a real implementation with node-cron, you would register cron jobs here
    // For now, this just logs the workflows that would be scheduled
    for (const workflow of scheduledWorkflows) {
      const triggerConfig = workflow.triggerConfig
        ? JSON.parse(workflow.triggerConfig)
        : {};

      console.log(`[Scheduled Workflows] - ${workflow.name}: ${triggerConfig.schedule || 'daily'} at ${triggerConfig.time || '00:00'}`);
    }
  } catch (error) {
    console.error('[Scheduled Workflows] Failed to register scheduled workflows:', error);
  }
}
