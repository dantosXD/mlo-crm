/**
 * Scheduled Job: Process Scheduled Communications
 *
 * This job runs every minute to check for communications that are scheduled
 * to be sent and marks them as READY for sending.
 *
 * Usage with node-cron:
 * import { processScheduledCommunications } from './jobs/processScheduledCommunications';
 * cron.schedule('* * * * *', processScheduledCommunications);
 */

import prisma from '../utils/prisma.js';

export async function processScheduledCommunications() {
  try {
    const now = new Date();

    // Find all communications that are:
    // - SCHEDULED status (or DRAFT/READY with a scheduled_at in the past)
    // - Have a scheduled_at time that has passed
    // - Not yet sent
    const dueCommunications = await prisma.communication.findMany({
      where: {
        status: { in: ['DRAFT', 'READY'] },
        scheduledAt: { lte: now },
        sentAt: null,
      },
      include: {
        client: true,
        createdBy: true,
      },
    });

    if (dueCommunications.length === 0) {
      return { processed: 0, message: 'No due communications found' };
    }

    // Update each due communication to READY status
    const updates = await Promise.all(
      dueCommunications.map((comm) =>
        prisma.communication.update({
          where: { id: comm.id },
          data: { status: 'READY' },
        })
      )
    );

    // Log activities for the status changes
    await Promise.all(
      updates.map((comm) =>
        prisma.activity.create({
          data: {
            clientId: comm.clientId,
            userId: comm.createdById,
            type: 'COMMUNICATION_STATUS_CHANGED',
            description: `Scheduled communication automatically marked as READY`,
            metadata: JSON.stringify({
              communicationId: comm.id,
              oldStatus: 'DRAFT',
              newStatus: 'READY',
              scheduledAt: comm.scheduledAt,
              automated: true,
            }),
          },
        })
      )
    );

    return {
      processed: updates.length,
      message: `Processed ${updates.length} scheduled communications`,
    };
  } catch (error) {
    console.error('Error processing scheduled communications:', error);
    return {
      processed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
