import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, message, link, metadata } = params;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link: link || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return notification;
}

/**
 * Create a document reminder notification
 */
export async function createDocumentReminderNotification(
  userId: string,
  documentId: string,
  documentName: string,
  clientName: string,
  dueDate: Date
) {
  const isOverdue = new Date() > dueDate;
  const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  let title: string;
  let message: string;
  let type = 'DOCUMENT_REMINDER';

  if (isOverdue) {
    title = `Document Overdue: ${documentName}`;
    message = `The document "${documentName}" for client ${clientName} is overdue. It was due on ${dueDate.toLocaleDateString()}.`;
    type = 'DOCUMENT_OVERDUE';
  } else if (daysUntilDue <= 1) {
    title = `Document Due Tomorrow: ${documentName}`;
    message = `The document "${documentName}" for client ${clientName} is due tomorrow (${dueDate.toLocaleDateString()}).`;
  } else if (daysUntilDue <= 3) {
    title = `Document Due Soon: ${documentName}`;
    message = `The document "${documentName}" for client ${clientName} is due in ${daysUntilDue} days (${dueDate.toLocaleDateString()}).`;
  } else {
    // Only create notifications for documents due within 3 days or overdue
    return null;
  }

  return createNotification({
    userId,
    type,
    title,
    message,
    link: `/documents?filter=document_id:${documentId}`,
    metadata: {
      documentId,
      clientId: null, // Will be filled in if needed
      dueDate: dueDate.toISOString(),
    },
  });
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Get unread notifications count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  return prisma.notification.delete({
    where: { id: notificationId },
  });
}

/**
 * Create a task reminder notification
 */
export async function createTaskReminderNotification(
  userId: string,
  taskId: string,
  taskText: string,
  clientName: string | null,
  dueDate: Date,
  reminderType: string,
  customMessage?: string
) {
  const isOverdue = new Date() > dueDate;
  const timeUntilDue = dueDate.getTime() - Date.now();
  const minutesUntilDue = Math.ceil(timeUntilDue / (1000 * 60));
  const hoursUntilDue = Math.ceil(timeUntilDue / (1000 * 60 * 60));
  const daysUntilDue = Math.ceil(timeUntilDue / (1000 * 60 * 60 * 24));

  let title: string;
  let message: string;
  let type = 'TASK_REMINDER';

  if (customMessage) {
    title = `Task Reminder: ${taskText}`;
    message = customMessage;
  } else if (isOverdue) {
    title = `Task Overdue: ${taskText}`;
    const daysOverdue = Math.abs(daysUntilDue);
    if (daysOverdue === 0) {
      message = `The task "${taskText}" is overdue${clientName ? ` for client ${clientName}` : ''}. It was due today.`;
    } else {
      message = `The task "${taskText}" is overdue${clientName ? ` for client ${clientName}` : ''}. It was due ${daysOverdue} day(s) ago.`;
    }
    type = 'TASK_OVERDUE';
  } else if (reminderType === 'AT_TIME') {
    title = `Task Due Now: ${taskText}`;
    message = `The task "${taskText}" is due now${clientName ? ` for client ${clientName}` : ''}.`;
  } else if (reminderType === '15MIN') {
    title = `Task Due Soon: ${taskText}`;
    message = `The task "${taskText}" is due in 15 minutes${clientName ? ` for client ${clientName}` : ''}.`;
  } else if (reminderType === '1HR') {
    title = `Task Due in 1 Hour: ${taskText}`;
    message = `The task "${taskText}" is due in 1 hour${clientName ? ` for client ${clientName}` : ''}.`;
  } else if (reminderType === '1DAY') {
    title = `Task Due Tomorrow: ${taskText}`;
    message = `The task "${taskText}" is due tomorrow (${dueDate.toLocaleDateString()})${clientName ? ` for client ${clientName}` : ''}.`;
  } else if (reminderType === '1WEEK') {
    title = `Task Due in 1 Week: ${taskText}`;
    message = `The task "${taskText}" is due in 1 week (${dueDate.toLocaleDateString()})${clientName ? ` for client ${clientName}` : ''}.`;
  } else {
    title = `Task Reminder: ${taskText}`;
    message = `The task "${taskText}" is due soon${clientName ? ` for client ${clientName}` : ''}.`;
  }

  // Create notification
  const notification = await createNotification({
    userId,
    type,
    title,
    message,
    link: `/tasks?filter=task_id:${taskId}`,
    metadata: {
      taskId,
      clientId: null,
      dueDate: dueDate.toISOString(),
      reminderType,
    },
  });

  // Log reminder history
  await prisma.taskReminderHistory.create({
    data: {
      taskId,
      userId,
      reminderType,
      method: 'IN_APP',
      delivered: true,
    },
  });

  return notification;
}

/**
 * Check if a reminder was already sent for a specific reminder type today
 */
export async function wasReminderSentToday(taskId: string, userId: string, reminderType: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingReminder = await prisma.taskReminderHistory.findFirst({
    where: {
      taskId,
      userId,
      reminderType,
      remindedAt: {
        gte: today,
      },
    },
  });

  return !!existingReminder;
}

/**
 * Log reminder history
 */
export async function logReminderHistory(
  taskId: string,
  userId: string,
  reminderType: string,
  method: 'IN_APP' | 'EMAIL' | 'PUSH',
  delivered: boolean = true,
  metadata?: Record<string, any>
) {
  return prisma.taskReminderHistory.create({
    data: {
      taskId,
      userId,
      reminderType,
      method,
      delivered,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Get reminder history for a task
 */
export async function getTaskReminderHistory(taskId: string) {
  return prisma.taskReminderHistory.findMany({
    where: { taskId },
    orderBy: { remindedAt: 'desc' },
    take: 50,
  });
}
