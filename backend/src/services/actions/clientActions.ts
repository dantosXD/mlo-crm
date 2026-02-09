import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult } from './types.js';

interface ClientActionConfig {
  status?: string;
  addTags?: string[];
  removeTags?: string[];
  assignedToId?: string;
}

export async function executeUpdateClientStatus(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.status) return { success: false, message: 'Status is required' };

    const validStatuses = ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED', 'INACTIVE'];
    if (!validStatuses.includes(config.status)) return { success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };

    const client = await prisma.client.findUnique({ where: { id: context.clientId } });
    if (!client) return { success: false, message: `Client not found: ${context.clientId}` };

    const updatedClient = await prisma.client.update({ where: { id: context.clientId }, data: { status: config.status } });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'STATUS_CHANGED',
        description: `Client status changed from ${client.status} to ${config.status} via workflow`,
        metadata: JSON.stringify({ fromStatus: client.status, toStatus: config.status }),
      },
    });

    return { success: true, message: 'Client status updated successfully', data: { clientId: updatedClient.id, fromStatus: client.status, toStatus: config.status } };
  } catch (error) {
    console.error('Error executing UPDATE_CLIENT_STATUS action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update client status' };
  }
}

export async function executeAddTag(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.addTags || config.addTags.length === 0) return { success: false, message: 'Tags to add are required' };

    const client = await prisma.client.findUnique({ where: { id: context.clientId } });
    if (!client) return { success: false, message: `Client not found: ${context.clientId}` };

    const existingTags = JSON.parse(client.tags);
    const newTags = [...new Set([...existingTags, ...config.addTags])];

    const updatedClient = await prisma.client.update({ where: { id: context.clientId }, data: { tags: JSON.stringify(newTags) } });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'TAGS_ADDED',
        description: `Tags added via workflow: ${config.addTags.join(', ')}`,
        metadata: JSON.stringify({ addedTags: config.addTags, allTags: newTags }),
      },
    });

    return { success: true, message: 'Tags added successfully', data: { clientId: updatedClient.id, addedTags: config.addTags, allTags: newTags } };
  } catch (error) {
    console.error('Error executing ADD_TAG action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add tags' };
  }
}

export async function executeRemoveTag(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.removeTags || config.removeTags.length === 0) return { success: false, message: 'Tags to remove are required' };

    const client = await prisma.client.findUnique({ where: { id: context.clientId } });
    if (!client) return { success: false, message: `Client not found: ${context.clientId}` };

    const existingTags = JSON.parse(client.tags);
    const newTags = existingTags.filter((tag: string) => !config.removeTags!.includes(tag));

    const updatedClient = await prisma.client.update({ where: { id: context.clientId }, data: { tags: JSON.stringify(newTags) } });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'TAGS_REMOVED',
        description: `Tags removed via workflow: ${config.removeTags.join(', ')}`,
        metadata: JSON.stringify({ removedTags: config.removeTags, remainingTags: newTags }),
      },
    });

    return { success: true, message: 'Tags removed successfully', data: { clientId: updatedClient.id, removedTags: config.removeTags, remainingTags: newTags } };
  } catch (error) {
    console.error('Error executing REMOVE_TAG action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to remove tags' };
  }
}

export async function executeAssignClient(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.assignedToId) return { success: false, message: 'assignedToId is required' };

    const client = await prisma.client.findUnique({ where: { id: context.clientId } });
    if (!client) return { success: false, message: `Client not found: ${context.clientId}` };

    const newOwner = await prisma.user.findUnique({ where: { id: config.assignedToId } });
    if (!newOwner) return { success: false, message: `User not found: ${config.assignedToId}` };

    const updatedClient = await prisma.client.update({ where: { id: context.clientId }, data: { createdById: config.assignedToId } });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'CLIENT_ASSIGNED',
        description: `Client reassigned via workflow`,
        metadata: JSON.stringify({ fromUserId: client.createdById, toUserId: config.assignedToId, toUserName: newOwner.name }),
      },
    });

    return { success: true, message: 'Client assigned successfully', data: { clientId: updatedClient.id, fromUserId: client.createdById, toUserId: config.assignedToId, toUserName: newOwner.name } };
  } catch (error) {
    console.error('Error executing ASSIGN_CLIENT action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to assign client' };
  }
}

export async function executeClientAction(
  actionType: string,
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'UPDATE_CLIENT_STATUS': return executeUpdateClientStatus(config, context);
    case 'ADD_TAG': return executeAddTag(config, context);
    case 'REMOVE_TAG': return executeRemoveTag(config, context);
    case 'ASSIGN_CLIENT': return executeAssignClient(config, context);
    default: return { success: false, message: `Unknown client action type: ${actionType}` };
  }
}
