import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Helper function to check if user has access to client's communications
function canAccessClientCommunication(userRole: string, userId: string, communicationCreatedById: string): boolean {
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

// GET /api/communications - List communications with filtering
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      client_id,
      type,
      status,
      start_date,
      end_date,
      page = '1',
      limit = '50'
    } = req.query;

    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Build where clause
    const where: any = {};

    // Filter by client
    if (client_id) {
      where.clientId = client_id as string;
    }

    // Filter by type
    if (type) {
      where.type = type as string;
    }

    // Filter by status
    if (status) {
      where.status = status as string;
    }

    // Filter by date range
    if (start_date || end_date) {
      where.createdAt = {};
      if (start_date) {
        where.createdAt.gte = new Date(start_date as string);
      }
      if (end_date) {
        where.createdAt.lte = new Date(end_date as string);
      }
    }

    // Role-based data filtering
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      // MLO, Processor, Underwriter can only see their own communications
      where.createdById = userId;
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          client: {
            select: { id: true, nameEncrypted: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          template: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.communication.count({ where }),
    ]);

    // Helper to decrypt client name
    const decryptName = (encrypted: string | null): string => {
      if (!encrypted) return 'Unknown';
      try {
        const parsed = JSON.parse(encrypted);
        return parsed.data || 'Unknown';
      } catch {
        return encrypted;
      }
    };

    const formattedCommunications = communications.map(comm => ({
      id: comm.id,
      clientId: comm.clientId,
      clientName: comm.client ? decryptName(comm.client.nameEncrypted) : 'Unknown',
      type: comm.type,
      status: comm.status,
      subject: comm.subject,
      body: comm.body,
      templateId: comm.templateId,
      templateName: comm.template?.name || null,
      scheduledAt: comm.scheduledAt,
      sentAt: comm.sentAt,
      createdBy: comm.createdBy,
      metadata: comm.metadata ? JSON.parse(comm.metadata) : null,
      createdAt: comm.createdAt,
      updatedAt: comm.updatedAt,
    }));

    res.json({
      data: formattedCommunications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch communications',
    });
  }
});

// GET /api/communications/:id - Get single communication
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const communication = await prisma.communication.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        template: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!communication) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
    }

    // Check access permissions
    if (!canAccessClientCommunication(userRole!, userId!, communication.createdById)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to view this communication',
      });
    }

    // Helper to decrypt client name
    const decryptName = (encrypted: string | null): string => {
      if (!encrypted) return 'Unknown';
      try {
        const parsed = JSON.parse(encrypted);
        return parsed.data || 'Unknown';
      } catch {
        return encrypted;
      }
    };

    res.json({
      id: communication.id,
      clientId: communication.clientId,
      clientName: communication.client ? decryptName(communication.client.nameEncrypted) : 'Unknown',
      type: communication.type,
      status: communication.status,
      subject: communication.subject,
      body: communication.body,
      templateId: communication.templateId,
      template: communication.template,
      scheduledAt: communication.scheduledAt,
      sentAt: communication.sentAt,
      createdBy: communication.createdBy,
      metadata: communication.metadata ? JSON.parse(communication.metadata) : null,
      createdAt: communication.createdAt,
      updatedAt: communication.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching communication:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch communication',
    });
  }
});

// POST /api/communications - Create new communication (draft)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      clientId,
      type,
      subject,
      body,
      templateId,
      scheduledAt,
      metadata
    } = req.body;

    const userId = req.user?.userId;

    // Validation
    if (!clientId || !type || !body || !userId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Client ID, type, and body are required',
      });
    }

    // Validate type
    const validTypes = ['EMAIL', 'SMS', 'LETTER'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // For EMAIL and LETTER, subject is required
    if ((type === 'EMAIL' || type === 'LETTER') && !subject) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Subject is required for EMAIL and LETTER types',
      });
    }

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found',
      });
    }

    // If templateId provided, verify it exists
    if (templateId) {
      const template = await prisma.communicationTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Communication template not found',
        });
      }
    }

    // Create communication
    const communication = await prisma.communication.create({
      data: {
        clientId,
        type,
        subject: subject || null,
        body,
        templateId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'DRAFT',
        createdById: userId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        template: {
          select: { id: true, name: true },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId,
        userId,
        type: 'COMMUNICATION_CREATED',
        description: `${type} communication draft created`,
        metadata: JSON.stringify({ communicationId: communication.id, type }),
      },
    });

    // Helper to decrypt client name
    const decryptName = (encrypted: string | null): string => {
      if (!encrypted) return 'Unknown';
      try {
        const parsed = JSON.parse(encrypted);
        return parsed.data || 'Unknown';
      } catch {
        return encrypted;
      }
    };

    res.status(201).json({
      id: communication.id,
      clientId: communication.clientId,
      clientName: communication.client ? decryptName(communication.client.nameEncrypted) : 'Unknown',
      type: communication.type,
      status: communication.status,
      subject: communication.subject,
      body: communication.body,
      templateId: communication.templateId,
      templateName: communication.template?.name || null,
      scheduledAt: communication.scheduledAt,
      sentAt: communication.sentAt,
      createdBy: communication.createdBy,
      metadata: communication.metadata ? JSON.parse(communication.metadata) : null,
      createdAt: communication.createdAt,
      updatedAt: communication.updatedAt,
    });
  } catch (error) {
    console.error('Error creating communication:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create communication',
    });
  }
});

// PUT /api/communications/:id - Update communication
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      type,
      subject,
      body,
      templateId,
      scheduledAt,
      status,
      metadata
    } = req.body;

    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Check if communication exists
    const existingCommunication = await prisma.communication.findUnique({
      where: { id },
    });

    if (!existingCommunication) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
    }

    // Check access permissions
    if (!canAccessClientCommunication(userRole!, userId!, existingCommunication.createdById)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to update this communication',
      });
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['EMAIL', 'SMS', 'LETTER'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Type must be one of: ${validTypes.join(', ')}`,
        });
      }
    }

    // For EMAIL and LETTER, subject is required
    const communicationType = type || existingCommunication.type;
    if ((communicationType === 'EMAIL' || communicationType === 'LETTER') && !subject && !existingCommunication.subject) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Subject is required for EMAIL and LETTER types',
      });
    }

    // If templateId provided, verify it exists
    if (templateId) {
      const template = await prisma.communicationTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Communication template not found',
        });
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['DRAFT', 'READY', 'SENT', 'FAILED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        });
      }
    }

    // Build update data
    const updateData: any = {};
    if (type !== undefined) updateData.type = type;
    if (subject !== undefined) updateData.subject = subject;
    if (body !== undefined) updateData.body = body;
    if (templateId !== undefined) updateData.templateId = templateId;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'SENT') {
        updateData.sentAt = new Date();
      }
    }
    if (metadata !== undefined) updateData.metadata = metadata ? JSON.stringify(metadata) : null;

    // Update communication
    const communication = await prisma.communication.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        template: {
          select: { id: true, name: true },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: communication.clientId,
        userId: userId!,
        type: 'COMMUNICATION_UPDATED',
        description: `Communication updated${status ? ` to status: ${status}` : ''}`,
        metadata: JSON.stringify({ communicationId: communication.id, status: communication.status }),
      },
    });

    // Helper to decrypt client name
    const decryptName = (encrypted: string | null): string => {
      if (!encrypted) return 'Unknown';
      try {
        const parsed = JSON.parse(encrypted);
        return parsed.data || 'Unknown';
      } catch {
        return encrypted;
      }
    };

    res.json({
      id: communication.id,
      clientId: communication.clientId,
      clientName: communication.client ? decryptName(communication.client.nameEncrypted) : 'Unknown',
      type: communication.type,
      status: communication.status,
      subject: communication.subject,
      body: communication.body,
      templateId: communication.templateId,
      templateName: communication.template?.name || null,
      scheduledAt: communication.scheduledAt,
      sentAt: communication.sentAt,
      createdBy: communication.createdBy,
      metadata: communication.metadata ? JSON.parse(communication.metadata) : null,
      createdAt: communication.createdAt,
      updatedAt: communication.updatedAt,
    });
  } catch (error) {
    console.error('Error updating communication:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update communication',
    });
  }
});

// DELETE /api/communications/:id - Delete communication
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Check if communication exists
    const existingCommunication = await prisma.communication.findUnique({
      where: { id },
    });

    if (!existingCommunication) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
    }

    // Check access permissions
    if (!canAccessClientCommunication(userRole!, userId!, existingCommunication.createdById)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to delete this communication',
      });
    }

    // Prevent deletion of sent communications (soft delete by status instead)
    if (existingCommunication.status === 'SENT') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot delete sent communications. Update status to FAILED or keep for records.',
      });
    }

    await prisma.communication.delete({ where: { id } });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: existingCommunication.clientId,
        userId: userId!,
        type: 'COMMUNICATION_DELETED',
        description: `${existingCommunication.type} communication deleted`,
        metadata: JSON.stringify({ communicationId: id, type: existingCommunication.type }),
      },
    });

    res.json({ message: 'Communication deleted successfully' });
  } catch (error) {
    console.error('Error deleting communication:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete communication',
    });
  }
});

export default router;
