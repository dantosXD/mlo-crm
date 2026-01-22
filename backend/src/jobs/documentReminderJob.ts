import { PrismaClient } from '@prisma/client';
import { createDocumentReminderNotification } from '../services/notificationService';

const prisma = new PrismaClient();

/**
 * Check for documents due within 3 days or overdue and create reminder notifications
 * This should be run periodically (e.g., every hour or daily)
 */
export async function checkDocumentReminders() {
  console.log('🔔 Checking for document reminders...');

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    // Find documents that:
    // 1. Have a due date
    // 2. Are due within 3 days or are overdue
    // 3. Have status REQUESTED or REQUIRED (not yet uploaded)
    const documentsDueSoon = await prisma.document.findMany({
      where: {
 dueDate: {
          lte: threeDaysFromNow,
        },
        status: {
          in: ['REQUESTED', 'REQUIRED'],
        },
      },
      include: {
        client: {
          include: {
            createdBy: true,
          },
        },
      },
    });

    console.log(`Found ${documentsDueSoon.length} documents due soon or overdue`);

    let notificationsCreated = 0;

    for (const document of documentsDueSoon) {
      if (!document.dueDate) continue;

      // Check if we already created a notification for this document today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: document.client.createdById,
          type: {
            in: ['DOCUMENT_REMINDER', 'DOCUMENT_OVERDUE'],
          },
          createdAt: {
            gte: today,
          },
          metadata: {
            contains: document.id,
          },
        },
      });

      if (existingNotification) {
        // Already notified today, skip
        console.log(`  ⏭️  Skipping "${document.name}" - already notified today`);
        continue;
      }

      // Decrypt client name for notification
      const clientName = document.client.nameEncrypted; // In production, this would be decrypted

      // Create reminder notification
      const notification = await createDocumentReminderNotification(
        document.client.createdById,
        document.id,
        document.name,
        clientName,
        document.dueDate
      );

      if (notification) {
        notificationsCreated++;
        console.log(`  ✅ Created reminder for "${document.name}" (due: ${document.dueDate.toLocaleDateString()})`);
      }
    }

    console.log(`✅ Document reminder check complete. Created ${notificationsCreated} notifications.`);
    return { documentsChecked: documentsDueSoon.length, notificationsCreated };
  } catch (error) {
    console.error('❌ Error checking document reminders:', error);
    throw error;
  }
}

/**
 * Run the document reminder job (can be called manually or scheduled)
 */
export async function runDocumentReminderJob() {
  try {
    const result = await checkDocumentReminders();
    return result;
  } catch (error) {
    console.error('Document reminder job failed:', error);
    throw error;
  }
}

// Allow running this file directly
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  runDocumentReminderJob()
    .then(() => {
      console.log('Document reminder job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Document reminder job failed:', error);
      process.exit(1);
    });
}
