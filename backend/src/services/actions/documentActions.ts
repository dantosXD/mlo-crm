import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult, getClientData } from './types.js';

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

    const updatedDocuments = await Promise.all(
      documents.map((doc) => prisma.document.update({ where: { id: doc.id }, data: { status: config.status } }))
    );

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'DOCUMENT_STATUS_CHANGED',
        description: `All documents (${updatedDocuments.length}) status changed to ${config.status} via workflow`,
        metadata: JSON.stringify({ documentIds: updatedDocuments.map((d) => d.id), toStatus: config.status }),
      },
    });

    return { success: true, message: `Updated ${updatedDocuments.length} document(s) to ${config.status}`, data: { count: updatedDocuments.length, documentIds: updatedDocuments.map((d) => d.id), toStatus: config.status } };
  } catch (error) {
    console.error('Error executing UPDATE_DOCUMENT_STATUS action:', error);
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

    if (process.env.NODE_ENV === 'development') {
      console.log('\n========================================');
      console.log('📧 DOCUMENT REQUEST EMAIL (DEV MODE)');
      console.log('========================================');
      console.log(`To: ${client.email}`);
      console.log(`Subject: Document Request: ${documentName}`);
      console.log(`\nDocument: ${documentName}`);
      console.log(`Category: ${config.category}`);
      if (dueDate) console.log(`Due Date: ${dueDate.toLocaleDateString()}`);
      if (config.message) console.log(`\nMessage: ${config.message}`);
      console.log('\n========================================\n');
    }

    return { success: true, message: 'Document request sent successfully', data: { documentId: document.id, documentName, category: config.category, dueDate, emailLogged: process.env.NODE_ENV === 'development' } };
  } catch (error) {
    console.error('Error executing REQUEST_DOCUMENT action:', error);
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
