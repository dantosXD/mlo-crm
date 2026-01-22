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
