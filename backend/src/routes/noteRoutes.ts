import { Router, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import { decodeClientPiiField } from '../utils/clientPiiCodec.js';
import {
  fireNoteCreatedTrigger,
  fireNoteWithTagTrigger,
} from '../services/triggerHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

interface NoteTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  tags?: string[] | string;
}

const DEFAULT_NOTE_TEMPLATES: Array<{ name: string; description: string; content: string; tags: string[] }> = [
  {
    name: 'Initial Contact',
    description: 'Use after the first call or meeting with a client.',
    content: 'Initial contact with client on [DATE].\n\nDiscussion points:\n- [TOPIC 1]\n- [TOPIC 2]\n\nNext steps:\n- [ACTION ITEM]',
    tags: ['initial-contact'],
  },
  {
    name: 'Follow-up Call',
    description: 'Capture outcomes from a follow-up call.',
    content: 'Follow-up call with client.\n\nStatus update:\n- [STATUS]\n\nClient questions:\n- [QUESTION]\n\nResolution:\n- [RESOLUTION]',
    tags: ['follow-up'],
  },
  {
    name: 'Document Received',
    description: 'Use when receiving a requested document.',
    content: 'Received [DOCUMENT TYPE] from client.\n\nDocument status: [PENDING REVIEW / APPROVED / NEEDS REVISION]\n\nNotes:\n- [NOTES]',
    tags: ['documents'],
  },
  {
    name: 'Rate Quote',
    description: 'Use when sending a quote.',
    content: 'Rate quote provided to client:\n\nLoan Amount: $[AMOUNT]\nRate: [RATE]%\nTerm: [YEARS] years\nMonthly Payment: $[PAYMENT]\n\nClient response: [RESPONSE]',
    tags: ['quote'],
  },
];

function parseTemplateTags(tags: NoteTemplateInput['tags']): string[] {
  if (Array.isArray(tags)) return tags.map((tag) => `${tag}`.trim()).filter(Boolean);
  if (typeof tags === 'string') {
    const trimmed = tags.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((tag) => `${tag}`.trim()).filter(Boolean);
      } catch {
        // fall through to CSV parsing
      }
    }
    return trimmed.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function normalizeClientNameHashSearch(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim().toLowerCase();
}

function safeParseStringArray(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => `${item}`.trim()).filter(Boolean);
  } catch {
    // Legacy malformed values may be CSV strings.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeNoteTemplate(template: {
  id: string;
  name: string;
  description: string | null;
  content: string;
  tags: string;
  isSystem: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    content: template.content,
    tags: safeParseStringArray(template.tags),
    isSystem: template.isSystem,
    source: template.isSystem ? 'SYSTEM' : 'PERSONAL',
    createdById: template.createdById,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

async function ensureSystemNoteTemplates() {
  const count = await prisma.noteTemplate.count({ where: { isSystem: true } });
  if (count > 0) return;

  await prisma.noteTemplate.createMany({
    data: DEFAULT_NOTE_TEMPLATES.map((template) => ({
      name: template.name,
      description: template.description,
      content: template.content,
      tags: JSON.stringify(template.tags),
      isSystem: true,
    })),
  });
}

async function listVisibleNoteTemplates(userId: string) {
  await ensureSystemNoteTemplates();
  const templates = await prisma.noteTemplate.findMany({
    where: {
      OR: [
        { isSystem: true },
        { createdById: userId },
      ],
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  return templates.map(normalizeNoteTemplate);
}

// GET /api/notes - List notes (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, search, page = '1', limit = '25', paginated = 'false' } = req.query;
    const normalizedSearch = typeof search === 'string' ? search.trim().toLowerCase() : '';
    const normalizedClientNameSearch = normalizeClientNameHashSearch(normalizedSearch);
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 25, 1), 100);
    const wantsPaginated = String(paginated) === 'true';
    const baseWhere = {
      ...(client_id ? { clientId: client_id as string } : {}),
    };
    const where: Prisma.NoteWhereInput = normalizedSearch
      ? {
          ...baseWhere,
          OR: [
            { text: { contains: normalizedSearch } },
            { client: { is: { nameHash: normalizedClientNameSearch } } },
          ],
        }
      : baseWhere;

    const baseInclude = {
      createdBy: {
        select: { id: true, name: true },
      },
      client: {
        select: { id: true, nameEncrypted: true },
      },
    } satisfies Prisma.NoteInclude;
    type NoteWithRelations = Prisma.NoteGetPayload<{ include: typeof baseInclude }>;

    let totalFromDatabase = 0;
    let notes: NoteWithRelations[] = [];

    if (wantsPaginated) {
      totalFromDatabase = await prisma.note.count({ where });
      notes = await prisma.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: baseInclude,
      });
    } else {
      notes = await prisma.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: baseInclude,
      });
    }

    const formattedNotes = notes.map(note => ({
      id: note.id,
      clientId: note.clientId,
      clientName: note.client ? (decodeClientPiiField(note.client.nameEncrypted).trim() || 'Unknown') : 'Unknown',
      text: note.text,
      tags: JSON.parse(note.tags),
      isPinned: note.isPinned,
      createdBy: note.createdBy,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));

    if (!wantsPaginated) {
      return res.json(formattedNotes.slice(0, 100));
    }

    return res.json({
      notes: formattedNotes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFromDatabase,
        totalPages: totalFromDatabase > 0 ? Math.ceil(totalFromDatabase / limitNum) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch notes',
    });
  }
});

// GET /api/notes/templates - list system + personal note templates
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const templates = await listVisibleNoteTemplates(userId);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching note templates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch note templates',
    });
  }
});

// GET /api/notes/templates/list - backward-compatible alias
router.get('/templates/list', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const templates = await listVisibleNoteTemplates(userId);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching note templates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch note templates',
    });
  }
});

// POST /api/notes/templates - create personal note template
router.post('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const payload = req.body as NoteTemplateInput;
    const name = payload.name?.trim();
    const content = payload.content?.trim();
    if (!name || !content) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Template name and content are required',
      });
    }

    const template = await prisma.noteTemplate.create({
      data: {
        name,
        description: payload.description?.trim() || null,
        content,
        tags: JSON.stringify(parseTemplateTags(payload.tags)),
        isSystem: false,
        createdById: userId,
      },
    });

    res.status(201).json(normalizeNoteTemplate(template));
  } catch (error) {
    console.error('Error creating note template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create note template',
    });
  }
});

// PUT /api/notes/templates/:id - update personal note template
router.put('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const existing = await prisma.noteTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Note template not found',
      });
    }
    if (existing.isSystem) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'System templates are read-only',
      });
    }
    if (existing.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only update your own templates',
      });
    }

    const payload = req.body as NoteTemplateInput;
    if (payload.name !== undefined && !payload.name.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Template name cannot be empty',
      });
    }
    if (payload.content !== undefined && !payload.content.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Template content cannot be empty',
      });
    }

    const template = await prisma.noteTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(payload.name !== undefined && { name: payload.name.trim() }),
        ...(payload.description !== undefined && { description: payload.description?.trim() || null }),
        ...(payload.content !== undefined && { content: payload.content.trim() }),
        ...(payload.tags !== undefined && { tags: JSON.stringify(parseTemplateTags(payload.tags)) }),
      },
    });

    res.json(normalizeNoteTemplate(template));
  } catch (error) {
    console.error('Error updating note template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update note template',
    });
  }
});

// DELETE /api/notes/templates/:id - delete personal note template
router.delete('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const existing = await prisma.noteTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Note template not found',
      });
    }
    if (existing.isSystem) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'System templates are read-only',
      });
    }
    if (existing.createdById !== userId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only delete your own templates',
      });
    }

    await prisma.noteTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Note template archived successfully' });
  } catch (error) {
    console.error('Error deleting note template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete note template',
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

    // Fire NOTE_CREATED workflow trigger
    await fireNoteCreatedTrigger(note.id, clientId, userId);

    // Fire NOTE_WITH_TAG trigger for each tag
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await fireNoteWithTagTrigger(note.id, clientId, tag, userId);
      }
    }

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
        type: 'NOTE_ARCHIVED',
        description: 'Note archived',
      },
    });

    res.json({ message: 'Note archived successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete note',
    });
  }
});

export default router;
