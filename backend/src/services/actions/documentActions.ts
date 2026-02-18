import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult, getClientData } from './types.js';
import { logger } from '../../utils/logger.js';
import { getEnv } from '../../config/env.js';

interface DocumentActionConfig {
  status?: string;
  documentId?: string;
  category?: string;
  name?: string;
  dueDays?: number;
  dueDate?: Date;
  message?: string;
}

export async function executeUpdateDocumentStatus(
  config: DocumentActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.status) return { success: false, message: 'Status is required for UPDATE_DOCUMENT_STATUS action' };

    const validStatuses = ['REQUIRED', 'REQUESTED', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'];
    if (!validStatuses.includes(config.status)) return { success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };

    if (config.documentId) {
      const document = await prisma.document.findUnique({ where: { id: config.documentId } });
      if (!document) return { success: false, message: `Document not found: ${config.documentId}` };
      if (document.clientId !== context.clientId) return { success: false, message: 'Document does not belong to the trigger client' };

      const updatedDocument = await prisma.document.update({ where: { id: config.documentId }, data: { status: config.status } });

      await prisma.activity.create({
        data: {
          clientId: context.clientId, userId: context.userId, type: 'DOCUMENT_STATUS_CHANGED',
          description: `Document "${updatedDocument.name}" status changed to ${config.status} via workflow`,
          metadata: JSON.stringify({ documentId: updatedDocument.id, documentName: updatedDocument.name, fromStatus: document.status, toStatus: config.status }),
        },
      });

      return { success: true, message: 'Document status updated successfully', data: { documentId: updatedDocument.id, documentName: updatedDocument.name, fromStatus: document.status, toStatus: config.status } };
    }

    const documents = await prisma.document.findMany({ where: { clientId: context.clientId } });
    if (documents.length === 0) return { success: false, message: 'No documents found for client' };

    const { count } = await prisma.document.updateMany({
      where: { clientId: context.clientId },
      data: { status: config.status },
    });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'DOCUMENT_STATUS_CHANGED',
        description: `All documents (${count}) status changed to ${config.status} via workflow`,
        metadata: JSON.stringify({ count, toStatus: config.status }),
      },
    });

    return { success: true, message: `Updated ${count} document(s) to ${config.status}`, data: { count, toStatus: config.status } };
  } catch (error) {
    logger.error('action_update_document_status_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update document status' };
  }
}

export async function executeRequestDocument(
  config: DocumentActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.category) return { success: false, message: 'Document category is required for REQUEST_DOCUMENT action' };

    const validCategories = ['INCOME', 'EMPLOYMENT', 'ASSETS', 'PROPERTY', 'INSURANCE', 'CREDIT', 'OTHER'];
    if (!validCategories.includes(config.category)) return { success: false, message: `Invalid category. Must be one of: ${validCategories.join(', ')}` };

    let documentName = config.name;
    if (!documentName) documentName = `${config.category.charAt(0).toUpperCase() + config.category.slice(1).toLowerCase()} Document`;

    let dueDate: Date | null = null;
    if (config.dueDays) { dueDate = new Date(); dueDate.setDate(dueDate.getDate() + config.dueDays); }
    else if (config.dueDate) { dueDate = config.dueDate; }

    const client = await getClientData(context.clientId);

    const document = await prisma.document.create({
      data: {
        clientId: context.clientId, name: documentName, fileName: '', filePath: '',
        fileSize: 0, mimeType: 'application/octet-stream', status: 'REQUESTED',
        category: config.category, dueDate, notes: config.message || null,
      },
    });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'DOCUMENT_REQUESTED',
        description: `Document "${documentName}" requested from client via workflow`,
        metadata: JSON.stringify({ documentId: document.id, documentName, category: config.category, dueDate }),
      },
    });

    const isDev = getEnv().NODE_ENV === 'development';
    if (isDev) {
      logger.debug('action_request_document_email_dev', {
        to: client.email,
        subject: `Document Request: ${documentName}`,
        documentName,
        category: config.category,
        dueDate: dueDate?.toLocaleDateString(),
        message: config.message,
      });
    }

    return { success: true, message: 'Document request sent successfully', data: { documentId: document.id, documentName, category: config.category, dueDate, emailLogged: isDev } };
  } catch (error) {
    logger.error('action_request_document_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to request document' };
  }
}

export async function executeDocumentAction(
  actionType: string,
  config: DocumentActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'UPDATE_DOCUMENT_STATUS': return executeUpdateDocumentStatus(config, context);
    case 'REQUEST_DOCUMENT': return executeRequestDocument(config, context);
    default: return { success: false, message: `Unknown document action type: ${actionType}` };
  }
}
