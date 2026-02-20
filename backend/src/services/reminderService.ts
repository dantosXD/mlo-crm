import prisma from '../utils/prisma.js';
import { ServiceError } from './taskService.js';
import reminderSuggestionService from './reminderSuggestionService.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function assertFound<T>(value: T | null | undefined, entity = 'Resource'): asserts value is T {
  if (value === null || value === undefined) {
    throw new ServiceError(404, 'Not Found', `${entity} not found`);
  }
}

function assertOwnership(reminder: { userId: string }, userId: string) {
  if (reminder.userId !== userId)
    throw new ServiceError(403, 'Access Denied', 'Access denied');
}

const REMINDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, nameHash: true } },
} as const;

type ReminderOffsetUnit = 'minutes' | 'hours' | 'days';
interface ReminderTemplateOffset {
  value: number;
  unit: ReminderOffsetUnit;
  atTime?: string;
}

interface ReminderTemplateConfig {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  tags?: string[];
  isRecurring?: boolean;
  recurringPattern?: string;
  recurringInterval?: number;
  recurringEndDays?: number | null;
  remindOffset?: ReminderTemplateOffset;
  dueOffset?: ReminderTemplateOffset;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateOffset(offset: unknown, fieldName: string) {
  if (!isObject(offset)) throw new ServiceError(400, 'Validation Error', `${fieldName} must be an object`);
  const value = Number(offset.value);
  if (!Number.isFinite(value) || value < 0) {
    throw new ServiceError(400, 'Validation Error', `${fieldName}.value must be a non-negative number`);
  }
  if (!['minutes', 'hours', 'days'].includes(`${offset.unit}`)) {
    throw new ServiceError(400, 'Validation Error', `${fieldName}.unit must be one of: minutes, hours, days`);
  }
  if (offset.atTime !== undefined && !/^\d{2}:\d{2}$/.test(`${offset.atTime}`)) {
    throw new ServiceError(400, 'Validation Error', `${fieldName}.atTime must use HH:MM format`);
  }
}

function validateReminderTemplateConfig(config: unknown): ReminderTemplateConfig {
  if (!isObject(config)) throw new ServiceError(400, 'Validation Error', 'config must be an object');

  if (config.title !== undefined && typeof config.title !== 'string') {
    throw new ServiceError(400, 'Validation Error', 'config.title must be a string');
  }
  if (config.description !== undefined && typeof config.description !== 'string') {
    throw new ServiceError(400, 'Validation Error', 'config.description must be a string');
  }
  if (config.category !== undefined && typeof config.category !== 'string') {
    throw new ServiceError(400, 'Validation Error', 'config.category must be a string');
  }
  if (config.priority !== undefined && typeof config.priority !== 'string') {
    throw new ServiceError(400, 'Validation Error', 'config.priority must be a string');
  }
  if (config.tags !== undefined && !Array.isArray(config.tags)) {
    throw new ServiceError(400, 'Validation Error', 'config.tags must be an array');
  }
  if (Array.isArray(config.tags) && config.tags.some((tag) => typeof tag !== 'string')) {
    throw new ServiceError(400, 'Validation Error', 'config.tags must contain strings only');
  }
  if (config.isRecurring !== undefined && typeof config.isRecurring !== 'boolean') {
    throw new ServiceError(400, 'Validation Error', 'config.isRecurring must be a boolean');
  }
  if (config.recurringPattern !== undefined && typeof config.recurringPattern !== 'string') {
    throw new ServiceError(400, 'Validation Error', 'config.recurringPattern must be a string');
  }
  if (config.recurringInterval !== undefined) {
    const recurringInterval = Number(config.recurringInterval);
    if (!Number.isInteger(recurringInterval) || recurringInterval <= 0) {
      throw new ServiceError(400, 'Validation Error', 'config.recurringInterval must be a positive integer');
    }
  }
  if (config.recurringEndDays !== undefined && config.recurringEndDays !== null) {
    const recurringEndDays = Number(config.recurringEndDays);
    if (!Number.isInteger(recurringEndDays) || recurringEndDays < 0) {
      throw new ServiceError(400, 'Validation Error', 'config.recurringEndDays must be a non-negative integer');
    }
  }
  if (config.remindOffset !== undefined) validateOffset(config.remindOffset, 'config.remindOffset');
  if (config.dueOffset !== undefined) validateOffset(config.dueOffset, 'config.dueOffset');

  return config as ReminderTemplateConfig;
}

function normalizeReminderTemplate(template: {
  id: string;
  name: string;
  description: string | null;
  config: string;
  isSystem: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let config: ReminderTemplateConfig = {};
  try {
    const parsed = JSON.parse(template.config);
    config = parsed && typeof parsed === 'object' ? (parsed as ReminderTemplateConfig) : {};
  } catch {
    config = {};
  }

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    config,
    isSystem: template.isSystem,
    source: template.isSystem ? 'SYSTEM' : 'PERSONAL',
    createdById: template.createdById,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

// ─── reminder templates ─────────────────────────────────────────────────────

export async function listReminderTemplates(userId: string) {
  const templates = await prisma.reminderTemplate.findMany({
    where: {
      OR: [
        { isSystem: true },
        { createdById: userId },
      ],
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return templates.map(normalizeReminderTemplate);
}

export async function createReminderTemplate(
  data: { name?: string; description?: string; config?: unknown },
  userId: string,
) {
  const name = data.name?.trim();
  if (!name) throw new ServiceError(400, 'Validation Error', 'Template name is required');

  const config = validateReminderTemplateConfig(data.config);
  const created = await prisma.reminderTemplate.create({
    data: {
      name,
      description: data.description?.trim() || null,
      config: JSON.stringify(config),
      isSystem: false,
      createdById: userId,
    },
  });

  return normalizeReminderTemplate(created);
}

export async function updateReminderTemplate(
  templateId: string,
  data: { name?: string; description?: string | null; config?: unknown },
  userId: string,
) {
  const existing = await prisma.reminderTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new ServiceError(404, 'Not Found', 'Reminder template not found');
  if (existing.isSystem) throw new ServiceError(403, 'Access Denied', 'System templates are read-only');
  if (existing.createdById !== userId) throw new ServiceError(403, 'Access Denied', 'You can only update your own templates');
  if (data.name !== undefined && !data.name.trim()) {
    throw new ServiceError(400, 'Validation Error', 'Template name cannot be empty');
  }

  const updated = await prisma.reminderTemplate.update({
    where: { id: templateId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.config !== undefined && { config: JSON.stringify(validateReminderTemplateConfig(data.config)) }),
    },
  });

  return normalizeReminderTemplate(updated);
}

export async function deleteReminderTemplate(templateId: string, userId: string) {
  const existing = await prisma.reminderTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new ServiceError(404, 'Not Found', 'Reminder template not found');
  if (existing.isSystem) throw new ServiceError(403, 'Access Denied', 'System templates are read-only');
  if (existing.createdById !== userId) throw new ServiceError(403, 'Access Denied', 'You can only delete your own templates');

  await prisma.reminderTemplate.delete({ where: { id: templateId } });
  return { message: 'Reminder template archived successfully' };
}

function calculateNextReminderDate(fromDate: Date, pattern: string, interval: number | null): Date {
  const next = new Date(fromDate);
  switch (pattern) {
    case 'DAILY':   next.setDate(next.getDate() + (interval || 1)); break;
    case 'WEEKLY':  next.setDate(next.getDate() + 7 * (interval || 1)); break;
    case 'MONTHLY': next.setMonth(next.getMonth() + (interval || 1)); break;
    case 'CUSTOM':  next.setDate(next.getDate() + (interval || 1)); break;
    default:        next.setDate(next.getDate() + 1);
  }
  return next;
}

// ─── core CRUD ──────────────────────────────────────────────────────────────

export interface ListRemindersParams {
  userId: string;
  status?: string;
  category?: string;
  priority?: string;
  clientId?: string;
  upcoming?: string;
  overdue?: string;
  limit?: number;
  offset?: number;
}

export async function listReminders(params: ListRemindersParams) {
  const { userId, status, category, priority, clientId, upcoming, overdue, limit = 50, offset = 0 } = params;

  const where: any = { userId };
  if (status) where.status = status;
  if (category) where.category = category;
  if (priority) where.priority = priority;
  if (clientId) where.clientId = clientId;
  if (upcoming === 'true') { where.remindAt = { gte: new Date() }; where.status = { in: ['PENDING', 'SNOOZED'] }; }
  if (overdue === 'true') { where.remindAt = { lt: new Date() }; where.status = { in: ['PENDING', 'SNOOZED'] }; }

  const reminders = await prisma.reminder.findMany({
    where,
    include: REMINDER_INCLUDE,
    orderBy: { remindAt: 'asc' },
    take: limit,
    skip: offset,
  });

  return reminders.map((r) => ({
    ...r,
    client: r.client ? { ...r.client, name: r.client.nameHash } : null,
  }));
}

export async function getReminder(id: string, userId: string) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId }, include: REMINDER_INCLUDE });
  assertFound(reminder, 'Reminder');
  return reminder;
}

export interface CreateReminderData {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  remindAt: string;
  dueDate?: string;
  clientId?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  recurringInterval?: number;
  recurringEndDate?: string;
  tags?: string[];
  metadata?: any;
}

export async function createReminder(data: CreateReminderData, userId: string) {
  if (!data.title) throw new ServiceError(400, 'Validation Error', 'Title is required');
  if (!data.remindAt) throw new ServiceError(400, 'Validation Error', 'Remind at date is required');

  const reminder = await prisma.reminder.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      category: data.category || 'GENERAL',
      priority: data.priority || 'MEDIUM',
      remindAt: new Date(data.remindAt),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      clientId: data.clientId || null,
      isRecurring: data.isRecurring || false,
      recurringPattern: data.isRecurring ? data.recurringPattern : null,
      recurringInterval: data.isRecurring ? data.recurringInterval : null,
      recurringEndDate: data.isRecurring ? data.recurringEndDate : null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    },
    include: REMINDER_INCLUDE,
  });

  await prisma.notification.create({
    data: {
      userId,
      type: 'REMINDER_CREATED',
      title: 'Reminder Created',
      message: `Reminder "${data.title}" scheduled for ${new Date(data.remindAt).toLocaleDateString()}`,
      metadata: JSON.stringify({ reminderId: reminder.id }),
    },
  });

  return reminder;
}

export interface UpdateReminderData {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  remindAt?: string;
  dueDate?: string | null;
  clientId?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  recurringInterval?: number;
  recurringEndDate?: string;
  tags?: string[] | null;
  metadata?: any;
}

export async function updateReminder(id: string, data: UpdateReminderData, userId: string) {
  const existing = await prisma.reminder.findFirst({ where: { id, userId } });
  assertFound(existing, 'Reminder');

  const reminder = await prisma.reminder.update({
    where: { id },
    data: {
      title: data.title !== undefined ? data.title : existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      category: data.category !== undefined ? data.category : existing.category,
      priority: data.priority !== undefined ? data.priority : existing.priority,
      remindAt: data.remindAt !== undefined ? new Date(data.remindAt) : existing.remindAt,
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : existing.dueDate,
      clientId: data.clientId !== undefined ? data.clientId : existing.clientId,
      isRecurring: data.isRecurring !== undefined ? data.isRecurring : existing.isRecurring,
      recurringPattern: data.recurringPattern !== undefined ? data.recurringPattern : existing.recurringPattern,
      recurringInterval: data.recurringInterval !== undefined ? data.recurringInterval : existing.recurringInterval,
      recurringEndDate: data.recurringEndDate !== undefined ? data.recurringEndDate : existing.recurringEndDate,
      tags: data.tags !== undefined ? (data.tags ? JSON.stringify(data.tags) : null) : existing.tags,
      metadata: data.metadata !== undefined ? (data.metadata ? JSON.stringify(data.metadata) : null) : existing.metadata,
    },
    include: REMINDER_INCLUDE,
  });

  return reminder;
}

export async function deleteReminder(id: string, userId: string) {
  const existing = await prisma.reminder.findFirst({ where: { id, userId } });
  assertFound(existing, 'Reminder');
  await prisma.reminder.delete({ where: { id } });
  return { message: 'Reminder archived successfully' };
}

// ─── status actions ─────────────────────────────────────────────────────────

export async function completeReminder(id: string, userId: string) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId } });
  assertFound(reminder, 'Reminder');

  const updated = await prisma.reminder.update({
    where: { id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  // If recurring, create the next occurrence
  if (reminder.isRecurring && reminder.recurringPattern) {
    const nextRemindAt = calculateNextReminderDate(reminder.remindAt, reminder.recurringPattern, reminder.recurringInterval);
    if (!reminder.recurringEndDate || nextRemindAt <= reminder.recurringEndDate) {
      await prisma.reminder.create({
        data: {
          userId: reminder.userId,
          clientId: reminder.clientId,
          title: reminder.title,
          description: reminder.description,
          category: reminder.category,
          priority: reminder.priority,
          remindAt: nextRemindAt,
          dueDate: reminder.dueDate && new Date(new Date(reminder.dueDate).getTime() + (nextRemindAt.getTime() - reminder.remindAt.getTime())),
          isRecurring: true,
          recurringPattern: reminder.recurringPattern,
          recurringInterval: reminder.recurringInterval,
          recurringEndDate: reminder.recurringEndDate,
          recurringReminderId: reminder.id,
          tags: reminder.tags,
          metadata: reminder.metadata,
        },
      });
    }
  }

  return updated;
}

export async function dismissReminder(id: string, userId: string) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId } });
  assertFound(reminder, 'Reminder');
  return prisma.reminder.update({ where: { id }, data: { status: 'DISMISSED', dismissedAt: new Date() } });
}

export async function snoozeReminder(id: string, userId: string, minutes = 15, hours = 0, days = 0) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId } });
  assertFound(reminder, 'Reminder');

  const snoozeUntil = new Date();
  snoozeUntil.setMinutes(snoozeUntil.getMinutes() + minutes);
  snoozeUntil.setHours(snoozeUntil.getHours() + hours);
  snoozeUntil.setDate(snoozeUntil.getDate() + days);

  return prisma.reminder.update({
    where: { id },
    data: { status: 'SNOOZED', snoozedUntil: snoozeUntil, snoozeCount: reminder.snoozeCount + 1, remindAt: snoozeUntil },
  });
}

// ─── bulk operations ────────────────────────────────────────────────────────

export async function bulkOperation(userId: string, action: string, reminderIds: string[]) {
  if (!action || !reminderIds || !Array.isArray(reminderIds))
    throw new ServiceError(400, 'Validation Error', 'Action and reminderIds are required');

  const reminders = await prisma.reminder.findMany({ where: { id: { in: reminderIds }, userId } });
  if (reminders.length !== reminderIds.length)
    throw new ServiceError(403, 'Access Denied', 'Some reminders not found or access denied');

  let result;
  switch (action) {
    case 'complete':
      result = await prisma.reminder.updateMany({ where: { id: { in: reminderIds } }, data: { status: 'COMPLETED', completedAt: new Date() } });
      break;
    case 'dismiss':
      result = await prisma.reminder.updateMany({ where: { id: { in: reminderIds } }, data: { status: 'DISMISSED', dismissedAt: new Date() } });
      break;
    case 'delete':
      result = await prisma.reminder.deleteMany({ where: { id: { in: reminderIds } } });
      break;
    default:
      throw new ServiceError(400, 'Validation Error', 'Invalid action');
  }

  return { message: `Bulk ${action} completed`, count: result.count };
}

// ─── statistics ─────────────────────────────────────────────────────────────

export async function getReminderStats(userId: string) {
  const [total, pending, overdue, completed, snoozed, byCategory, byPriority] = await Promise.all([
    prisma.reminder.count({ where: { userId } }),
    prisma.reminder.count({ where: { userId, status: 'PENDING' } }),
    prisma.reminder.count({ where: { userId, status: { in: ['PENDING', 'SNOOZED'] }, remindAt: { lt: new Date() } } }),
    prisma.reminder.count({ where: { userId, status: 'COMPLETED' } }),
    prisma.reminder.count({ where: { userId, status: 'SNOOZED' } }),
    prisma.reminder.groupBy({ by: ['category'], where: { userId, status: { in: ['PENDING', 'SNOOZED'] } }, _count: true }),
    prisma.reminder.groupBy({ by: ['priority'], where: { userId, status: { in: ['PENDING', 'SNOOZED'] } }, _count: true }),
  ]);

  return {
    total, pending, overdue, completed, snoozed,
    byCategory: byCategory.reduce((acc, item) => { acc[item.category] = item._count; return acc; }, {} as Record<string, number>),
    byPriority: byPriority.reduce((acc, item) => { acc[item.priority] = item._count; return acc; }, {} as Record<string, number>),
  };
}

// ─── cross-entity creation ──────────────────────────────────────────────────

export async function createTaskFromReminder(id: string, userId: string, dueDate?: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id }, include: { client: true } });
  assertFound(reminder, 'Reminder');
  assertOwnership(reminder, userId);

  return prisma.task.create({
    data: {
      text: reminder.title.replace(/^(Reminder:|Event:)\s*/, ''),
      description: reminder.description,
      type: reminder.clientId ? 'CLIENT_SPECIFIC' : 'GENERAL',
      priority: reminder.priority === 'URGENT' ? 'HIGH' : reminder.priority,
      clientId: reminder.clientId,
      dueDate: dueDate ? new Date(dueDate) : reminder.dueDate || reminder.remindAt,
      createdById: userId,
      status: 'TODO',
    },
    include: { client: { select: { id: true, nameEncrypted: true } }, assignedTo: { select: { id: true, name: true } } },
  });
}

export async function createEventFromReminder(id: string, userId: string, startTime?: string, duration = 60, allDay = false) {
  const reminder = await prisma.reminder.findUnique({ where: { id }, include: { client: true } });
  assertFound(reminder, 'Reminder');
  assertOwnership(reminder, userId);

  let endTime: Date | undefined;
  if (!allDay && startTime) {
    const start = new Date(startTime);
    endTime = new Date(start.getTime() + duration * 60000);
  }

  return prisma.event.create({
    data: {
      title: reminder.title.replace(/^(Reminder:|Event:)\s*/, ''),
      description: reminder.description,
      eventType: reminder.category === 'CLOSING' ? 'CLOSING' : reminder.category === 'CLIENT' ? 'APPOINTMENT' : 'CUSTOM',
      startTime: startTime ? new Date(startTime) : reminder.remindAt,
      endTime,
      allDay,
      clientId: reminder.clientId,
      createdById: userId,
      status: 'CONFIRMED',
    },
    include: { client: { select: { id: true, nameEncrypted: true } } },
  });
}

// ─── suggestions ────────────────────────────────────────────────────────────

export async function getSuggestions(userId: string, config: any) {
  return reminderSuggestionService.generateSuggestions(userId, config);
}

export async function acceptSuggestion(userId: string, suggestion: any) {
  if (!suggestion) throw new ServiceError(400, 'Validation Error', 'Suggestion data is required');

  const reminder = await reminderSuggestionService.acceptSuggestion(userId, suggestion);

  await prisma.notification.create({
    data: {
      userId,
      type: 'REMINDER_CREATED',
      title: 'Reminder Created from Suggestion',
      message: `Reminder "${suggestion.title}" created successfully`,
      link: `/reminders`,
      metadata: JSON.stringify({ reminderId: reminder.id }),
    },
  });

  return reminder;
}

export async function dismissSuggestion(userId: string, suggestionType: string, metadata: any) {
  if (!suggestionType) throw new ServiceError(400, 'Validation Error', 'Suggestion type is required');
  await reminderSuggestionService.trackSuggestionDismissal(userId, suggestionType, metadata || {});
  return { message: 'Suggestion dismissal recorded' };
}

export async function getSuggestionAnalytics(userId: string) {
  return reminderSuggestionService.getSuggestionAnalytics(userId);
}

export async function updateSuggestionConfig(userId: string, config: {
  enabled?: boolean;
  minConfidence?: number;
  frequency?: string;
  inactiveDaysThreshold?: number;
  dueDateWarningDays?: number;
}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const prefs = user?.preferences ? JSON.parse(user.preferences) : {};

  prefs.reminderSuggestions = {
    ...prefs.reminderSuggestions,
    ...(config.enabled !== undefined && { enabled: config.enabled }),
    ...(config.minConfidence !== undefined && { minConfidence: config.minConfidence }),
    ...(config.frequency !== undefined && { frequency: config.frequency }),
    ...(config.inactiveDaysThreshold !== undefined && { inactiveDaysThreshold: config.inactiveDaysThreshold }),
    ...(config.dueDateWarningDays !== undefined && { dueDateWarningDays: config.dueDateWarningDays }),
  };

  await prisma.user.update({ where: { id: userId }, data: { preferences: JSON.stringify(prefs) } });
  return { message: 'Suggestion settings updated', config: prefs.reminderSuggestions };
}
