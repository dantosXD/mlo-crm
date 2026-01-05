import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/notes - List notes (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id } = req.query;

    const notes = await prisma.note.findMany({
      where: client_id ? { clientId: client_id as string } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    const formattedNotes = notes.map(note => ({
      id: note.id,
      clientId: note.clientId,
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

export default router;
