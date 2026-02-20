import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

const VALID_INTERACTION_TYPES = [
  'CALL_PLACED',
  'CALL_RECEIVED',
  'EMAIL_SENT',
  'EMAIL_RECEIVED',
  'MEETING',
  'TEXT_SENT',
  'TEXT_RECEIVED',
  'INTERACTION_OTHER',
] as const;

type OffsetUnit = 'minutes' | 'hours' | 'days';
type FollowUpKind = 'TASK' | 'REMINDER';

interface OffsetConfig {
  value: number;
  unit: OffsetUnit;
  atTime?: string;
}

interface ActivityTemplateConfig {
  type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface ActivityFollowUpConfig {
  enabled?: boolean;
  kind: FollowUpKind;
  text?: string;
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  dueOffset?: OffsetConfig;
  remindOffset?: OffsetConfig;
  tags?: string[];
}

function parseActivityMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidType(type: string): boolean {
  return VALID_INTERACTION_TYPES.includes(type as (typeof VALID_INTERACTION_TYPES)[number]);
}

function validateOffset(offset: unknown, fieldName: string): OffsetConfig {
  if (!isObject(offset)) {
    throw new Error(`${fieldName} must be an object`);
  }
  const value = Number(offset.value);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName}.value must be a non-negative number`);
  }

  const unit = `${offset.unit}`;
  if (!['minutes', 'hours', 'days'].includes(unit)) {
    throw new Error(`${fieldName}.unit must be one of: minutes, hours, days`);
  }

  const atTime = offset.atTime !== undefined ? `${offset.atTime}` : undefined;
  if (atTime !== undefined && !/^\d{2}:\d{2}$/.test(atTime)) {
    throw new Error(`${fieldName}.atTime must use HH:MM format`);
  }

  return {
    value,
    unit: unit as OffsetUnit,
    ...(atTime !== undefined && { atTime }),
  };
}

function resolveOffsetDate(offset: OffsetConfig, referenceDate = new Date()): Date {
  const result = new Date(referenceDate);
  switch (offset.unit) {
    case 'minutes':
      result.setMinutes(result.getMinutes() + offset.value);
      break;
    case 'hours':
      result.setHours(result.getHours() + offset.value);
      break;
    case 'days':
      result.setDate(result.getDate() + offset.value);
      break;
  }

  if (offset.atTime) {
    const [hours, minutes] = offset.atTime.split(':').map((part) => Number(part));
    result.setHours(hours, minutes, 0, 0);
  }

  return result;
}

function validateTemplateConfig(config: unknown): ActivityTemplateConfig {
  if (!isObject(config)) throw new Error('config must be an object');

  if (config.type !== undefined && typeof config.type !== 'string') {
    throw new Error('config.type must be a string');
  }
  if (typeof config.type === 'string' && !isValidType(config.type)) {
    throw new Error(`config.type must be one of: ${VALID_INTERACTION_TYPES.join(', ')}`);
  }

  if (config.description !== undefined && typeof config.description !== 'string') {
    throw new Error('config.description must be a string');
  }
  if (typeof config.description === 'string' && config.description.trim().length > 2000) {
    throw new Error('config.description must be 2000 characters or fewer');
  }

  if (config.metadata !== undefined && !isObject(config.metadata)) {
    throw new Error('config.metadata must be an object');
  }

  return config as ActivityTemplateConfig;
}

function validateFollowUpConfig(followUp: unknown, fieldName = 'followUp'): ActivityFollowUpConfig {
  if (!isObject(followUp)) throw new Error(`${fieldName} must be an object`);
  const enabled = followUp.enabled !== undefined ? Boolean(followUp.enabled) : undefined;
  const kind = `${followUp.kind || ''}` as FollowUpKind;
  if (enabled === false) {
    return {
      enabled: false,
      kind: kind || 'TASK',
    };
  }

  if (!['TASK', 'REMINDER'].includes(kind)) {
    throw new Error(`${fieldName}.kind must be one of: TASK, REMINDER`);
  }

  if (followUp.text !== undefined && typeof followUp.text !== 'string') {
    throw new Error(`${fieldName}.text must be a string`);
  }
  if (followUp.title !== undefined && typeof followUp.title !== 'string') {
    throw new Error(`${fieldName}.title must be a string`);
  }
  if (followUp.description !== undefined && typeof followUp.description !== 'string') {
    throw new Error(`${fieldName}.description must be a string`);
  }
  if (followUp.priority !== undefined && typeof followUp.priority !== 'string') {
    throw new Error(`${fieldName}.priority must be a string`);
  }
  if (followUp.category !== undefined && typeof followUp.category !== 'string') {
    throw new Error(`${fieldName}.category must be a string`);
  }
  if (followUp.tags !== undefined && !Array.isArray(followUp.tags)) {
    throw new Error(`${fieldName}.tags must be an array`);
  }
  if (Array.isArray(followUp.tags) && followUp.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error(`${fieldName}.tags must contain strings only`);
  }

  const dueOffset = followUp.dueOffset !== undefined ? validateOffset(followUp.dueOffset, `${fieldName}.dueOffset`) : undefined;
  const remindOffset = followUp.remindOffset !== undefined ? validateOffset(followUp.remindOffset, `${fieldName}.remindOffset`) : undefined;

  return {
    ...(enabled !== undefined && { enabled }),
    kind,
    ...(followUp.text !== undefined && { text: `${followUp.text}` }),
    ...(followUp.title !== undefined && { title: `${followUp.title}` }),
    ...(followUp.description !== undefined && { description: `${followUp.description}` }),
    ...(followUp.priority !== undefined && { priority: `${followUp.priority}` }),
    ...(followUp.category !== undefined && { category: `${followUp.category}` }),
    ...(Array.isArray(followUp.tags) && { tags: followUp.tags.map((tag) => `${tag}`.trim()).filter(Boolean) }),
    ...(dueOffset && { dueOffset }),
    ...(remindOffset && { remindOffset }),
  };
}

function normalizeActivityTemplate(template: {
  id: string;
  name: string;
  description: string | null;
  config: string;
  autoFollowUp: string | null;
  isSystem: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let config: ActivityTemplateConfig = {};
  if (template.config) {
    try {
      const parsed = JSON.parse(template.config);
      config = parsed && typeof parsed === 'object' ? (parsed as ActivityTemplateConfig) : {};
    } catch {
      config = {};
    }
  }

  let autoFollowUp: ActivityFollowUpConfig | null = null;
  if (template.autoFollowUp) {
    try {
      const parsed = JSON.parse(template.autoFollowUp);
      autoFollowUp = parsed && typeof parsed === 'object' ? (parsed as ActivityFollowUpConfig) : null;
    } catch {
      autoFollowUp = null;
    }
  }

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    config,
    autoFollowUp,
    isSystem: template.isSystem,
    source: template.isSystem ? 'SYSTEM' : 'PERSONAL',
    createdById: template.createdById,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

async function assertClientOwnership(clientId: string, userId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw Object.assign(new Error('Client not found'), { status: 404, code: 'Not Found' });
  }
  if (client.createdById !== userId) {
    throw Object.assign(new Error('You do not have access to this client'), { status: 403, code: 'Forbidden' });
  }
}

// All routes require authentication
router.use(authenticateToken);

// GET /api/activities - List activities (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { client_id, limit = '50' } = req.query;
    const take = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);

    if (client_id) {
      await assertClientOwnership(client_id as string, userId);
    }

    const activities = await prisma.activity.findMany({
      where: client_id
        ? { clientId: client_id as string }
        : { client: { createdById: userId } },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const formattedActivities = activities.map((activity) => ({
      id: activity.id,
      clientId: activity.clientId,
      type: activity.type,
      description: activity.description,
      metadata: parseActivityMetadata(activity.metadata),
      user: activity.user,
      createdAt: activity.createdAt,
    }));

    res.json(formattedActivities);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status) {
      return res.status(status).json({
        error: (error as { code?: string })?.code || 'Error',
        message: (error as Error).message,
      });
    }
    console.error('Error fetching activities:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch activities',
    });
  }
});

// GET /api/activities/templates
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const templates = await prisma.activityTemplate.findMany({
      where: {
        OR: [
          { isSystem: true },
          { createdById: userId },
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    res.json(templates.map(normalizeActivityTemplate));
  } catch (error) {
    console.error('Error fetching activity templates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch activity templates',
    });
  }
});

// POST /api/activities/templates
router.post('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const name = `${req.body?.name || ''}`.trim();
    if (!name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Template name is required',
      });
    }

    const config = validateTemplateConfig(req.body?.config);
    let autoFollowUp: ActivityFollowUpConfig | null = null;
    if (req.body?.autoFollowUp !== undefined && req.body?.autoFollowUp !== null) {
      autoFollowUp = validateFollowUpConfig(req.body.autoFollowUp, 'autoFollowUp');
    }

    const template = await prisma.activityTemplate.create({
      data: {
        name,
        description: req.body?.description ? `${req.body.description}`.trim() : null,
        config: JSON.stringify(config),
        autoFollowUp: autoFollowUp ? JSON.stringify(autoFollowUp) : null,
        isSystem: false,
        createdById: userId,
      },
    });

    res.status(201).json(normalizeActivityTemplate(template));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create activity template';
    const status = message.includes('must') || message.includes('required') ? 400 : 500;
    if (status === 500) console.error('Error creating activity template:', error);
    res.status(status).json({
      error: status === 400 ? 'Validation Error' : 'Internal Server Error',
      message,
    });
  }
});

// PUT /api/activities/templates/:id
router.put('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.activityTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Activity template not found',
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

    const name = req.body?.name !== undefined ? `${req.body.name}`.trim() : undefined;
    if (name !== undefined && !name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Template name cannot be empty',
      });
    }

    const config = req.body?.config !== undefined ? validateTemplateConfig(req.body.config) : undefined;
    const hasAutoFollowUpField = Object.prototype.hasOwnProperty.call(req.body || {}, 'autoFollowUp');
    let autoFollowUp: ActivityFollowUpConfig | null | undefined = undefined;
    if (hasAutoFollowUpField) {
      autoFollowUp = req.body.autoFollowUp === null
        ? null
        : validateFollowUpConfig(req.body.autoFollowUp, 'autoFollowUp');
    }

    const template = await prisma.activityTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(req.body?.description !== undefined && { description: req.body.description ? `${req.body.description}`.trim() : null }),
        ...(config !== undefined && { config: JSON.stringify(config) }),
        ...(autoFollowUp !== undefined && { autoFollowUp: autoFollowUp ? JSON.stringify(autoFollowUp) : null }),
      },
    });

    res.json(normalizeActivityTemplate(template));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update activity template';
    const status = message.includes('must') || message.includes('required') ? 400 : 500;
    if (status === 500) console.error('Error updating activity template:', error);
    res.status(status).json({
      error: status === 400 ? 'Validation Error' : 'Internal Server Error',
      message,
    });
  }
});

// DELETE /api/activities/templates/:id
router.delete('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.activityTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Activity template not found',
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

    await prisma.activityTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Activity template archived successfully' });
  } catch (error) {
    console.error('Error deleting activity template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete activity template',
    });
  }
});

// GET /api/activities/recent - Get recent activities across all clients
router.get('/recent', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = '20' } = req.query;
    const take = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 200);

    const activities = await prisma.activity.findMany({
      where: {
        client: {
          createdById: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const formattedActivities = activities.map((activity) => ({
      id: activity.id,
      clientId: activity.clientId,
      type: activity.type,
      description: activity.description,
      metadata: parseActivityMetadata(activity.metadata),
      user: activity.user,
      createdAt: activity.createdAt,
    }));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch recent activities',
    });
  }
});

// POST /api/activities - Log manual interaction/activity with optional template follow-up
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      clientId,
      type,
      description,
      metadata,
      occurredAt,
      templateId,
      followUp,
    } = req.body as {
      clientId?: string;
      type?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      occurredAt?: string;
      templateId?: string;
      followUp?: ActivityFollowUpConfig;
    };

    if (!clientId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'clientId is required',
      });
    }

    let templateConfig: ActivityTemplateConfig = {};
    let templateFollowUp: ActivityFollowUpConfig | null = null;
    if (templateId) {
      const template = await prisma.activityTemplate.findUnique({ where: { id: templateId } });
      if (!template) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Activity template not found',
        });
      }
      if (!template.isSystem && template.createdById !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this activity template',
        });
      }

      try {
        templateConfig = template.config ? validateTemplateConfig(JSON.parse(template.config)) : {};
      } catch (error) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid template config: ${(error as Error).message}`,
        });
      }

      try {
        templateFollowUp = template.autoFollowUp ? validateFollowUpConfig(JSON.parse(template.autoFollowUp), 'template.autoFollowUp') : null;
      } catch (error) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid template follow-up config: ${(error as Error).message}`,
        });
      }
    }

    const finalType = `${type || templateConfig.type || ''}`.trim();
    const finalDescription = `${description || templateConfig.description || ''}`.trim();
    const mergedMetadata = {
      ...(isObject(templateConfig.metadata) ? templateConfig.metadata : {}),
      ...(isObject(metadata) ? metadata : {}),
    } as Record<string, unknown>;

    if (!finalType || !finalDescription) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'type and description are required (directly or via template)',
      });
    }
    if (!isValidType(finalType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid interaction type. Must be one of: ${VALID_INTERACTION_TYPES.join(', ')}`,
      });
    }
    if (finalDescription.length > 2000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Description must be 2000 characters or fewer',
      });
    }
    if (Object.keys(mergedMetadata).length > 0) {
      const metadataStr = JSON.stringify(mergedMetadata);
      if (metadataStr.length > 5000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Metadata is too large',
        });
      }
    }

    if (occurredAt) {
      const parsedDate = new Date(occurredAt);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'occurredAt must be a valid date',
        });
      }
      if (parsedDate.getTime() > Date.now() + 60000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'occurredAt cannot be in the future',
        });
      }
    }

    await assertClientOwnership(clientId, userId);

    let effectiveFollowUp: ActivityFollowUpConfig | null = null;
    try {
      if (followUp !== undefined) {
        effectiveFollowUp = validateFollowUpConfig(followUp);
      } else if (templateFollowUp) {
        effectiveFollowUp = templateFollowUp;
      }
    } catch (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: (error as Error).message,
      });
    }

    if (effectiveFollowUp?.enabled === false) {
      effectiveFollowUp = null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          clientId,
          userId,
          type: finalType,
          description: finalDescription,
          metadata: Object.keys(mergedMetadata).length > 0 ? JSON.stringify(mergedMetadata) : null,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          ...(occurredAt ? { createdAt: new Date(occurredAt) } : {}),
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      let followUpResult: { kind: FollowUpKind; id: string } | null = null;
      if (effectiveFollowUp) {
        if (effectiveFollowUp.kind === 'TASK') {
          const dueDate = effectiveFollowUp.dueOffset
            ? resolveOffsetDate(effectiveFollowUp.dueOffset)
            : null;
          const task = await tx.task.create({
            data: {
              clientId,
              text: effectiveFollowUp.text?.trim() || `Follow-up: ${finalDescription.slice(0, 120)}`,
              description: effectiveFollowUp.description?.trim() || null,
              priority: effectiveFollowUp.priority || 'MEDIUM',
              status: 'TODO',
              dueDate,
              createdById: userId,
              tags: JSON.stringify(effectiveFollowUp.tags || []),
              type: 'FOLLOW_UP',
            },
          });
          followUpResult = { kind: 'TASK', id: task.id };
        } else if (effectiveFollowUp.kind === 'REMINDER') {
          const remindAt = effectiveFollowUp.remindOffset
            ? resolveOffsetDate(effectiveFollowUp.remindOffset)
            : resolveOffsetDate({ value: 1, unit: 'days' });
          const dueDate = effectiveFollowUp.dueOffset
            ? resolveOffsetDate(effectiveFollowUp.dueOffset)
            : null;
          const reminder = await tx.reminder.create({
            data: {
              userId,
              clientId,
              title: effectiveFollowUp.title?.trim() || `Follow-up: ${finalDescription.slice(0, 120)}`,
              description: effectiveFollowUp.description?.trim() || null,
              category: effectiveFollowUp.category || 'FOLLOW_UP',
              priority: effectiveFollowUp.priority || 'MEDIUM',
              remindAt,
              dueDate,
              tags: JSON.stringify(effectiveFollowUp.tags || []),
            },
          });
          followUpResult = { kind: 'REMINDER', id: reminder.id };
        }
      }

      return { activity, followUp: followUpResult };
    }, {
      timeout: 20000,
      maxWait: 5000,
    });

    res.status(201).json({
      id: result.activity.id,
      clientId: result.activity.clientId,
      type: result.activity.type,
      description: result.activity.description,
      metadata: parseActivityMetadata(result.activity.metadata),
      user: result.activity.user,
      createdAt: result.activity.createdAt,
      followUp: result.followUp,
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status) {
      return res.status(status).json({
        error: (error as { code?: string })?.code || 'Error',
        message: (error as Error).message,
      });
    }
    console.error('Error creating activity:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create activity',
    });
  }
});

export default router;
