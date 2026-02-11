import {
  createTaskReminderNotification,
  wasReminderSentToday,
  logReminderHistory,
} from '../services/notificationService';
import prisma from '../utils/prisma.js';

// Reminder type configurations (in milliseconds)
const REMINDER_OFFSETS: Record<string, number> = {
  AT_TIME: 0,
  '15MIN': 15 * 60 * 1000, // 15 minutes
  '1HR': 60 * 60 * 1000, // 1 hour
  '1DAY': 24 * 60 * 60 * 1000, // 1 day
  '1WEEK': 7 * 24 * 60 * 60 * 1000, // 1 week
};

/**
 * Check for tasks that need reminders and create reminder notifications
 * This should be run periodically (e.g., every 5-10 minutes)
 */
export async function checkTaskReminders() {
  console.log('🔔 Checking for task reminders...');

  const now = new Date();

  try {
    // Find tasks that:
    // 1. Have a due date
    // 2. Have reminders enabled
    // 3. Are not complete
    // 4. Are not snoozed past current time
    // 5. Have reminder times configured
    const tasksWithReminders = await prisma.task.findMany({
      where: {
        dueDate: { not: null },
        reminderEnabled: true,
        status: { not: 'COMPLETE' },
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lte: now } },
        ],
      },
      include: {
        client: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`Found ${tasksWithReminders.length} tasks with reminders enabled`);

    let notificationsCreated = 0;

    for (const task of tasksWithReminders) {
      if (!task.dueDate) continue;

      // Skip if no assigned user to notify
      if (!task.assignedTo) {
        console.log(`  ⏭️  Skipping "${task.text}" - no assigned user`);
        continue;
      }

      // Parse reminder times
      let reminderTimes: string[] = [];
      try {
        reminderTimes = JSON.parse(task.reminderTimes || '[]');
      } catch (e) {
        console.error(`  ❌ Error parsing reminder times for task "${task.text}":`, e);
        continue;
      }

      if (reminderTimes.length === 0) {
        console.log(`  ⏭️  Skipping "${task.text}" - no reminder times configured`);
        continue;
      }

      // Check each reminder type
      for (const reminderType of reminderTimes) {
        const reminderOffset = REMINDER_OFFSETS[reminderType];
        if (reminderOffset === undefined) {
          console.log(`  ⚠️  Unknown reminder type: ${reminderType}`);
          continue;
        }

        // Calculate when this reminder should trigger
        const reminderTriggerTime = new Date(task.dueDate.getTime() - reminderOffset);

        // Check if it's time to send this reminder (within a 5-minute window)
        const timeDiff = Math.abs(now.getTime() - reminderTriggerTime.getTime());
        const isTimeToRemind = timeDiff <= 5 * 60 * 1000; // 5 minutes

        if (!isTimeToRemind) {
          continue;
        }

        // Check if we already sent this reminder type today
        const alreadyReminded = await wasReminderSentToday(
          task.id,
          task.assignedTo.id,
          reminderType
        );

        if (alreadyReminded) {
          console.log(`  ⏭️  Skipping "${task.text}" - ${reminderType} reminder already sent today`);
          continue;
        }

        // Decrypt client name for notification (in production, would use proper decryption)
        const clientName = task.client?.nameEncrypted || null;

        // Create reminder notification
        const notification = await createTaskReminderNotification(
          task.assignedTo.id,
          task.id,
          task.text,
          clientName,
          task.dueDate,
          reminderType,
          task.reminderMessage || undefined
        );

        if (notification) {
          notificationsCreated++;
          console.log(
            `  ✅ Created ${reminderType} reminder for "${task.text}" ` +
            `(due: ${task.dueDate.toLocaleDateString()} ${task.dueDate.toLocaleTimeString()})`
          );
        }
      }

      // Check for overdue escalation (if task is overdue and hasn't been reminded today)
      if (now > task.dueDate) {
        const hoursOverdue = Math.floor((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60));

        // Escalate at 1 hour, 1 day, and 3 days overdue
        const escalationPoints = [1, 24, 72];
        for (const hours of escalationPoints) {
          if (hoursOverdue >= hours && hoursOverdue < hours + 1) {
            const alreadyEscalated = await wasReminderSentToday(
              task.id,
              task.assignedTo.id,
              `OVERDUE_ESCALATION_${hours}HR`
            );

            if (!alreadyEscalated) {
              const clientName = task.client?.nameEncrypted || null;
              await createTaskReminderNotification(
                task.assignedTo.id,
                task.id,
                task.text,
                clientName,
                task.dueDate,
                `OVERDUE_ESCALATION_${hours}HR`,
                `The task "${task.text}" is ${hours} hour(s) overdue${clientName ? ` for client ${clientName}` : ''}. Please complete it as soon as possible.`
              );
              notificationsCreated++;
              console.log(`  ✅ Created overdue escalation (${hours}hr) for "${task.text}"`);
            }
          }
        }
      }
    }

    console.log(`✅ Task reminder check complete. Created ${notificationsCreated} notifications.`);
    return { tasksChecked: tasksWithReminders.length, notificationsCreated };
  } catch (error) {
    console.error('❌ Error checking task reminders:', error);
    throw error;
  }
}

/**
 * Run the task reminder job (can be called manually or scheduled)
 */
export async function runTaskReminderJob() {
  try {
    const result = await checkTaskReminders();
    return result;
  } catch (error) {
    console.error('Task reminder job failed:', error);
    throw error;
  }
}

// Allow running this file directly
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  runTaskReminderJob()
    .then(() => {
      console.log('Task reminder job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Task reminder job failed:', error);
      process.exit(1);
    });
}
