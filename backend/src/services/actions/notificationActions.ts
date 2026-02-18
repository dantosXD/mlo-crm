import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult, replacePlaceholders, getClientData } from './types.js';
import { logger } from '../../utils/logger.js';

interface NotificationActionConfig {
  title?: string;
  message?: string;
  toUserId?: string;
  toRole?: string;
  link?: string;
}

interface ActivityActionConfig {
  type?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export async function executeSendNotification(
  config: NotificationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.message) return { success: false, message: 'Notification message is required' };

    const client = await getClientData(context.clientId);
    const placeholderContext = { ...context, clientData: client };
    const finalMessage = replacePlaceholders(config.message, placeholderContext);
    const finalTitle = config.title ? replacePlaceholders(config.title, placeholderContext) : 'Notification';

    let recipientIds: string[] = [];
    if (config.toUserId) {
      recipientIds = [config.toUserId];
    } else if (config.toRole) {
      const users = await prisma.user.findMany({ where: { role: config.toRole, isActive: true }, select: { id: true } });
      recipientIds = users.map((u) => u.id);
    } else {
      recipientIds = [context.userId];
    }

    if (recipientIds.length === 0) return { success: false, message: `No active users found to notify${config.toRole ? ` with role: ${config.toRole}` : ''}` };

    const notifications = await Promise.all(
      recipientIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId, title: finalTitle, message: finalMessage, type: 'WORKFLOW',
            link: config.link || `/clients/${context.clientId}`,
            metadata: JSON.stringify({ clientId: context.clientId, clientName: client.name, workflow: true }),
          },
        })
      )
    );

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'NOTIFICATION_SENT',
        description: `In-app notification sent to ${recipientIds.length} user(s) via workflow: ${finalTitle}`,
        metadata: JSON.stringify({ notificationIds: notifications.map((n) => n.id), recipientIds, title: finalTitle, message: finalMessage }),
      },
    });

    return { success: true, message: `Notification sent to ${recipientIds.length} user(s)`, data: { notificationIds: notifications.map((n) => n.id), recipientIds, title: finalTitle, message: finalMessage } };
  } catch (error) {
    logger.error('action_send_notification_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to send notification' };
  }
}

export async function executeLogActivity(
  config: ActivityActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.description) return { success: false, message: 'Activity description is required' };

    const client = await getClientData(context.clientId);
    const placeholderContext = { ...context, clientData: client };
    const finalDescription = replacePlaceholders(config.description, placeholderContext);

    const activity = await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId,
        type: config.type || 'WORKFLOW_ACTION', description: finalDescription,
        metadata: config.metadata ? JSON.stringify(config.metadata) : null,
      },
    });

    return { success: true, message: 'Activity logged successfully', data: { activityId: activity.id, type: activity.type, description: finalDescription } };
  } catch (error) {
    logger.error('action_log_activity_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to log activity' };
  }
}

export async function executeNotificationAction(
  actionType: string,
  config: NotificationActionConfig | ActivityActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'SEND_NOTIFICATION': return executeSendNotification(config as NotificationActionConfig, context);
    case 'LOG_ACTIVITY': return executeLogActivity(config as ActivityActionConfig, context);
    default: return { success: false, message: `Unknown notification action type: ${actionType}` };
  }
}
