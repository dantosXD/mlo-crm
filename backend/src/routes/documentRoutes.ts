import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Define allowed MIME types and dangerous file extensions
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
  '.app', '.deb', '.rpm', '.dmg', '.pkg', '.sh', '.ps1', '.vb', '.wsf',
];

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Check for dangerous file extensions
    const fileName = file.originalname.toLowerCase();
    const hasDangerousExtension = DANGEROUS_EXTENSIONS.some(ext =>
      fileName.endsWith(ext)
    );

    if (hasDangerousExtension) {
      return cb(new Error(
        `File type not allowed. Dangerous file types (${DANGEROUS_EXTENSIONS.join(', ')}) are not permitted for security reasons.`
      ));
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(
        `File type not allowed. Allowed types: PDF, images (JPEG, PNG, GIF, TIFF, BMP, WebP), documents (Word, Excel, PowerPoint, RTF, CSV, plain text).`
      ));
    }

    cb(null, true);
  },
});

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
    const userId = req.user!.userId;
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
    const userId = req.user!.userId;
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

// POST /api/documents/upload - Upload a file with progress support
router.post('/upload', authenticateToken, (req: AuthRequest, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    // Handle multer errors (including file filter errors)
    if (err) {
      console.error('File upload error:', err.message);

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: 'File size exceeds the maximum limit of 50MB'
        });
      }

      // File type validation errors
      if (err.message && err.message.includes('File type not allowed')) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: err.message
        });
      }

      return res.status(400).json({
        error: 'Upload failed',
        message: err.message || 'Failed to upload file'
      });
    }

    try {
      const { clientId, name, category, status, notes } = req.body;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      if (!clientId) {
        return res.status(400).json({ error: 'clientId is required' });
      }

      // Check if user has access to this client
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(404).json({ error: 'Client not found' });
      }

      if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && client.createdById !== userId) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(403).json({ error: 'Access denied' });
      }

      const document = await prisma.document.create({
        data: {
          clientId,
          name: name || file.originalname,
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          status: status || 'UPLOADED',
          category: category || 'OTHER',
          notes: notes || null,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          clientId,
          type: 'DOCUMENT_UPLOADED',
          description: `Document "${document.name}" uploaded`,
          userId,
        },
      });

      res.status(201).json(document);
    } catch (error) {
      console.error('Error uploading document:', error);
      // Clean up file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });
});

// POST /api/documents - Create a document record (metadata only)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, name, fileName, filePath, fileSize, mimeType, status, category, dueDate, expiresAt, notes } = req.body;
    const userId = req.user!.userId;
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
        expiresAt: expiresAt ? new Date(expiresAt) : null,
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
    const { name, status, category, dueDate, expiresAt, notes } = req.body;
    const userId = req.user!.userId;
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
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : document.expiresAt,
        notes: notes !== undefined ? notes : document.notes,
      },
    });

    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// GET /api/documents/:id/download - Download a document file
router.get('/:id/download', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
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

    // Check if file exists
    if (!document.filePath || !fs.existsSync(document.filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');

    // Stream the file
    const fileStream = fs.createReadStream(document.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// POST /api/documents/request - Request a document from a client
router.post('/request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, documentName, category, dueDate, message } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (!clientId || !documentName) {
      return res.status(400).json({ error: 'clientId and documentName are required' });
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

    // Decrypt client email for the request
    const clientEmail = decrypt(client.emailEncrypted);
    const clientName = decrypt(client.nameEncrypted);

    // Create a document record with REQUESTED status
    const document = await prisma.document.create({
      data: {
        clientId,
        name: documentName,
        fileName: '', // Will be filled when client uploads
        filePath: '',
        fileSize: 0,
        mimeType: 'application/octet-stream',
        status: 'REQUESTED',
        category: category || 'OTHER',
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: message || null,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId,
        type: 'DOCUMENT_REQUESTED',
        description: `Document "${documentName}" requested from client`,
        userId,
      },
    });

    // In development mode, log the email to terminal instead of sending
    if (process.env.NODE_ENV === 'development') {
      console.log('\n========================================');
      console.log('📧 DOCUMENT REQUEST EMAIL (DEV MODE)');
      console.log('========================================');
      console.log(`To: ${clientEmail}`);
      console.log(`Subject: Document Request: ${documentName}`);
      console.log('\nBody:');
      console.log(`Dear ${clientName},`);
      console.log(`\nWe need you to provide the following document:`);
      console.log(`\nDocument: ${documentName}`);
      if (category) console.log(`Category: ${category}`);
      if (dueDate) console.log(`Due Date: ${new Date(dueDate).toLocaleDateString()}`);
      if (message) console.log(`\nMessage: ${message}`);
      console.log(`\nPlease upload this document through your client portal or contact us.`);
      console.log('\n========================================\n');
    }

    res.status(201).json({
      document,
      message: 'Document request sent successfully',
      emailLogged: process.env.NODE_ENV === 'development',
    });
  } catch (error) {
    console.error('Error requesting document:', error);
    res.status(500).json({ error: 'Failed to request document' });
  }
});

// DELETE /api/documents/:id - Delete a document
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
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
