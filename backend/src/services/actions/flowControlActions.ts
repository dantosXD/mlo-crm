import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult } from './types.js';

interface FlowControlActionConfig {
  delayMinutes?: number;
  delayHours?: number;
  delayDays?: number;
  delayUntil?: Date;
  condition?: string;
  trueActions?: any[];
  falseActions?: any[];
  variable?: string;
  operator?: string;
  value?: any;
  actions?: any[];
  continueOnError?: boolean;
}

export async function executeWait(
  config: FlowControlActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    let delayMs = 0;

    if (config.delayMinutes) { delayMs = config.delayMinutes * 60 * 1000; }
    else if (config.delayHours) { delayMs = config.delayHours * 60 * 60 * 1000; }
    else if (config.delayDays) { delayMs = config.delayDays * 24 * 60 * 60 * 1000; }
    else if (config.delayUntil) {
      const targetTime = new Date(config.delayUntil).getTime();
      delayMs = Math.max(0, targetTime - Date.now());
    } else {
      return { success: false, message: 'Wait duration not specified. Use delayMinutes, delayHours, delayDays, or delayUntil' };
    }

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'WORKFLOW_WAIT',
        description: `Workflow paused for ${Math.round(delayMs / 1000 / 60)} minutes`,
        metadata: JSON.stringify({ delayMs, delayMinutes: config.delayMinutes, delayHours: config.delayHours, delayDays: config.delayDays, delayUntil: config.delayUntil }),
      },
    });

    return {
      success: true, message: `Wait action scheduled for ${Math.round(delayMs / 1000 / 60)} minutes`,
      data: { delayMs, delayMinutes: Math.round(delayMs / 1000 / 60), scheduled: true, note: 'In production, this would schedule a delayed job' },
    };
  } catch (error) {
    console.error('Error executing WAIT action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to execute wait action' };
  }
}

export async function executeBranch(
  config: FlowControlActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.variable || !config.operator || config.value === undefined) {
      return { success: false, message: 'Branch action requires variable, operator, and value' };
    }

    let actualValue: any;
    switch (config.variable) {
      case 'client.status': {
        const client = await prisma.client.findUnique({ where: { id: context.clientId }, select: { status: true } });
        actualValue = client?.status;
        break;
      }
      case 'client.tags': {
        const clientTags = await prisma.client.findUnique({ where: { id: context.clientId }, select: { tags: true } });
        actualValue = JSON.parse(clientTags?.tags || '[]');
        break;
      }
      case 'trigger.type':
        actualValue = context.triggerType;
        break;
      default:
        return { success: false, message: `Unknown variable: ${config.variable}` };
    }

    let conditionResult = false;
    switch (config.operator) {
      case 'equals': conditionResult = actualValue === config.value; break;
      case 'not_equals': conditionResult = actualValue !== config.value; break;
      case 'contains': conditionResult = Array.isArray(actualValue) ? actualValue.includes(config.value) : String(actualValue).includes(String(config.value)); break;
      case 'greater_than': conditionResult = Number(actualValue) > Number(config.value); break;
      case 'less_than': conditionResult = Number(actualValue) < Number(config.value); break;
      case 'in': conditionResult = Array.isArray(config.value) && config.value.includes(actualValue); break;
      default: return { success: false, message: `Unknown operator: ${config.operator}` };
    }

    const actionsToExecute = conditionResult ? config.trueActions : config.falseActions;

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'WORKFLOW_BRANCH',
        description: `Branch evaluated: ${config.variable} ${config.operator} ${config.value} = ${conditionResult}`,
        metadata: JSON.stringify({ variable: config.variable, operator: config.operator, value: config.value, actualValue, result: conditionResult, actionCount: actionsToExecute?.length || 0 }),
      },
    });

    return {
      success: true, message: `Branch evaluated: ${conditionResult ? 'TRUE' : 'FALSE'}`,
      data: { conditionResult, actionsToExecute: actionsToExecute || [], actionCount: actionsToExecute?.length || 0, note: 'Actions would be executed by the workflow engine' },
    };
  } catch (error) {
    console.error('Error executing BRANCH action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to execute branch action' };
  }
}

export async function executeParallel(
  config: FlowControlActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.actions || config.actions.length === 0) return { success: false, message: 'Parallel action requires at least one action to execute' };

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'WORKFLOW_PARALLEL',
        description: `Parallel execution started for ${config.actions.length} action(s)`,
        metadata: JSON.stringify({ actionCount: config.actions.length, continueOnError: config.continueOnError || false, actions: config.actions.map((a: any) => ({ type: a.type, config: a.config })) }),
      },
    });

    const results = config.actions.map((action: any) => ({ actionType: action.type, status: 'pending', note: 'Would be executed in parallel by workflow engine' }));

    return {
      success: true, message: `Parallel execution initiated for ${config.actions.length} action(s)`,
      data: { actionCount: config.actions.length, continueOnError: config.continueOnError || false, results, note: 'Actions would be executed in parallel by the workflow engine' },
    };
  } catch (error) {
    console.error('Error executing PARALLEL action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to execute parallel action' };
  }
}

export async function executeFlowControlAction(
  actionType: string,
  config: FlowControlActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'WAIT': return executeWait(config, context);
    case 'BRANCH': return executeBranch(config, context);
    case 'PARALLEL': return executeParallel(config, context);
    default: return { success: false, message: `Unknown flow control action type: ${actionType}` };
  }
}
