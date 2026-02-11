import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();
type LoanProgramTemplateRecord = Awaited<ReturnType<typeof prisma.loanProgramTemplate.create>>;

// All routes require authentication
router.use(authenticateToken);

// ── GET /  — List all loan program templates for current user ──────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const templates = await prisma.loanProgramTemplate.findMany({
      where: { createdById: userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return res.json(templates);
  } catch (error: any) {
    console.error('Error fetching loan program templates:', error);
    return res.status(500).json({ error: 'Failed to fetch loan program templates' });
  }
});

// ── GET /active  — List only active templates (for scenario builder) ───
router.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const templates = await prisma.loanProgramTemplate.findMany({
      where: { createdById: userId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return res.json(templates);
  } catch (error: any) {
    console.error('Error fetching active loan program templates:', error);
    return res.status(500).json({ error: 'Failed to fetch active loan program templates' });
  }
});

// ── POST /  — Create a new loan program template ──────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, category, termYears, defaultRate, armConfig, loanType, isActive, sortOrder, notes } = req.body;

    if (!name || !termYears) {
      return res.status(400).json({ error: 'name and termYears are required' });
    }

    const template = await prisma.loanProgramTemplate.create({
      data: {
        name,
        category: category || 'FIXED',
        termYears: parseInt(termYears, 10),
        defaultRate: defaultRate != null ? parseFloat(defaultRate) : null,
        armConfig: armConfig ? (typeof armConfig === 'string' ? armConfig : JSON.stringify(armConfig)) : null,
        loanType: loanType || 'conventional',
        isActive: isActive !== false,
        sortOrder: sortOrder ?? 0,
        notes: notes || null,
        createdById: userId,
      },
    });

    return res.status(201).json(template);
  } catch (error: any) {
    console.error('Error creating loan program template:', error);
    return res.status(500).json({ error: 'Failed to create loan program template' });
  }
});

// ── POST /bulk  — Create multiple templates at once (seeding) ─────────
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { templates } = req.body;
    if (!Array.isArray(templates) || templates.length === 0) {
      return res.status(400).json({ error: 'templates array is required' });
    }

    const created: LoanProgramTemplateRecord[] = [];
    for (const t of templates) {
      const createdTemplate: LoanProgramTemplateRecord = await prisma.loanProgramTemplate.create({
        data: {
          name: t.name,
          category: t.category || 'FIXED',
          termYears: parseInt(t.termYears, 10),
          defaultRate: t.defaultRate != null ? parseFloat(t.defaultRate) : null,
          armConfig: t.armConfig ? (typeof t.armConfig === 'string' ? t.armConfig : JSON.stringify(t.armConfig)) : null,
          loanType: t.loanType || 'conventional',
          isActive: t.isActive !== false,
          sortOrder: t.sortOrder ?? created.length,
          notes: t.notes || null,
          createdById: userId,
        },
      });
      created.push(createdTemplate);
    }

    return res.status(201).json({ created: created.length, templates: created });
  } catch (error: any) {
    console.error('Error bulk creating loan program templates:', error);
    return res.status(500).json({ error: 'Failed to bulk create loan program templates' });
  }
});

// ── PUT /:id  — Update a loan program template ───────────────────────
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const existing = await prisma.loanProgramTemplate.findFirst({
      where: { id, createdById: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Loan program template not found' });
    }

    const { name, category, termYears, defaultRate, armConfig, loanType, isActive, sortOrder, notes } = req.body;

    const template = await prisma.loanProgramTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(termYears !== undefined && { termYears: parseInt(termYears, 10) }),
        ...(defaultRate !== undefined && { defaultRate: defaultRate != null ? parseFloat(defaultRate) : null }),
        ...(armConfig !== undefined && { armConfig: armConfig ? (typeof armConfig === 'string' ? armConfig : JSON.stringify(armConfig)) : null }),
        ...(loanType !== undefined && { loanType }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    return res.json(template);
  } catch (error: any) {
    console.error('Error updating loan program template:', error);
    return res.status(500).json({ error: 'Failed to update loan program template' });
  }
});

// ── PUT /reorder  — Reorder templates ─────────────────────────────────
router.put('/reorder/batch', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { order } = req.body; // [{ id: string, sortOrder: number }]
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order array is required' });
    }

    for (const item of order) {
      await prisma.loanProgramTemplate.updateMany({
        where: { id: item.id, createdById: userId },
        data: { sortOrder: item.sortOrder },
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error reordering templates:', error);
    return res.status(500).json({ error: 'Failed to reorder templates' });
  }
});

// ── DELETE /:id  — Delete a loan program template ─────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const existing = await prisma.loanProgramTemplate.findFirst({
      where: { id, createdById: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Loan program template not found' });
    }

    await prisma.loanProgramTemplate.delete({ where: { id } });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting loan program template:', error);
    return res.status(500).json({ error: 'Failed to delete loan program template' });
  }
});

export default router;
