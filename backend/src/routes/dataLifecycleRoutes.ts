import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';

const router = Router();

const ENTITY_DELEGATES: Record<string, string> = {
  User: 'user',
  Client: 'client',
  Note: 'note',
  Task: 'task',
  TaskSubtask: 'taskSubtask',
  TaskAttachment: 'taskAttachment',
  Document: 'document',
  LoanScenario: 'loanScenario',
  LoanProgramTemplate: 'loanProgramTemplate',
  TaskTemplate: 'taskTemplate',
  Notification: 'notification',
  CommunicationTemplate: 'communicationTemplate',
  Communication: 'communication',
  Workflow: 'workflow',
  Event: 'event',
  Reminder: 'reminder',
  CalendarShare: 'calendarShare',
};

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'MANAGER'));

// GET /api/data-lifecycle/versions
router.get('/versions', async (req: AuthRequest, res: Response) => {
  try {
    const {
      entityType,
      entityId,
      operation,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string | undefined>;

    const take = Math.max(1, Math.min(parseInt(limit || '50', 10) || 50, 200));
    const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
    const skip = (currentPage - 1) * take;

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (operation) where.operation = operation;

    const [items, total] = await Promise.all([
      prisma.entityVersion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.entityVersion.count({ where }),
    ]);

    res.json({
      data: items,
      pagination: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Failed to fetch version history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch version history',
    });
  }
});

// GET /api/data-lifecycle/archived/:entityType
router.get('/archived/:entityType', async (req: AuthRequest, res: Response) => {
  try {
    const { entityType } = req.params;
    const { page = '1', limit = '50' } = req.query as Record<string, string | undefined>;

    const delegateName = ENTITY_DELEGATES[entityType];
    if (!delegateName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Unsupported entity type: ${entityType}`,
      });
    }

    const delegate = (prisma as any)[delegateName];
    if (!delegate?.findMany || !delegate?.count) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Entity type not queryable: ${entityType}`,
      });
    }

    const take = Math.max(1, Math.min(parseInt(limit || '50', 10) || 50, 200));
    const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
    const skip = (currentPage - 1) * take;
    const where = { deletedAt: { not: null } };

    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip,
        take,
      }),
      delegate.count({ where }),
    ]);

    res.json({
      data: items,
      pagination: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Failed to fetch archived records:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch archived records',
    });
  }
});

// POST /api/data-lifecycle/restore
router.post('/restore', async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, id } = req.body as { entityType?: string; id?: string };
    if (!entityType || !id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entityType and id are required',
      });
    }

    const delegateName = ENTITY_DELEGATES[entityType];
    if (!delegateName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Unsupported entity type: ${entityType}`,
      });
    }

    const delegate = (prisma as any)[delegateName];
    if (!delegate?.findUnique || !delegate?.update) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Entity type not restorable: ${entityType}`,
      });
    }

    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `${entityType} not found`,
      });
    }

    const updateData: Record<string, unknown> = { deletedAt: null };
    if ('isActive' in existing) updateData.isActive = true;
    if ('status' in existing && existing.status === 'ARCHIVED') updateData.status = 'DRAFT';

    const restored = await delegate.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: `${entityType} restored successfully`,
      data: restored,
    });
  } catch (error) {
    console.error('Failed to restore archived record:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to restore archived record',
    });
  }
});

export default router;
