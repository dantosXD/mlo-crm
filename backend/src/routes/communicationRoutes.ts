import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import { previewTemplate, extractPlaceholders } from '../utils/placeholders.js';

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
      scheduled,
      follow_up,
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

    // Filter by scheduled communications
    if (scheduled === 'true') {
      where.scheduledAt = { not: null };
    }

    // Filter by follow-up due
    if (follow_up === 'true') {
      where.followUpDate = { not: null };
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
      followUpDate: comm.followUpDate,
      attachments: comm.attachments ? JSON.parse(comm.attachments) : [],
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

// GET /api/communications/search - Search communications by subject, body, or client name
// NOTE: This route must come before /:id to avoid 'search' being interpreted as an ID
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q, type, status, page = '1', limit = '50' } = req.query;

    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Validation: query parameter is required
    if (!q || (q as string).trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Search query is required',
      });
    }

    const searchQuery = (q as string).trim();

    // Build where clause
    // SQLite doesn't support mode: 'insensitive', so we use LIKE with lowercase
    const where: any = {
      OR: [
        { subject: { contains: searchQuery, mode: 'insensitive' } },
        { body: { contains: searchQuery, mode: 'insensitive' } },
      ],
    };

    // Filter by type if specified
    if (type) {
      where.type = type as string;
    }

    // Filter by status if specified
    if (status) {
      where.status = status as string;
    }

    // Role-based data filtering
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      where.createdById = userId;
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Search communications
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

    // Also search by client name (requires fetching all clients and filtering)
    // This is less efficient but necessary for encrypted data
    const allClients = await prisma.client.findMany({
      where: userRole !== 'ADMIN' && userRole !== 'MANAGER' ? { createdById: userId } : {},
      select: { id: true, nameEncrypted: true },
    });

    const matchingClientIds = allClients
      .filter((client) => decryptName(client.nameEncrypted).toLowerCase().includes(searchQuery.toLowerCase()))
      .map((client) => client.id);

    // If we have matching clients, fetch those communications too
    let clientMatchCommunications: any[] = [];
    if (matchingClientIds.length > 0) {
      const clientWhere: any = {
        clientId: { in: matchingClientIds },
      };

      if (type) clientWhere.type = type as string;
      if (status) clientWhere.status = status as string;
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        clientWhere.createdById = userId;
      }

      clientMatchCommunications = await prisma.communication.findMany({
        where: clientWhere,
        orderBy: { createdAt: 'desc' },
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
    }

    // Merge results and remove duplicates
    const allResults = [...communications];
    const existingIds = new Set(communications.map((c) => c.id));

    clientMatchCommunications.forEach((comm) => {
      if (!existingIds.has(comm.id)) {
        allResults.push(comm);
      }
    });

    // Apply pagination to merged results
    const paginatedResults = allResults.slice(skip, skip + take);

    const formattedCommunications = paginatedResults.map((comm) => ({
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
      followUpDate: comm.followUpDate,
      attachments: comm.attachments ? JSON.parse(comm.attachments) : [],
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
        total: allResults.length,
        totalPages: Math.ceil(allResults.length / parseInt(limit as string)),
      },
      query: searchQuery,
    });
  } catch (error) {
    console.error('Error searching communications:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search communications',
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
      attachments: communication.attachments ? JSON.parse(communication.attachments) : [],
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
      followUpDate,
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
        followUpDate: followUpDate ? new Date(followUpDate) : null,
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
      attachments: communication.attachments ? JSON.parse(communication.attachments) : [],
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
      followUpDate,
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
    if (followUpDate !== undefined) updateData.followUpDate = followUpDate ? new Date(followUpDate) : null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'SENT') {
        updateData.sentAt = new Date();
        // Clear follow-up date when communication is sent
        updateData.followUpDate = null;
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
      attachments: communication.attachments ? JSON.parse(communication.attachments) : [],
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

// PATCH /api/communications/:id/status - Update communication status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Validation
    if (!status) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Status is required',
      });
    }

    const validStatuses = ['DRAFT', 'READY', 'SENT', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

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

    // Validate status transitions (cannot go backwards)
    const statusFlow = ['DRAFT', 'READY', 'SENT', 'FAILED'];
    const currentStatusIndex = statusFlow.indexOf(existingCommunication.status);
    const newStatusIndex = statusFlow.indexOf(status);

    // Allow: DRAFT->READY, READY->SENT, any->FAILED
    // Allow same status (no-op)
    // Disallow: SENT->anything, READY->DRAFT, FAILED->anything
    if (status === existingCommunication.status) {
      return res.json({
        message: 'Status unchanged',
        communication: {
          id: existingCommunication.id,
          status: existingCommunication.status,
        },
      });
    }

    // Define allowed transitions
    const allowedTransitions: Record<string, string[]> = {
      'DRAFT': ['READY', 'FAILED'],
      'READY': ['SENT', 'FAILED'],
      'SENT': [], // Cannot change from SENT
      'FAILED': [], // Cannot change from FAILED
    };

    if (!allowedTransitions[existingCommunication.status]?.includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Cannot transition from ${existingCommunication.status} to ${status}. Allowed transitions: ${allowedTransitions[existingCommunication.status].join(', ') || 'none'}`,
      });
    }

    // Build update data
    const updateData: any = { status };
    if (status === 'SENT') {
      updateData.sentAt = new Date();
    }

    // Update communication status
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
        type: 'COMMUNICATION_STATUS_CHANGED',
        description: `Communication status changed from ${existingCommunication.status} to ${status}`,
        metadata: JSON.stringify({
          communicationId: communication.id,
          oldStatus: existingCommunication.status,
          newStatus: status,
          type: communication.type,
        }),
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
      attachments: communication.attachments ? JSON.parse(communication.attachments) : [],
      createdBy: communication.createdBy,
      metadata: communication.metadata ? JSON.parse(communication.metadata) : null,
      createdAt: communication.createdAt,
      updatedAt: communication.updatedAt,
    });
  } catch (error) {
    console.error('Error updating communication status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update communication status',
    });
  }
});

// POST /api/communications/:id/send - Mark communication as sent
router.post('/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { metadata } = req.body; // Optional metadata (e.g., email provider response)
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
        message: 'You do not have permission to send this communication',
      });
    }

    // Validate current status (can only send from READY or DRAFT)
    if (existingCommunication.status === 'SENT') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Communication has already been sent',
      });
    }

    if (existingCommunication.status === 'FAILED') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot send a failed communication. Update status to READY first.',
      });
    }

    // Update communication to SENT
    const communication = await prisma.communication.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        ...(metadata && { metadata: JSON.stringify(metadata) }),
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
        clientId: communication.clientId,
        userId: userId!,
        type: 'COMMUNICATION_SENT',
        description: `${communication.type} communication sent to client`,
        metadata: JSON.stringify({
          communicationId: communication.id,
          type: communication.type,
          subject: communication.subject,
        }),
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
      attachments: communication.attachments ? JSON.parse(communication.attachments) : [],
      createdBy: communication.createdBy,
      metadata: communication.metadata ? JSON.parse(communication.metadata) : null,
      createdAt: communication.createdAt,
      updatedAt: communication.updatedAt,
    });
  } catch (error) {
    console.error('Error sending communication:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send communication',
    });
  }
});

// POST /api/communications/preview - Preview communication with placeholders filled
router.post('/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, body, subject, additionalContext } = req.body;
    const userId = req.user?.userId;

    // Validation
    if (!clientId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Client ID is required',
      });
    }

    if (!body) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Message body is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
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

    // Preview body
    const bodyPreview = await previewTemplate(
      body,
      clientId,
      userId,
      additionalContext
    );

    // Preview subject if provided
    let subjectPreview = null;
    if (subject) {
      subjectPreview = await previewTemplate(
        subject,
        clientId,
        userId,
        additionalContext
      );
    }

    res.json({
      body: {
        original: bodyPreview.original,
        filled: bodyPreview.filled,
        placeholders: bodyPreview.placeholders,
        missing: bodyPreview.missing,
      },
      subject: subjectPreview
        ? {
            original: subjectPreview.original,
            filled: subjectPreview.filled,
            placeholders: subjectPreview.placeholders,
            missing: subjectPreview.missing,
          }
        : null,
      context: {
        // Return safe context values (no sensitive data)
        client_name: bodyPreview.context.client_name || '',
        client_status: bodyPreview.context.client_status || '',
        loan_officer_name: bodyPreview.context.loan_officer_name || '',
        company_name: bodyPreview.context.company_name || '',
        date: bodyPreview.context.date || '',
        time: bodyPreview.context.time || '',
        has_loan_amount: !!bodyPreview.context.loan_amount,
        has_client_email: !!bodyPreview.context.client_email,
        has_client_phone: !!bodyPreview.context.client_phone,
      },
    });
  } catch (error) {
    console.error('Error previewing communication:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to preview communication',
    });
  }
});

export default router;
