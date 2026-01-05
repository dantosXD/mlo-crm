import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/clients - List all clients
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
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

// GET /api/clients/:id - Get single client
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

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
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, status, tags } = req.body;
    const userId = req.user?.userId;

    if (!name || !email || !userId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name and email are required',
      });
    }

    // In production, encrypt these values
    const client = await prisma.client.create({
      data: {
        nameEncrypted: name,
        emailEncrypted: email,
        phoneEncrypted: phone || '',
        nameHash: name.toLowerCase(),
        emailHash: email.toLowerCase(),
        phoneHash: phone || '',
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
        description: `Client ${name} created`,
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
router.put('/:id', async (req: AuthRequest, res: Response) => {
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
router.delete('/:id', async (req: AuthRequest, res: Response) => {
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

export default router;
