import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/notes - List notes (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, search } = req.query;

    const notes = await prisma.note.findMany({
      where: {
        ...(client_id ? { clientId: client_id as string } : {}),
        ...(search ? {
          text: {
            contains: search as string,
          }
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, nameEncrypted: true },
        },
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

    const formattedNotes = notes.map(note => ({
      id: note.id,
      clientId: note.clientId,
      clientName: note.client ? decryptName(note.client.nameEncrypted) : 'Unknown',
      text: note.text,
      tags: JSON.parse(note.tags),
      isPinned: note.isPinned,
      createdBy: note.createdBy,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));

    res.json(formattedNotes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch notes',
    });
  }
});

// GET /api/notes/:id - Get single note
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!note) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Note not found',
      });
    }

    res.json({
      id: note.id,
      clientId: note.clientId,
      text: note.text,
      tags: JSON.parse(note.tags),
      isPinned: note.isPinned,
      createdBy: note.createdBy,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch note',
    });
  }
});

// POST /api/notes - Create new note
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, text, tags, isPinned } = req.body;
    const userId = req.user?.userId;

    if (!clientId || !text || !userId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Client ID and text are required',
      });
    }

    const note = await prisma.note.create({
      data: {
        clientId,
        text,
        tags: JSON.stringify(tags || []),
        isPinned: isPinned || false,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId,
        userId,
        type: 'NOTE_ADDED',
        description: 'Note added to client',
      },
    });

    res.status(201).json({
      id: note.id,
      clientId: note.clientId,
      text: note.text,
      tags: JSON.parse(note.tags),
      isPinned: note.isPinned,
      createdBy: note.createdBy,
      createdAt: note.createdAt,
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create note',
    });
  }
});

// PUT /api/notes/:id - Update note
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text, tags, isPinned } = req.body;
    const userId = req.user?.userId;

    const existingNote = await prisma.note.findUnique({ where: { id } });

    if (!existingNote) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Note not found',
      });
    }

    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(text !== undefined && { text }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(isPinned !== undefined && { isPinned }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: note.clientId,
        userId: userId!,
        type: 'NOTE_UPDATED',
        description: 'Note updated',
      },
    });

    res.json({
      id: note.id,
      clientId: note.clientId,
      text: note.text,
      tags: JSON.parse(note.tags),
      isPinned: note.isPinned,
      createdBy: note.createdBy,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update note',
    });
  }
});

// DELETE /api/notes/:id - Delete note
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const existingNote = await prisma.note.findUnique({ where: { id } });

    if (!existingNote) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Note not found',
      });
    }

    await prisma.note.delete({ where: { id } });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: existingNote.clientId,
        userId: userId!,
        type: 'NOTE_DELETED',
        description: 'Note deleted',
      },
    });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete note',
    });
  }
});

// GET /api/notes/templates - Get all note templates
router.get('/templates/list', async (req: AuthRequest, res: Response) => {
  try {
    let templates = await prisma.noteTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    // Create default templates if none exist
    if (templates.length === 0) {
      const defaultTemplates = [
        {
          name: 'Initial Contact',
          content: 'Initial contact with client on [DATE].\n\nDiscussion points:\n- [TOPIC 1]\n- [TOPIC 2]\n\nNext steps:\n- [ACTION ITEM]',
        },
        {
          name: 'Follow-up Call',
          content: 'Follow-up call with client.\n\nStatus update:\n- [STATUS]\n\nClient questions:\n- [QUESTION]\n\nResolution:\n- [RESOLUTION]',
        },
        {
          name: 'Document Received',
          content: 'Received [DOCUMENT TYPE] from client.\n\nDocument status: [PENDING REVIEW / APPROVED / NEEDS REVISION]\n\nNotes:\n- [NOTES]',
        },
        {
          name: 'Rate Quote',
          content: 'Rate quote provided to client:\n\nLoan Amount: $[AMOUNT]\nRate: [RATE]%\nTerm: [YEARS] years\nMonthly Payment: $[PAYMENT]\n\nClient response: [RESPONSE]',
        },
      ];

      for (const template of defaultTemplates) {
        await prisma.noteTemplate.create({
          data: template,
        });
      }

      templates = await prisma.noteTemplate.findMany({
        orderBy: { name: 'asc' },
      });
    }

    const formattedTemplates = templates.map(t => ({
      id: t.id,
      name: t.name,
      content: t.content,
      tags: JSON.parse(t.tags),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    res.json(formattedTemplates);
  } catch (error) {
    console.error('Error fetching note templates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch note templates',
    });
  }
});

export default router;
