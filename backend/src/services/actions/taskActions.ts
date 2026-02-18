import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult, replacePlaceholders, getClientData } from './types.js';
import { logger } from '../../utils/logger.js';

interface TaskActionConfig {
  text?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDays?: number;
  dueDate?: Date;
  assignedToId?: string;
  assignedToRole?: string;
  taskId?: string;
}

export async function executeCreateTask(
  config: TaskActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.text) return { success: false, message: 'Task text is required' };

    let dueDate: Date | null = null;
    if (config.dueDays) { dueDate = new Date(); dueDate.setDate(dueDate.getDate() + config.dueDays); }
    else if (config.dueDate) { dueDate = config.dueDate; }

    let assignedToId = config.assignedToId;
    if (!assignedToId && config.assignedToRole) {
      const user = await prisma.user.findFirst({ where: { role: config.assignedToRole, isActive: true } });
      assignedToId = user?.id;
    }
    if (!assignedToId) assignedToId = context.userId;

    const client = await getClientData(context.clientId);
    const placeholderContext = { ...context, clientData: client };
    const finalText = replacePlaceholders(config.text, placeholderContext);
    const finalDescription = config.description ? replacePlaceholders(config.description, placeholderContext) : null;

    const task = await prisma.task.create({
      data: { clientId: context.clientId, text: finalText, description: finalDescription, priority: config.priority || 'MEDIUM', dueDate, assignedToId, status: 'TODO' },
    });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'TASK_CREATED',
        description: `Task created via workflow: ${finalText}`,
        metadata: JSON.stringify({ taskId: task.id, priority: task.priority, dueDate: task.dueDate, assignedToId }),
      },
    });

    return { success: true, message: 'Task created successfully', data: { taskId: task.id, text: finalText, priority: task.priority, dueDate: task.dueDate, assignedToId } };
  } catch (error) {
    logger.error('action_create_task_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to create task' };
  }
}

export async function executeCompleteTask(
  config: TaskActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.taskId) return { success: false, message: 'Task ID is required to complete a task' };

    const task = await prisma.task.findUnique({ where: { id: config.taskId } });
    if (!task) return { success: false, message: `Task not found: ${config.taskId}` };
    if (task.status === 'COMPLETE') return { success: true, message: 'Task is already complete', data: { taskId: task.id, status: task.status } };

    const updatedTask = await prisma.task.update({ where: { id: config.taskId }, data: { status: 'COMPLETE', completedAt: new Date() } });

    if (task.clientId) {
      await prisma.activity.create({
        data: {
          clientId: task.clientId, userId: context.userId, type: 'TASK_COMPLETED',
          description: `Task completed via workflow: ${task.text}`,
          metadata: JSON.stringify({ taskId: task.id }),
        },
      });
    }

    return { success: true, message: 'Task completed successfully', data: { taskId: updatedTask.id, status: updatedTask.status, completedAt: updatedTask.completedAt } };
  } catch (error) {
    logger.error('action_complete_task_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to complete task' };
  }
}

export async function executeAssignTask(
  config: TaskActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.taskId) return { success: false, message: 'Task ID is required to assign a task' };
    if (!config.assignedToId && !config.assignedToRole) return { success: false, message: 'Either assignedToId or assignedToRole must be specified' };

    const task = await prisma.task.findUnique({ where: { id: config.taskId } });
    if (!task) return { success: false, message: `Task not found: ${config.taskId}` };

    let assignedToId = config.assignedToId;
    if (!assignedToId && config.assignedToRole) {
      const user = await prisma.user.findFirst({ where: { role: config.assignedToRole, isActive: true } });
      assignedToId = user?.id;
    }
    if (!assignedToId) return { success: false, message: `No active user found with role: ${config.assignedToRole}` };

    const updatedTask = await prisma.task.update({ where: { id: config.taskId }, data: { assignedToId } });
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, name: true, email: true, role: true } });

    if (task.clientId) {
      await prisma.activity.create({
        data: {
          clientId: task.clientId, userId: context.userId, type: 'TASK_ASSIGNED',
          description: `Task reassigned via workflow: ${task.text}`,
          metadata: JSON.stringify({ taskId: task.id, assignedToId, assignedToName: assignee?.name }),
        },
      });
    }

    return { success: true, message: 'Task assigned successfully', data: { taskId: updatedTask.id, assignedToId, assignedToName: assignee?.name } };
  } catch (error) {
    logger.error('action_assign_task_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to assign task' };
  }
}

export async function executeTaskAction(
  actionType: string,
  config: TaskActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'CREATE_TASK': return executeCreateTask(config, context);
    case 'COMPLETE_TASK': return executeCompleteTask(config, context);
    case 'ASSIGN_TASK': return executeAssignTask(config, context);
    default: return { success: false, message: `Unknown task action type: ${actionType}` };
  }
}
