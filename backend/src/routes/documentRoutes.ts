import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Simple encryption/decryption functions
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-32-bytes-long-here!';

function decrypt(encryptedData: string): string {
  try {
    const parsed = JSON.parse(encryptedData);
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      Buffer.from(parsed.iv, 'hex')
    );
    let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedData;
  }
}

// GET /api/documents - Get all documents (optionally filtered by client)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, status, category } = req.query;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Build where clause
    const whereClause: any = {};

    if (client_id) {
      whereClause.clientId = client_id as string;
    }

    if (status) {
      whereClause.status = status as string;
    }

    if (category) {
      whereClause.category = category as string;
    }

    // For non-admin users, only show documents for their clients
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      whereClause.client = {
        createdById: userId,
      };
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Decrypt client names and format response
    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      status: doc.status,
      category: doc.category,
      dueDate: doc.dueDate,
      expiresAt: doc.expiresAt,
      notes: doc.notes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      clientId: doc.clientId,
      clientName: doc.client ? decrypt(doc.client.nameEncrypted) : null,
    }));

    res.json(formattedDocuments);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/documents/:id - Get document by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permission
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      if (document.client?.createdById !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({
      id: document.id,
      name: document.name,
      fileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      status: document.status,
      category: document.category,
      dueDate: document.dueDate,
      expiresAt: document.expiresAt,
      notes: document.notes,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      clientId: document.clientId,
      clientName: document.client ? decrypt(document.client.nameEncrypted) : null,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// POST /api/documents - Create a document record (metadata only)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, name, fileName, filePath, fileSize, mimeType, status, category, dueDate, notes } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!clientId || !name || !fileName) {
      return res.status(400).json({ error: 'clientId, name, and fileName are required' });
    }

    // Check if user has access to this client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && client.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const document = await prisma.document.create({
      data: {
        clientId,
        name,
        fileName,
        filePath: filePath || '',
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/octet-stream',
        status: status || 'UPLOADED',
        category: category || 'OTHER',
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
      },
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// PUT /api/documents/:id - Update a document
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status, category, dueDate, notes } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permission
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      if (document.client?.createdById !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        name: name || document.name,
        status: status || document.status,
        category: category || document.category,
        dueDate: dueDate ? new Date(dueDate) : document.dueDate,
        notes: notes !== undefined ? notes : document.notes,
      },
    });

    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:id - Delete a document
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permission
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      if (document.client?.createdById !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await prisma.document.delete({ where: { id } });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
