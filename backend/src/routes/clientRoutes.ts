import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import { decodeClientPiiField } from '../utils/clientPiiCodec.js';
import {
  fireClientCreatedTrigger,
  fireClientUpdatedTrigger,
  fireClientStatusChangedTrigger,
  firePipelineStageEntryTrigger,
  firePipelineStageExitTrigger,
} from '../services/triggerHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Helper function to safely parse tags JSON
function parseTags(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing tags:', error);
    return [];
  }
}

// Roles that can create/update/delete clients (per RBAC spec)
const CLIENT_WRITE_ROLES = ['ADMIN', 'MANAGER', 'MLO'];
// Roles that can only read clients
// const CLIENT_READ_ONLY_ROLES = ['PROCESSOR', 'UNDERWRITER', 'VIEWER'];

// GET /api/clients - List all clients for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { sortBy, sortOrder, q, status, tag, dateRange, page, limit } = req.query;

    console.log(`[API] GET /api/clients - sortBy: ${sortBy}, sortOrder: ${sortOrder}`);
    const parsedPage = Math.max(1, Number.parseInt(String(page ?? '1'), 10) || 1);
    const parsedLimit = Math.min(500, Math.max(1, Number.parseInt(String(limit ?? '100'), 10) || 100));
    const offset = (parsedPage - 1) * parsedLimit;
    const qText = typeof q === 'string' ? q.trim().toLowerCase() : '';
    const phoneSearch = qText.replace(/\D/g, '');
    const statusFilter = typeof status === 'string' && status.trim() !== '' ? status : null;
    const tagFilter = typeof tag === 'string' && tag.trim() !== '' ? tag : null;
    const dateRangeFilter = typeof dateRange === 'string' && dateRange.trim() !== '' ? dateRange : null;
    const shouldReturnPaginated =
      page !== undefined ||
      limit !== undefined ||
      q !== undefined ||
      status !== undefined ||
      tag !== undefined ||
      dateRange !== undefined;

    // Build orderBy object based on query parameters
    let orderBy: any = { createdAt: 'desc' }; // default sort
    if (sortBy && typeof sortBy === 'string') {
      const direction = sortOrder === 'asc' ? 'asc' : 'desc';
      // Map frontend field names to database field names
      const fieldMap: { [key: string]: string } = {
        name: 'nameEncrypted',
        email: 'emailEncrypted',
        status: 'status',
        createdAt: 'createdAt',
      };
      const dbField = fieldMap[sortBy];
      if (dbField) {
        orderBy = { [dbField]: direction };
        console.log(`[API] Using orderBy:`, orderBy);
      }
    } else {
      console.log(`[API] Using default orderBy:`, orderBy);
    }

    const andFilters: any[] = [
      { createdById: userId },
      { deletedAt: null },
    ];

    if (statusFilter) {
      andFilters.push({ status: statusFilter });
    }

    if (tagFilter) {
      andFilters.push({ tags: { contains: `"${tagFilter}"` } });
    }

    if (dateRangeFilter) {
      const now = Date.now();
      const daysByRange: Record<string, number> = {
        last7days: 7,
        last30days: 30,
        last90days: 90,
      };
      const days = daysByRange[dateRangeFilter];
      if (days) {
        andFilters.push({
          createdAt: {
            gte: new Date(now - days * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    if (qText) {
      const orFilters: any[] = [
        { nameHash: { contains: qText } },
        { emailHash: { contains: qText } },
      ];
      if (phoneSearch) {
        orFilters.push({ phoneHash: { contains: phoneSearch } });
      }
      andFilters.push({ OR: orFilters });
    }

    const where = andFilters.length > 0 ? { AND: andFilters } : {};

    // Users can only see their own clients (data isolation)
    const findManyArgs = shouldReturnPaginated
      ? { where, orderBy, skip: offset, take: parsedLimit }
      : { where, orderBy, skip: 0, take: 100 };

    const clients = await prisma.client.findMany(findManyArgs);

    const total = shouldReturnPaginated
      ? await prisma.client.count({ where })
      : clients.length;

    // Decrypt client data would happen here in production
    const decryptedClients = clients.map(client => ({
      id: client.id,
      name: decodeClientPiiField(client.nameEncrypted),
      email: decodeClientPiiField(client.emailEncrypted),
      phone: decodeClientPiiField(client.phoneEncrypted),
      status: client.status,
      tags: parseTags(client.tags),
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    }));

    if (shouldReturnPaginated) {
      return res.json({
        data: decryptedClients,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
        },
      });
    }

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

// GET /api/clients/statistics - Aggregate client statistics for current user
router.get('/statistics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { days } = req.query;
    const parsedDays = Number.parseInt(String(days ?? ''), 10);

    const andFilters: any[] = [
      { createdById: userId },
      { deletedAt: null },
    ];

    if (Number.isFinite(parsedDays) && parsedDays > 0) {
      andFilters.push({
        createdAt: {
          gte: new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000),
        },
      });
    }

    const where = { AND: andFilters };

    const [totalClients, groupedByStatus] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true,
        },
      }),
    ]);

    const byStatus = groupedByStatus.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {});

    res.json({
      totalClients,
      byStatus,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching client statistics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch client statistics',
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

    if (!client || client.deletedAt !== null) {
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
      name: decodeClientPiiField(client.nameEncrypted),
      email: decodeClientPiiField(client.emailEncrypted),
      phone: decodeClientPiiField(client.phoneEncrypted),
      status: client.status,
      tags: parseTags(client.tags),
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
    // Sanitize name before storing in hash to prevent issues with special characters
    const sanitizedName = trimmedName.replace(/<[^>]*>/g, '');
    const client = await prisma.client.create({
      data: {
        nameEncrypted: trimmedName,
        emailEncrypted: trimmedEmail,
        phoneEncrypted: trimmedPhone || '',
        nameHash: sanitizedName.toLowerCase(),
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
        description: `Client ${sanitizedName} created`,
      },
    });

    // Fire CLIENT_CREATED trigger for workflows
    await fireClientCreatedTrigger(client.id, userId);

    // Create an actionable in-app notification for quick follow-up.
    await prisma.notification.create({
      data: {
        userId,
        type: 'CLIENT_CREATED',
        title: 'Client created',
        message: `${sanitizedName} was added to your pipeline.`,
        link: `/clients/${client.id}`,
      },
    });

    res.status(201).json({
      id: client.id,
      name: decodeClientPiiField(client.nameEncrypted),
      email: decodeClientPiiField(client.emailEncrypted),
      phone: decodeClientPiiField(client.phoneEncrypted),
      status: client.status,
      tags: parseTags(client.tags),
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

    // Sanitize name for hash field to prevent issues with special characters
    const sanitizedNameForHash = name ? name.replace(/<[^>]*>/g, '') : undefined;

    // Track what changed for trigger data
    const changes: Record<string, any> = {};
    const oldStatus = existingClient.status;

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name && { nameEncrypted: name, nameHash: sanitizedNameForHash!.toLowerCase() }),
        ...(email && { emailEncrypted: email, emailHash: email.toLowerCase() }),
        ...(phone !== undefined && { phoneEncrypted: phone, phoneHash: phone }),
        ...(status && { status }),
        ...(tags && { tags: JSON.stringify(tags) }),
      },
    });

    // Build changes object for trigger
    if (name && name !== existingClient.nameEncrypted) changes.name = { from: existingClient.nameEncrypted, to: name };
    if (email && email !== existingClient.emailEncrypted) changes.email = { from: existingClient.emailEncrypted, to: email };
    if (phone !== undefined && phone !== existingClient.phoneEncrypted) changes.phone = { from: existingClient.phoneEncrypted, to: phone };
    if (status && status !== oldStatus) changes.status = { from: oldStatus, to: status };
    if (tags) {
      const oldTags = JSON.parse(existingClient.tags);
      changes.tags = { from: oldTags, to: tags };
    }

    // Log activity (sanitize name to prevent XSS in activity logs)
    const sanitizedNameForLog = (name || existingClient.nameEncrypted).replace(/<[^>]*>/g, '');
    await prisma.activity.create({
      data: {
        clientId: client.id,
        userId: userId!,
        type: 'CLIENT_UPDATED',
        description: `Client ${sanitizedNameForLog} updated`,
      },
    });

    // Fire CLIENT_UPDATED trigger for workflows
    await fireClientUpdatedTrigger(client.id, userId!, changes);

    // Fire CLIENT_STATUS_CHANGED trigger if status changed
    if (status && status !== oldStatus) {
      await fireClientStatusChangedTrigger(client.id, userId!, oldStatus, status);

      // Fire pipeline stage triggers
      await firePipelineStageExitTrigger(client.id, userId!, oldStatus, status);
      await firePipelineStageEntryTrigger(client.id, userId!, status);
    }

    res.json({
      id: client.id,
      name: decodeClientPiiField(client.nameEncrypted),
      email: decodeClientPiiField(client.emailEncrypted),
      phone: decodeClientPiiField(client.phoneEncrypted),
      status: client.status,
      tags: parseTags(client.tags),
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

    // Log activity (sanitize name to prevent XSS in activity logs)
    const sanitizedName = existingClient.nameEncrypted.replace(/<[^>]*>/g, '');
    await prisma.activity.create({
      data: {
        userId: userId!,
        type: 'CLIENT_ARCHIVED',
        description: `Client ${sanitizedName} archived`,
      },
    });

    res.json({ message: 'Client archived successfully' });
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

    // Log activities and fire triggers for each client
    for (const client of clients) {
      const sanitizedName = client.nameEncrypted.replace(/<[^>]*>/g, '');
      const oldStatus = client.status;

      await prisma.activity.create({
        data: {
          clientId: client.id,
          userId: userId!,
          type: 'CLIENT_UPDATED',
          description: `Client ${sanitizedName} status changed to ${status}`,
        },
      });

      // Fire CLIENT_UPDATED trigger
      await fireClientUpdatedTrigger(client.id, userId!, { status: { from: oldStatus, to: status } });

      // Fire CLIENT_STATUS_CHANGED trigger
      await fireClientStatusChangedTrigger(client.id, userId!, oldStatus, status);

      // Fire pipeline stage triggers
      await firePipelineStageExitTrigger(client.id, userId!, oldStatus, status);
      await firePipelineStageEntryTrigger(client.id, userId!, status);
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
