import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import { uploadFileToS3, getPresignedDownloadUrl } from '../utils/s3.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Helper function to check if user has access to communication's attachments
function canAccessCommunicationAttachments(userRole: string, userId: string, communicationCreatedById: string): boolean {
  // Admin and Manager can access all communications
  if (userRole === 'ADMIN' || userRole === 'MANAGER') {
    return true;
  }

  // MLO, Processor, Underwriter can only access their own communications
  if (userId === communicationCreatedById) {
    return true;
  }

  return false;
}

function getActiveAttachments(attachments: any[]): any[] {
  return attachments.filter((attachment) => !attachment?.isArchived);
}

// POST /api/attachments/upload - Upload attachment to a communication
router.post('/upload', async (req: AuthRequest, res: Response) => {
  try {
    const { communicationId, fileName, fileSize, mimeType, fileData } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Validation
    if (!communicationId || !fileName || !mimeType || !fileData) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Communication ID, file name, MIME type, and file data are required',
      });
    }

    // Check if communication exists
    const communication = await prisma.communication.findUnique({
      where: { id: communicationId },
    });

    if (!communication) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
    }

    // Check access permissions
    if (!canAccessCommunicationAttachments(userRole!, userId!, communication.createdById)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to add attachments to this communication',
      });
    }

    // Prevent adding attachments to sent communications
    if (communication.status === 'SENT') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot add attachments to sent communications',
      });
    }

    // Convert base64 file data to buffer
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileBuffer.length > maxSize) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'File size exceeds maximum allowed size of 10MB',
      });
    }

    // Upload file to S3
    const uploadedFile = await uploadFileToS3(
      fileBuffer,
      fileName,
      mimeType,
      'communications/'
    );

    // Get current attachments
    const currentAttachments = communication.attachments
      ? JSON.parse(communication.attachments)
      : [];

    // Add new attachment
    const updatedAttachments = [
      ...currentAttachments,
      {
        ...uploadedFile,
        isArchived: false,
      },
    ];

    // Update communication with new attachment
    const updatedCommunication = await prisma.communication.update({
      where: { id: communicationId },
      data: {
        attachments: JSON.stringify(updatedAttachments),
      },
      select: {
        id: true,
        attachments: true,
      },
    });

    res.status(201).json({
      message: 'Attachment uploaded successfully',
      attachment: uploadedFile,
      attachments: updatedCommunication.attachments
        ? getActiveAttachments(JSON.parse(updatedCommunication.attachments))
        : [],
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to upload attachment',
    });
  }
});

// GET /api/attachments/:communicationId/download/:fileName - Get download URL for attachment
router.get('/:communicationId/download/:fileName', async (req: AuthRequest, res: Response) => {
  try {
    const { communicationId, fileName } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Check if communication exists
    const communication = await prisma.communication.findUnique({
      where: { id: communicationId },
    });

    if (!communication) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
    }

    // Check access permissions
    if (!canAccessCommunicationAttachments(userRole!, userId!, communication.createdById)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to download attachments from this communication',
      });
    }

    // Get attachments
    const attachments = communication.attachments ? JSON.parse(communication.attachments) : [];

    // Find the requested attachment
    const attachment = attachments.find((a: any) => a.fileName === fileName && !a.isArchived);

    if (!attachment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Attachment not found',
      });
    }

    // Generate presigned download URL
    const downloadUrl = await getPresignedDownloadUrl(attachment.filePath);

    res.json({
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      downloadUrl,
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate download URL',
    });
  }
});

// DELETE /api/attachments/:communicationId/:fileName - Delete attachment from communication
router.delete('/:communicationId/:fileName', async (req: AuthRequest, res: Response) => {
  try {
    const { communicationId, fileName } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Check if communication exists
    const communication = await prisma.communication.findUnique({
      where: { id: communicationId },
    });

    if (!communication) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
    }

    // Check access permissions
    if (!canAccessCommunicationAttachments(userRole!, userId!, communication.createdById)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to delete attachments from this communication',
      });
    }

    // Prevent deleting attachments from sent communications
    if (communication.status === 'SENT') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot delete attachments from sent communications',
      });
    }

    // Get current attachments
    const currentAttachments = communication.attachments
      ? JSON.parse(communication.attachments)
      : [];

    // Find the attachment to delete
    const attachmentToDelete = currentAttachments.find((a: any) => a.fileName === fileName);

    if (!attachmentToDelete) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Attachment not found',
      });
    }

    const updatedAttachments = currentAttachments.map((attachment: any) => {
      if (attachment.fileName !== fileName) {
        return attachment;
      }

      return {
        ...attachment,
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedById: userId,
      };
    });

    // Update communication
    await prisma.communication.update({
      where: { id: communicationId },
      data: {
        attachments: JSON.stringify(updatedAttachments),
      },
    });

    res.json({
      message: 'Attachment archived successfully',
      attachments: getActiveAttachments(updatedAttachments),
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete attachment',
    });
  }
});

// DELETE /api/attachments/:communicationId - Delete all attachments from communication
router.delete('/:communicationId', async (req: AuthRequest, res: Response) => {
  try {
    const { communicationId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Check if communication exists
    const communication = await prisma.communication.findUnique({
      where: { id: communicationId },
    });

    if (!communication) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
    }

    // Check access permissions
    if (!canAccessCommunicationAttachments(userRole!, userId!, communication.createdById)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to delete attachments from this communication',
      });
    }

    // Prevent deleting attachments from sent communications
    if (communication.status === 'SENT') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot delete attachments from sent communications',
      });
    }

    // Get current attachments
    const currentAttachments = communication.attachments
      ? JSON.parse(communication.attachments)
      : [];

    // Non-destructive policy: mark all attachments as archived and keep files in storage.
    const updatedAttachments = currentAttachments.map((attachment: any) => ({
      ...attachment,
      isArchived: true,
      archivedAt: new Date().toISOString(),
      archivedById: userId,
    }));

    await prisma.communication.update({
      where: { id: communicationId },
      data: {
        attachments: JSON.stringify(updatedAttachments),
      },
    });

    res.json({
      message: 'All attachments archived successfully',
    });
  } catch (error) {
    console.error('Error deleting attachments:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete attachments',
    });
  }
});

export default router;
