import prisma from '../utils/prisma.js';
import { decodeClientPiiField } from '../utils/clientPiiCodec.js';
import {
  fireTaskCreatedTrigger,
  fireTaskCompletedTrigger,
  fireTaskAssignedTrigger,
} from './triggerHandler.js';

// ─── helpers ────────────────────────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const canAccessClientTasks = async (userId: string, clientId: string | null) => {
  if (!clientId) return false;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, createdById: true },
  });
  return !!client && client.createdById === userId;
};

/** Assert a value is non-null, throwing ServiceError if it is. */
function assertFound<T>(value: T | null | undefined, entity = 'Resource'): asserts value is T {
  if (value === null || value === undefined) {
    throw new ServiceError(404, 'Not Found', `${entity} not found`);
  }
}

/** Verify a task exists and the caller owns it via client ownership. Returns the task. */
async function verifyTaskOwnership(taskId: string, userId: string | undefined) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      client: { select: { id: true, createdById: true } },
    },
  });
  assertFound(task, 'Task');
  if (!userId || (task.client !== null && task.client?.createdById !== userId))
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to access this task');
  return task;
}

/** Build a Prisma where-clause scoped to the user's clients. */
async function userClientScope(userId: string) {
  const userClients = await prisma.client.findMany({
    where: { createdById: userId },
    select: { id: true },
  });
  const clientIds = userClients.map((c) => c.id);
  if (clientIds.length > 0) {
    return { OR: [{ clientId: { in: clientIds } }, { clientId: null }] };
  }
  return { clientId: null as string | null };
}

// ─── core CRUD ──────────────────────────────────────────────────────────────

export interface ListTasksParams {
  userId: string;
  clientId?: string;
  status?: string;
  dueDate?: string;
  priority?: string;
  assignedTo?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

export async function listTasks(params: ListTasksParams) {
  const {
    userId,
    clientId,
    status,
    dueDate,
    priority,
    assignedTo,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
  } = params;

  const skip = (page - 1) * limit;
  const take = limit;

  // Build date / status filters based on the dueDate shortcut
  let dateFilter: any = {};
  let statusFilter: any = {};

  if (dueDate === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateFilter = { gte: today, lt: tomorrow };
    if (!status) statusFilter = { not: 'COMPLETE' };
  } else if (dueDate === 'upcoming') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 30);
    dateFilter = { gte: today, lte: future };
    if (!status) statusFilter = { not: 'COMPLETE' };
  } else if (dueDate === 'overdue') {
    dateFilter = { lt: new Date() };
    if (!status) statusFilter = { not: 'COMPLETE' };
  } else if (dueDate === 'completed') {
    statusFilter = 'COMPLETE';
  }

  const finalStatusFilter = status || statusFilter;

  // orderBy
  const orderBy: any = {};
  if (sortBy === 'dueDate') orderBy.dueDate = sortOrder === 'asc' ? 'asc' : 'desc';
  else if (sortBy === 'priority') orderBy.priority = sortOrder;
  else if (sortBy === 'text') orderBy.text = sortOrder;
  else orderBy.createdAt = sortOrder === 'asc' ? 'asc' : 'desc';

  const where: any = {
    ...(clientId && { clientId }),
    ...(finalStatusFilter && { status: finalStatusFilter }),
    ...(Object.keys(dateFilter).length > 0 && { dueDate: dateFilter }),
    ...(priority && { priority }),
    ...(assignedTo && assignedTo !== 'unassigned' && { assignedToId: assignedTo }),
    ...(assignedTo === 'unassigned' && { assignedToId: null }),
  };

  // Scope to user's clients when not filtering by a specific client
  if (!clientId) {
    const scope = await userClientScope(userId);
    Object.assign(where, scope);
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        assignedTo: { select: { id: true, name: true } },
        subtasks: { orderBy: { order: 'asc' } },
        client: { select: { id: true, nameEncrypted: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  const tasksWithClientName = tasks.map((task) => ({
    ...task,
    client: task.client
      ? { id: task.client.id, name: decodeClientPiiField(task.client.nameEncrypted) }
      : null,
  }));

  return {
    tasks: tasksWithClientName,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getTaskStatistics(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const taskWhere = await userClientScope(userId);

  const [totalTasks, dueTodayTasks, overdueTasks, completedTasks, upcomingTasks] =
    await Promise.all([
      prisma.task.count({ where: { ...taskWhere, status: { not: 'COMPLETE' } } }),
      prisma.task.count({
        where: { ...taskWhere, status: { not: 'COMPLETE' }, dueDate: { gte: today, lt: tomorrow } },
      }),
      prisma.task.count({
        where: { ...taskWhere, status: { not: 'COMPLETE' }, dueDate: { lt: new Date() } },
      }),
      prisma.task.count({ where: { ...taskWhere, status: 'COMPLETE' } }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: 'COMPLETE' },
          dueDate: { gte: tomorrow, lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  return { total: totalTasks, dueToday: dueTodayTasks, overdue: overdueTasks, completed: completedTasks, upcoming: upcomingTasks };
}

export async function getTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      subtasks: { orderBy: { order: 'asc' } },
      client: { select: { id: true, createdById: true } },
    },
  });
  assertFound(task, 'Task');
  if (task.client?.createdById !== userId)
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to access this task');
  return task;
}

export interface CreateTaskData {
  clientId?: string;
  text: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assignedToId?: string;
  type?: string;
  tags?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  recurringInterval?: number;
  recurringEndDate?: string;
}

export async function createTask(data: CreateTaskData, userId: string) {
  const trimmedText = data.text?.trim();
  if (!trimmedText) throw new ServiceError(400, 'Validation Error', 'Task text is required');
  data = { ...data, text: trimmedText };

  if (data.clientId) {
    const hasAccess = await canAccessClientTasks(userId, data.clientId);
    if (!hasAccess) throw new ServiceError(403, 'Access Denied', 'You do not have permission to create tasks for this client');
  }

  const task = await prisma.task.create({
    data: {
      clientId: data.clientId,
      text: data.text,
      description: data.description,
      status: data.status || 'TODO',
      priority: data.priority || 'MEDIUM',
      type: data.type || 'GENERAL',
      tags: data.tags || '[]',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assignedToId: data.assignedToId,
      createdById: userId,
      isRecurring: data.isRecurring || false,
      recurringPattern: data.recurringPattern,
      recurringInterval: data.recurringInterval,
      recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : null,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      subtasks: { orderBy: { order: 'asc' } },
    },
  });

  if (data.clientId) {
    await prisma.activity.create({
      data: { clientId: data.clientId, userId, type: 'TASK_CREATED', description: `Task "${data.text}" created` },
    });
    await fireTaskCreatedTrigger(task.id, data.clientId, userId);
  }

  return task;
}

export interface UpdateTaskData {
  text?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignedToId?: string;
  type?: string;
  tags?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  recurringInterval?: number;
  recurringEndDate?: string | null;
}

export async function updateTask(taskId: string, data: UpdateTaskData, userId: string) {
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      client: { select: { id: true, createdById: true } },
      createdBy: { select: { id: true } },
    },
  });
  assertFound(existingTask, 'Task');
  if (existingTask.client !== null && existingTask.client?.createdById !== userId)
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to update this task');

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.text !== undefined && { text: data.text }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
      ...(data.recurringPattern !== undefined && { recurringPattern: data.recurringPattern }),
      ...(data.recurringInterval !== undefined && { recurringInterval: data.recurringInterval }),
      ...(data.recurringEndDate !== undefined && { recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : null }),
      ...(data.status === 'COMPLETE' && !existingTask.completedAt && { completedAt: new Date() }),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      subtasks: true,
    },
  });

  // Activity + trigger for completion
  if (data.status === 'COMPLETE' && existingTask.status !== 'COMPLETE' && existingTask.clientId) {
    await prisma.activity.create({
      data: { clientId: existingTask.clientId, userId, type: 'TASK_COMPLETED', description: `Task "${existingTask.text}" completed` },
    });
    await fireTaskCompletedTrigger(task.id, existingTask.clientId, userId);
  }

  // Trigger for assignment change
  if (data.assignedToId !== undefined && data.assignedToId !== existingTask.assignedToId && existingTask.clientId) {
    await fireTaskAssignedTrigger(task.id, existingTask.clientId, data.assignedToId, userId);
  }

  return task;
}

export async function updateTaskStatus(taskId: string, status: string, userId: string) {
  if (!status) throw new ServiceError(400, 'Validation Error', 'Status is required');

  const existingTask = await verifyTaskOwnership(taskId, userId);

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      ...(status === 'COMPLETE' && !existingTask.completedAt && { completedAt: new Date() }),
    },
  });

  if (status === 'COMPLETE' && existingTask.status !== 'COMPLETE' && existingTask.clientId) {
    await prisma.activity.create({
      data: { clientId: existingTask.clientId, userId, type: 'TASK_COMPLETED', description: `Task "${existingTask.text}" completed` },
    });
    await fireTaskCompletedTrigger(task.id, existingTask.clientId, userId);
  }

  return task;
}

export async function deleteTask(taskId: string, userId: string) {
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: { client: { select: { id: true, createdById: true } } },
  });
  assertFound(existingTask, 'Task');

  const isClientOwner = !!existingTask.clientId && existingTask.client?.createdById === userId;
  const isTaskOwner = existingTask.createdById === userId;
  if (!isClientOwner && !isTaskOwner)
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to delete this task');

  await prisma.task.delete({ where: { id: taskId } });

  if (existingTask.clientId) {
    await prisma.activity.create({
      data: { clientId: existingTask.clientId, userId, type: 'TASK_ARCHIVED', description: `Task "${existingTask.text}" archived` },
    });
  }

  return { message: 'Task archived successfully' };
}

// ─── bulk operations ────────────────────────────────────────────────────────

export interface BulkUpdateParams {
  taskIds: string[];
  action: string;
  data?: any;
  userId: string;
}

export async function bulkUpdateTasks(params: BulkUpdateParams) {
  const { taskIds, action, data, userId } = params;

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0)
    throw new ServiceError(400, 'Validation Error', 'taskIds must be a non-empty array');
  if (!action) throw new ServiceError(400, 'Validation Error', 'action is required');

  const userClients = await prisma.client.findMany({
    where: { createdById: userId },
    select: { id: true },
  });
  const clientIds = userClients.map((c) => c.id);

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, clientId: { in: clientIds } },
    include: { client: { select: { id: true, createdById: true } } },
  });

  if (tasks.length !== taskIds.length)
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to modify some of these tasks');

  let updateData: any = {};
  let activityType = '';
  let activityDescription = '';

  switch (action) {
    case 'mark_complete':
      updateData = { status: 'COMPLETE', completedAt: new Date() };
      activityType = 'TASKS_BULK_COMPLETED';
      activityDescription = `${taskIds.length} task(s) marked as complete`;
      break;
    case 'mark_incomplete':
      updateData = { status: 'TODO', completedAt: null };
      activityType = 'TASKS_BULK_MARKED_INCOMPLETE';
      activityDescription = `${taskIds.length} task(s) marked as incomplete`;
      break;
    case 'reassign':
      if (!data?.assignedToId) throw new ServiceError(400, 'Validation Error', 'assignedToId is required for reassign action');
      updateData = { assignedToId: data.assignedToId };
      activityType = 'TASKS_BULK_REASSIGNED';
      activityDescription = `${taskIds.length} task(s) reassigned`;
      break;
    case 'set_priority':
      if (!data?.priority) throw new ServiceError(400, 'Validation Error', 'priority is required for set_priority action');
      updateData = { priority: data.priority };
      activityType = 'TASKS_BULK_PRIORITY_UPDATED';
      activityDescription = `${taskIds.length} task(s) priority updated`;
      break;
    case 'snooze': {
      if (!data?.days) throw new ServiceError(400, 'Validation Error', 'days is required for snooze action');
      const newDueDate = new Date();
      newDueDate.setDate(newDueDate.getDate() + data.days);
      updateData = { dueDate: newDueDate };
      activityType = 'TASKS_BULK_SNOOZED';
      activityDescription = `${taskIds.length} task(s) snoozed by ${data.days} day(s)`;
      break;
    }
    default:
      throw new ServiceError(400, 'Validation Error', `Invalid action: ${action}`);
  }

  const updatedTasks = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: updateData,
  });

  if (tasks[0]?.clientId && activityType) {
    await prisma.activity.create({
      data: { clientId: tasks[0].clientId, userId, type: activityType, description: activityDescription },
    });
  }

  return { message: `Successfully updated ${updatedTasks.count} tasks`, count: updatedTasks.count };
}

// ─── subtasks ───────────────────────────────────────────────────────────────

export async function createSubtask(taskId: string, text: string, userId: string) {
  if (!text) throw new ServiceError(400, 'Validation Error', 'Subtask text is required');
  await verifyTaskOwnership(taskId, userId);

  const maxOrder = await prisma.taskSubtask.findFirst({
    where: { taskId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  return prisma.taskSubtask.create({
    data: { taskId, text, order: (maxOrder?.order ?? -1) + 1 },
  });
}

export async function updateSubtask(
  taskId: string,
  subtaskId: string,
  data: { text?: string; isCompleted?: boolean; dueDate?: string | null; order?: number },
  userId: string,
) {
  await verifyTaskOwnership(taskId, userId);
  return prisma.taskSubtask.update({
    where: { id: subtaskId },
    data: {
      ...(data.text !== undefined && { text: data.text }),
      ...(data.isCompleted !== undefined && { isCompleted: data.isCompleted }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.order !== undefined && { order: data.order }),
    },
  });
}

export async function deleteSubtask(taskId: string, subtaskId: string, userId: string) {
  await verifyTaskOwnership(taskId, userId);
  await prisma.taskSubtask.delete({ where: { id: subtaskId } });
  return { message: 'Subtask archived successfully' };
}

export async function toggleSubtask(taskId: string, subtaskId: string, userId: string) {
  await verifyTaskOwnership(taskId, userId);
  const existing = await prisma.taskSubtask.findUnique({ where: { id: subtaskId } });
  assertFound(existing, 'Subtask');
  return prisma.taskSubtask.update({
    where: { id: subtaskId },
    data: { isCompleted: !existing.isCompleted },
  });
}

export async function reorderSubtasks(taskId: string, subtaskIds: string[], userId: string) {
  if (!Array.isArray(subtaskIds)) throw new ServiceError(400, 'Validation Error', 'subtaskIds must be an array');
  await verifyTaskOwnership(taskId, userId);
  await Promise.all(
    subtaskIds.map((sid, idx) => prisma.taskSubtask.update({ where: { id: sid }, data: { order: idx } })),
  );
  return { message: 'Subtasks reordered successfully' };
}

// ─── reminders / snooze ─────────────────────────────────────────────────────

export async function updateTaskReminders(
  taskId: string,
  data: { reminderEnabled?: boolean; reminderTimes?: string[]; reminderMessage?: string },
  userId: string,
) {
  const task = await verifyTaskOwnership(taskId, userId);

  if (data.reminderTimes !== undefined) {
    const validTypes = ['AT_TIME', '15MIN', '1HR', '1DAY', '1WEEK'];
    if (!Array.isArray(data.reminderTimes)) throw new ServiceError(400, 'Validation Error', 'reminderTimes must be an array');
    for (const rt of data.reminderTimes) {
      if (!validTypes.includes(rt))
        throw new ServiceError(400, 'Validation Error', `Invalid reminder type: ${rt}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      reminderEnabled: data.reminderEnabled !== undefined ? data.reminderEnabled : task.reminderEnabled,
      reminderTimes: data.reminderTimes !== undefined ? JSON.stringify(data.reminderTimes) : task.reminderTimes,
      reminderMessage: data.reminderMessage !== undefined ? data.reminderMessage : task.reminderMessage,
    },
  });

  return {
    message: 'Reminder settings updated successfully',
    task: {
      id: updated.id,
      reminderEnabled: updated.reminderEnabled,
      reminderTimes: JSON.parse(updated.reminderTimes || '[]'),
      reminderMessage: updated.reminderMessage,
    },
  };
}

export async function snoozeTask(taskId: string, duration: string, userId: string) {
  if (!duration) throw new ServiceError(400, 'Validation Error', 'duration is required (e.g., "15MIN", "1HR", "TOMORROW", "NEXT_WEEK")');

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { client: { select: { id: true, createdById: true } } },
  });
  assertFound(task, 'Task');
  if (task.client?.createdById !== userId && task.assignedToId !== userId)
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to snooze this task');

  const now = new Date();
  let snoozedUntil: Date;
  switch (duration) {
    case '15MIN':
      snoozedUntil = new Date(now.getTime() + 15 * 60 * 1000);
      break;
    case '1HR':
      snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000);
      break;
    case 'TOMORROW':
      snoozedUntil = new Date(now);
      snoozedUntil.setDate(snoozedUntil.getDate() + 1);
      snoozedUntil.setHours(9, 0, 0, 0);
      break;
    case 'NEXT_WEEK':
      snoozedUntil = new Date(now);
      snoozedUntil.setDate(snoozedUntil.getDate() + 7);
      snoozedUntil.setHours(9, 0, 0, 0);
      break;
    default:
      throw new ServiceError(400, 'Validation Error', 'Invalid duration. Must be one of: 15MIN, 1HR, TOMORROW, NEXT_WEEK');
  }

  await prisma.task.update({ where: { id: taskId }, data: { snoozedUntil } });
  await prisma.taskReminderHistory.create({
    data: {
      taskId,
      userId,
      reminderType: 'SNOOZE',
      method: 'IN_APP',
      delivered: true,
      metadata: JSON.stringify({ duration, snoozedUntil: snoozedUntil.toISOString() }),
    },
  });

  return { message: 'Task snoozed successfully', snoozedUntil: snoozedUntil.toISOString() };
}

export async function getReminderHistory(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { client: { select: { id: true, createdById: true } } },
  });
  assertFound(task, 'Task');
  if (task.client?.createdById !== userId && task.assignedToId !== userId)
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to view reminder history for this task');

  const history = await prisma.taskReminderHistory.findMany({
    where: { taskId },
    orderBy: { remindedAt: 'desc' },
    take: 50,
  });

  return {
    taskId,
    history: history.map((h) => ({
      id: h.id,
      reminderType: h.reminderType,
      method: h.method,
      delivered: h.delivered,
      remindedAt: h.remindedAt,
      metadata: h.metadata ? JSON.parse(h.metadata) : null,
    })),
  };
}

// ─── templates ──────────────────────────────────────────────────────────────

function normalizeTaskTemplate(template: {
  id: string;
  name: string;
  description: string | null;
  text: string;
  type: string;
  priority: string;
  tags: string;
  dueDays: number | null;
  steps: string | null;
  isSystem: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const parseArrayField = (value: string | null): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => `${item}`.trim()).filter(Boolean);
    } catch {
      // Legacy template values may be CSV strings.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  };

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    text: template.text,
    type: template.type,
    priority: template.priority,
    tags: parseArrayField(template.tags),
    dueDays: template.dueDays,
    steps: parseArrayField(template.steps),
    isSystem: template.isSystem,
    source: template.isSystem ? 'SYSTEM' : 'PERSONAL',
    createdById: template.createdById,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function normalizeTagsInput(tags: string | string[] | undefined): string {
  if (Array.isArray(tags)) return JSON.stringify(tags);
  if (typeof tags === 'string') {
    const trimmed = tags.trim();
    if (!trimmed) return '[]';
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return JSON.stringify(parsed.map((tag) => `${tag}`.trim()).filter(Boolean));
      } catch {
        // fall through to CSV parsing for malformed JSON-like strings
      }
    }
    return JSON.stringify(trimmed.split(',').map((tag) => tag.trim()).filter(Boolean));
  }
  return '[]';
}

export async function listTaskTemplates(userId: string) {
  const templates = await prisma.taskTemplate.findMany({
    where: {
      OR: [
        { isSystem: true },
        { createdById: userId },
      ],
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return templates.map(normalizeTaskTemplate);
}

export async function createTaskTemplate(
  data: { name: string; description?: string; text: string; type?: string; priority?: string; tags?: string | string[]; dueDays?: number; steps?: any },
  userId: string,
) {
  const name = data.name?.trim();
  const text = data.text?.trim();
  if (!name || !text) throw new ServiceError(400, 'Validation Error', 'Template name and text are required');
  if (data.dueDays !== undefined && (Number.isNaN(data.dueDays) || data.dueDays < 0))
    throw new ServiceError(400, 'Validation Error', 'dueDays must be zero or greater');

  const created = await prisma.taskTemplate.create({
    data: {
      name,
      description: data.description?.trim() || null,
      text,
      type: data.type || 'GENERAL',
      priority: data.priority || 'MEDIUM',
      tags: normalizeTagsInput(data.tags),
      dueDays: data.dueDays,
      steps: data.steps ? JSON.stringify(data.steps) : null,
      isSystem: false,
      createdById: userId,
    },
  });
  return normalizeTaskTemplate(created);
}

export async function updateTaskTemplate(
  templateId: string,
  data: { name?: string; description?: string | null; text?: string; type?: string; priority?: string; tags?: string | string[]; dueDays?: number | null; steps?: any[] | null },
  userId: string,
) {
  const existing = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new ServiceError(404, 'Not Found', 'Task template not found');
  if (existing.isSystem) throw new ServiceError(403, 'Access Denied', 'System templates are read-only');
  if (existing.createdById !== userId) throw new ServiceError(403, 'Access Denied', 'You can only update your own templates');

  if (data.dueDays !== undefined && data.dueDays !== null && (Number.isNaN(data.dueDays) || data.dueDays < 0))
    throw new ServiceError(400, 'Validation Error', 'dueDays must be zero or greater');
  if (data.name !== undefined && !data.name.trim())
    throw new ServiceError(400, 'Validation Error', 'Template name cannot be empty');
  if (data.text !== undefined && !data.text.trim())
    throw new ServiceError(400, 'Validation Error', 'Template text cannot be empty');

  const updated = await prisma.taskTemplate.update({
    where: { id: templateId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.text !== undefined && { text: data.text.trim() }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.tags !== undefined && { tags: normalizeTagsInput(data.tags) }),
      ...(data.dueDays !== undefined && { dueDays: data.dueDays }),
      ...(data.steps !== undefined && { steps: data.steps ? JSON.stringify(data.steps) : null }),
    },
  });

  return normalizeTaskTemplate(updated);
}

export async function deleteTaskTemplate(templateId: string, userId: string) {
  const existing = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new ServiceError(404, 'Not Found', 'Task template not found');
  if (existing.isSystem) throw new ServiceError(403, 'Access Denied', 'System templates are read-only');
  if (existing.createdById !== userId) throw new ServiceError(403, 'Access Denied', 'You can only delete your own templates');

  await prisma.taskTemplate.delete({ where: { id: templateId } });
  return { message: 'Task template archived successfully' };
}

// ─── attachments ────────────────────────────────────────────────────────────

export async function listTaskAttachments(taskId: string, userId: string) {
  await verifyTaskOwnership(taskId, userId);
  return prisma.taskAttachment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTaskAttachment(
  taskId: string,
  data: { type: string; name: string; url?: string; content?: string; metadata?: any },
  userId: string,
) {
  if (!data.type || !data.name) throw new ServiceError(400, 'Validation Error', 'Attachment type and name are required');
  await verifyTaskOwnership(taskId, userId);
  return prisma.taskAttachment.create({
    data: {
      taskId,
      type: data.type,
      name: data.name,
      url: data.url,
      content: data.content,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      createdBy: userId,
    },
  });
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string, userId: string) {
  await verifyTaskOwnership(taskId, userId);
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  return { message: 'Task attachment archived successfully' };
}

// ─── claim & clone ──────────────────────────────────────────────────────────

export async function claimTask(taskId: string, userId: string) {
  const existingTask = await verifyTaskOwnership(taskId, userId);

  if (existingTask.assignedToId) throw new ServiceError(400, 'Validation Error', 'Task is already assigned');

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { assignedToId: userId },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  if (existingTask.clientId) {
    await prisma.activity.create({
      data: { clientId: existingTask.clientId, userId, type: 'TASK_CLAIMED', description: `Task "${existingTask.text}" claimed` },
    });
    await fireTaskAssignedTrigger(task.id, existingTask.clientId, userId, userId);
  }

  return task;
}

export async function cloneTask(taskId: string, userId: string) {
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      client: { select: { id: true, createdById: true } },
      subtasks: true,
      attachments: true,
    },
  });
  assertFound(existingTask, 'Task');
  if (existingTask.client?.createdById !== userId)
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to clone this task');

  const clonedTask = await prisma.task.create({
    data: {
      text: `${existingTask.text} (Copy)`,
      description: existingTask.description,
      type: existingTask.type,
      priority: existingTask.priority,
      tags: existingTask.tags,
      clientId: existingTask.clientId,
      assignedToId: existingTask.assignedToId,
      createdById: userId,
      isRecurring: false,
    },
    include: {
      subtasks: true,
      attachments: true,
      assignedTo: { select: { id: true, name: true } },
    },
  });

  if (existingTask.subtasks.length > 0) {
    await prisma.taskSubtask.createMany({
      data: existingTask.subtasks.map((s) => ({
        taskId: clonedTask.id,
        text: s.text,
        isCompleted: false,
        order: s.order,
      })),
    });
  }

  if (existingTask.attachments.length > 0) {
    await prisma.taskAttachment.createMany({
      data: existingTask.attachments.map((a) => ({
        taskId: clonedTask.id,
        type: a.type,
        name: a.name,
        url: a.url,
        content: a.content,
        metadata: a.metadata,
        createdBy: userId,
      })),
    });
  }

  return clonedTask;
}

// ─── calendar integration ───────────────────────────────────────────────────

export async function createEventFromTask(
  taskId: string,
  data: { startTime?: string; duration?: number; allDay?: boolean },
  userId: string,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { client: true },
  });
  assertFound(task, 'Task');
  if (task.client && task.client.createdById !== userId)
    throw new ServiceError(403, 'Access Denied', 'Access denied');

  let endTime: Date | undefined;
  if (!data.allDay && data.startTime) {
    const start = new Date(data.startTime);
    endTime = new Date(start.getTime() + (data.duration || 60) * 60000);
  }

  return prisma.event.create({
    data: {
      title: task.text,
      description: task.description,
      eventType: 'TASK',
      startTime: data.startTime ? new Date(data.startTime) : task.dueDate || new Date(),
      endTime,
      allDay: data.allDay || false,
      clientId: task.clientId,
      taskId: task.id,
      createdById: userId,
      status: 'CONFIRMED',
    },
    include: { client: { select: { id: true, nameEncrypted: true } } },
  });
}

export async function createReminderFromTask(
  taskId: string,
  data: { remindAt?: string; dueDate?: string },
  userId: string,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { client: true },
  });
  assertFound(task, 'Task');
  if (task.client && task.client.createdById !== userId)
    throw new ServiceError(403, 'Access Denied', 'Access denied');

  return prisma.reminder.create({
    data: {
      userId,
      clientId: task.clientId,
      title: `Task: ${task.text}`,
      description: task.description,
      category: 'FOLLOW_UP',
      priority: task.priority === 'URGENT' ? 'HIGH' : task.priority === 'HIGH' ? 'MEDIUM' : 'LOW',
      remindAt: data.remindAt ? new Date(data.remindAt) : task.dueDate || new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : task.dueDate,
      status: 'PENDING',
    },
    include: { client: { select: { id: true, nameEncrypted: true } } },
  });
}
