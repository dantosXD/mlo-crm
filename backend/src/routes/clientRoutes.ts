import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Roles that can create/update/delete clients (per RBAC spec)
const CLIENT_WRITE_ROLES = ['ADMIN', 'MANAGER', 'MLO'];
// Roles that can only read clients
// const CLIENT_READ_ONLY_ROLES = ['PROCESSOR', 'UNDERWRITER', 'VIEWER'];

// GET /api/clients - List all clients for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    // Users can only see their own clients (data isolation)
    const clients = await prisma.client.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Decrypt client data would happen here in production
    const decryptedClients = clients.map(client => ({
      id: client.id,
      // In production, these would be decrypted
      name: client.nameEncrypted,
      email: client.emailEncrypted,
      phone: client.phoneEncrypted,
      status: client.status,
      tags: JSON.parse(client.tags),
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    }));

    res.json(decryptedClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch clients',
    });
  }
});

// GET /api/clients/statuses - Get available client statuses
router.get('/statuses', async (req: AuthRequest, res: Response) => {
  try {
    // Return all valid client statuses with their labels
    const statuses = [
      { value: 'LEAD', label: 'Lead' },
      { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
      { value: 'ACTIVE', label: 'Active' },
      { value: 'PROCESSING', label: 'Processing' },
      { value: 'UNDERWRITING', label: 'Underwriting' },
      { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
      { value: 'CLOSED', label: 'Closed' },
      { value: 'DENIED', label: 'Denied' },
      { value: 'INACTIVE', label: 'Inactive' },
    ];

    res.json(statuses);
  } catch (error) {
    console.error('Error fetching client statuses:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch client statuses',
    });
  }
});

// TEST ENDPOINT: GET /api/clients/test-500-error - Intentionally returns 500 error for testing
// This endpoint is used to verify that the frontend handles 500 errors gracefully
// NOTE: This must be defined BEFORE the /:id route to avoid being caught as an ID parameter
router.get('/test-500-error', (req: AuthRequest, res: Response) => {
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'This is a test error to verify graceful error handling',
  });
});

// GET /api/clients/:id - Get single client
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        notes: { take: 5, orderBy: { createdAt: 'desc' } },
        tasks: { take: 5, orderBy: { createdAt: 'desc' } },
        documents: { take: 5, orderBy: { createdAt: 'desc' } },
        loanScenarios: true,
      },
    });

    if (!client) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found',
      });
    }

    // Data isolation: Users can only access their own clients
    if (client.createdById !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this client',
      });
    }

    res.json({
      id: client.id,
      name: client.nameEncrypted,
      email: client.emailEncrypted,
      phone: client.phoneEncrypted,
      status: client.status,
      tags: JSON.parse(client.tags),
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      notes: client.notes,
      tasks: client.tasks,
      documents: client.documents,
      loanScenarios: client.loanScenarios,
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch client',
    });
  }
});

// POST /api/clients - Create new client
// Only ADMIN, MANAGER, MLO can create clients (per RBAC spec)
router.post('/', authorizeRoles(...CLIENT_WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, status, tags } = req.body;
    const userId = req.user?.userId;

    // Trim input values
    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim();
    const trimmedPhone = phone?.trim();

    // Validate required fields
    if (!trimmedName || !trimmedEmail || !userId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name and email are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Please enter a valid email address',
      });
    }

    // Check for duplicate email (same user)
    const existingClient = await prisma.client.findFirst({
      where: {
        createdById: userId,
        emailHash: trimmedEmail.toLowerCase(),
      },
    });

    if (existingClient) {
      return res.status(409).json({
        error: 'Duplicate Email',
        message: 'A client with this email address already exists',
      });
    }

    // In production, encrypt these values
    const client = await prisma.client.create({
      data: {
        nameEncrypted: trimmedName,
        emailEncrypted: trimmedEmail,
        phoneEncrypted: trimmedPhone || '',
        nameHash: trimmedName.toLowerCase(),
        emailHash: trimmedEmail.toLowerCase(),
        phoneHash: trimmedPhone || '',
        status: status || 'LEAD',
        tags: JSON.stringify(tags || []),
        createdById: userId,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: client.id,
        userId,
        type: 'CLIENT_CREATED',
        description: `Client ${trimmedName} created`,
      },
    });

    res.status(201).json({
      id: client.id,
      name: client.nameEncrypted,
      email: client.emailEncrypted,
      phone: client.phoneEncrypted,
      status: client.status,
      tags: JSON.parse(client.tags),
      createdAt: client.createdAt,
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create client',
    });
  }
});

// PUT /api/clients/:id - Update client
// Only ADMIN, MANAGER, MLO can update clients (per RBAC spec)
router.put('/:id', authorizeRoles(...CLIENT_WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, status, tags } = req.body;
    const userId = req.user?.userId;

    const existingClient = await prisma.client.findUnique({ where: { id } });

    if (!existingClient) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found',
      });
    }

    // Data isolation: Users can only update their own clients
    if (existingClient.createdById !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this client',
      });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name && { nameEncrypted: name, nameHash: name.toLowerCase() }),
        ...(email && { emailEncrypted: email, emailHash: email.toLowerCase() }),
        ...(phone !== undefined && { phoneEncrypted: phone, phoneHash: phone }),
        ...(status && { status }),
        ...(tags && { tags: JSON.stringify(tags) }),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: client.id,
        userId: userId!,
        type: 'CLIENT_UPDATED',
        description: `Client ${name || existingClient.nameEncrypted} updated`,
      },
    });

    res.json({
      id: client.id,
      name: client.nameEncrypted,
      email: client.emailEncrypted,
      phone: client.phoneEncrypted,
      status: client.status,
      tags: JSON.parse(client.tags),
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update client',
    });
  }
});

// DELETE /api/clients/:id - Delete client
// Only ADMIN, MANAGER, MLO can delete clients (per RBAC spec)
router.delete('/:id', authorizeRoles(...CLIENT_WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const existingClient = await prisma.client.findUnique({ where: { id } });

    if (!existingClient) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found',
      });
    }

    // Data isolation: Users can only delete their own clients
    if (existingClient.createdById !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this client',
      });
    }

    await prisma.client.delete({ where: { id } });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: userId!,
        type: 'CLIENT_DELETED',
        description: `Client ${existingClient.nameEncrypted} deleted`,
      },
    });

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete client',
    });
  }
});

// PATCH /api/clients/bulk - Bulk update client status
// Only ADMIN, MANAGER, MLO can bulk update clients
router.patch('/bulk', authorizeRoles(...CLIENT_WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { clientIds, status } = req.body;
    const userId = req.user?.userId;

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'clientIds must be a non-empty array',
      });
    }

    if (!status) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'status is required',
      });
    }

    // Verify all clients belong to the user and exist
    const clients = await prisma.client.findMany({
      where: {
        id: { in: clientIds },
        createdById: userId,
      },
    });

    if (clients.length !== clientIds.length) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Some clients do not exist or you do not have access to them',
      });
    }

    // Bulk update
    await prisma.client.updateMany({
      where: {
        id: { in: clientIds },
        createdById: userId,
      },
      data: { status },
    });

    // Log activities
    for (const client of clients) {
      await prisma.activity.create({
        data: {
          clientId: client.id,
          userId: userId!,
          type: 'CLIENT_UPDATED',
          description: `Client ${client.nameEncrypted} status changed to ${status}`,
        },
      });
    }

    res.json({
      message: `${clientIds.length} client(s) updated successfully`,
      updatedCount: clientIds.length,
    });
  } catch (error) {
    console.error('Error bulk updating clients:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to bulk update clients',
    });
  }
});

export default router;
