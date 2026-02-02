import prisma from '../utils/prisma.js';
import {
  executeDocumentAction,
  executeCommunicationAction,
  executeTaskAction,
  executeClientAction,
  executeNoteAction,
  executeNotificationAction,
  executeFlowControlAction,
  executeWebhookAction,
  type ExecutionContext as ActionExecutionContext,
} from './actionExecutor.js';
import { evaluateConditions, type ConditionContext } from './conditionEvaluator.js';

export interface ExecutionContext {
  clientId?: string;
  triggerType: string;
  triggerData?: any;
  userId: string;
}

export interface ExecutionResult {
  success: boolean;
  executionId?: string;
  status: string;
  message: string;
  currentStep?: number;
  totalSteps?: number;
  error?: string;
}

/**
 * Execute a workflow
 * @param workflowId - ID of the workflow to execute
 * @param context - Execution context (clientId, triggerType, triggerData, userId)
 * @returns Execution result
 */
export async function executeWorkflow(
  workflowId: string,
  context: ExecutionContext
): Promise<ExecutionResult> {
  try {
    // Fetch workflow
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return {
        success: false,
        status: 'FAILED',
        message: 'Workflow not found',
      };
    }

    if (!workflow.isActive) {
      return {
        success: false,
        status: 'FAILED',
        message: 'Workflow is not active',
      };
    }

    // Parse workflow actions and conditions
    const actions = JSON.parse(workflow.actions);
    const conditions = workflow.conditions ? JSON.parse(workflow.conditions) : null;

    // Validate conditions if present
    if (conditions && context.clientId) {
      const conditionContext: ConditionContext = {
        clientId: context.clientId,
        triggerType: context.triggerType,
        triggerData: context.triggerData || {},
      };
      const conditionResult = await evaluateConditions(conditions, conditionContext);
      if (!conditionResult.matched) {
        return {
          success: true,
          status: 'SKIPPED',
          message: 'Workflow conditions not met',
        };
      }
    }

    // Create workflow execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        clientId: context.clientId || null,
        status: 'RUNNING',
        currentStep: 0,
        startedAt: new Date(),
        triggerData: context.triggerData ? JSON.stringify(context.triggerData) : null,
        logs: JSON.stringify([]),
      },
    });

    // Execute actions sequentially
    const totalSteps = actions.length;
    const logs: any[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const actionType = action.type;

      try {
        // Update current step
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { currentStep: i },
        });

        // Execute action based on type
        let actionResult: any;
        const actionCategory = getActionCategory(actionType);

        // Convert ExecutionContext to ActionExecutionContext
        // clientId is required for action executors, use empty string if not provided
        const actionContext: ActionExecutionContext = {
          clientId: context.clientId || '',
          triggerType: context.triggerType,
          triggerData: context.triggerData || {},
          userId: context.userId,
        };

        switch (actionCategory) {
          case 'document':
            actionResult = await executeDocumentAction(actionType, action.config || {}, actionContext);
            break;
          case 'communication':
            actionResult = await executeCommunicationAction(actionType, action.config || {}, actionContext);
            break;
          case 'task':
            actionResult = await executeTaskAction(actionType, action.config || {}, actionContext);
            break;
          case 'client':
            actionResult = await executeClientAction(actionType, action.config || {}, actionContext);
            break;
          case 'note':
            actionResult = await executeNoteAction(actionType, action.config || {}, actionContext);
            break;
          case 'notification':
            actionResult = await executeNotificationAction(actionType, action.config || {}, actionContext);
            break;
          case 'flowControl':
            actionResult = await executeFlowControlAction(actionType, action.config || {}, actionContext);
            break;
          case 'webhook':
            actionResult = await executeWebhookAction(actionType, action.config || {}, actionContext);
            break;
          default:
            actionResult = {
              success: false,
              message: `Unknown action type: ${actionType}`,
            };
        }

        // Create execution log entry
        const logEntry = {
          stepIndex: i,
          actionType,
          status: actionResult.success ? 'SUCCESS' : 'FAILED',
          inputData: JSON.stringify(action.config || {}),
          outputData: JSON.stringify(actionResult.data || {}),
          errorMessage: actionResult.error || null,
        };

        await prisma.workflowExecutionLog.create({
          data: {
            executionId: execution.id,
            stepIndex: i,
            actionType,
            status: actionResult.success ? 'SUCCESS' : 'FAILED',
            inputData: JSON.stringify(action.config || {}),
            outputData: JSON.stringify(actionResult.data || {}),
            errorMessage: actionResult.error || null,
          },
        });

        logs.push(logEntry);

        // If action failed and not continueOnError, stop execution
        if (!actionResult.success && action.continueOnError !== true) {
          await prisma.workflowExecution.update({
            where: { id: execution.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              errorMessage: actionResult.message || 'Action failed',
              logs: JSON.stringify(logs),
            },
          });

          return {
            success: false,
            executionId: execution.id,
            status: 'FAILED',
            message: `Workflow failed at step ${i + 1}: ${actionResult.message}`,
            currentStep: i,
            totalSteps,
            error: actionResult.message,
          };
        }

        // Handle flow control actions
        if (actionCategory === 'flowControl' && actionType === 'BRANCH' && actionResult.data) {
          // Branch action returns which actions to execute next
          const nextActions = actionResult.data.trueActions || actionResult.data.falseActions;
          if (nextActions && Array.isArray(nextActions)) {
            // Insert next actions after current action
            actions.splice(i + 1, 0, ...nextActions);
          }
        } else if (actionCategory === 'flowControl' && actionType === 'WAIT' && actionResult.data) {
          // Wait action - in production, this would schedule a job
          // For now, just log it
          logs.push({
            timestamp: new Date().toISOString(),
            message: `Wait scheduled: ${actionResult.data.message}`,
          });
        } else if (actionCategory === 'flowControl' && actionType === 'PARALLEL' && actionResult.data) {
          // Parallel action - in production, this would execute actions in parallel
          // For now, execute sequentially but mark as pending
          const parallelActions = action.config.actions;
          if (Array.isArray(parallelActions)) {
            for (const parallelAction of parallelActions) {
              const parallelActionType = parallelAction.type;
              const parallelActionCategory = getActionCategory(parallelActionType);
              let parallelResult: any;

              switch (parallelActionCategory) {
                case 'document':
                  parallelResult = await executeDocumentAction(parallelActionType, parallelAction.config || {}, actionContext);
                  break;
                case 'communication':
                  parallelResult = await executeCommunicationAction(parallelActionType, parallelAction.config || {}, actionContext);
                  break;
                case 'task':
                  parallelResult = await executeTaskAction(parallelActionType, parallelAction.config || {}, actionContext);
                  break;
                case 'client':
                  parallelResult = await executeClientAction(parallelActionType, parallelAction.config || {}, actionContext);
                  break;
                case 'note':
                  parallelResult = await executeNoteAction(parallelActionType, parallelAction.config || {}, actionContext);
                  break;
                case 'notification':
                  parallelResult = await executeNotificationAction(parallelActionType, parallelAction.config || {}, actionContext);
                  break;
                case 'webhook':
                  parallelResult = await executeWebhookAction(parallelActionType, parallelAction.config || {}, actionContext);
                  break;
                default:
                  parallelResult = { success: false, message: `Unknown action type: ${parallelActionType}` };
              }

              logs.push({
                stepIndex: i,
                actionType: parallelActionType,
                status: parallelResult.success ? 'SUCCESS' : 'FAILED',
                inputData: JSON.stringify(parallelAction.config || {}),
                outputData: JSON.stringify(parallelResult.data || {}),
                errorMessage: parallelResult.error || null,
                parallel: true,
              });
            }
          }
        }
      } catch (actionError) {
        const errorMessage = actionError instanceof Error ? actionError.message : 'Unknown error';

        // Create execution log entry for error
        await prisma.workflowExecutionLog.create({
          data: {
            executionId: execution.id,
            stepIndex: i,
            actionType,
            status: 'FAILED',
            inputData: JSON.stringify(action.config || {}),
            outputData: null,
            errorMessage,
          },
        });

        logs.push({
          stepIndex: i,
          actionType,
          status: 'FAILED',
          error: errorMessage,
        });

        // Stop execution on error
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage,
            logs: JSON.stringify(logs),
          },
        });

        return {
          success: false,
          executionId: execution.id,
          status: 'FAILED',
          message: `Workflow failed at step ${i + 1}: ${errorMessage}`,
          currentStep: i,
          totalSteps,
          error: errorMessage,
        };
      }
    }

    // Update execution as completed
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        logs: JSON.stringify(logs),
      },
    });

    return {
      success: true,
      executionId: execution.id,
      status: 'COMPLETED',
      message: 'Workflow executed successfully',
      currentStep: totalSteps,
      totalSteps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      status: 'FAILED',
      message: `Workflow execution failed: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * Cancel a running workflow execution
 * @param executionId - ID of the execution to cancel
 * @param userId - ID of the user requesting cancellation
 * @returns Success status
 */
export async function cancelWorkflowExecution(
  executionId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return {
        success: false,
        message: 'Execution not found',
      };
    }

    if (execution.status !== 'RUNNING' && execution.status !== 'PENDING') {
      return {
        success: false,
        message: `Cannot cancel execution with status: ${execution.status}`,
      };
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Execution cancelled successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      message: `Failed to cancel execution: ${errorMessage}`,
    };
  }
}

/**
 * Get execution logs
 * @param executionId - ID of the execution
 * @returns Execution logs
 */
export async function getExecutionLogs(
  executionId: string
): Promise<{ success: boolean; logs?: any[]; message?: string }> {
  try {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        executionLogs: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });

    if (!execution) {
      return {
        success: false,
        message: 'Execution not found',
      };
    }

    const logs = execution.executionLogs.map((log) => ({
      stepIndex: log.stepIndex,
      actionType: log.actionType,
      status: log.status,
      inputData: log.inputData ? JSON.parse(log.inputData) : null,
      outputData: log.outputData ? JSON.parse(log.outputData) : null,
      errorMessage: log.errorMessage,
      executedAt: log.executedAt,
    }));

    return {
      success: true,
      logs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      message: `Failed to fetch logs: ${errorMessage}`,
    };
  }
}

/**
 * Determine action category based on action type
 */
function getActionCategory(actionType: string): string {
  const documentActions = ['UPDATE_DOCUMENT_STATUS', 'REQUEST_DOCUMENT'];
  const communicationActions = ['SEND_EMAIL', 'SEND_SMS', 'GENERATE_LETTER'];
  const taskActions = ['CREATE_TASK', 'COMPLETE_TASK', 'ASSIGN_TASK'];
  const clientActions = ['UPDATE_CLIENT_STATUS', 'ADD_TAG', 'REMOVE_TAG', 'ASSIGN_CLIENT'];
  const noteActions = ['CREATE_NOTE'];
  const notificationActions = ['SEND_NOTIFICATION', 'LOG_ACTIVITY'];
  const flowControlActions = ['WAIT', 'BRANCH', 'PARALLEL'];
  const webhookActions = ['CALL_WEBHOOK'];

  if (documentActions.includes(actionType)) return 'document';
  if (communicationActions.includes(actionType)) return 'communication';
  if (taskActions.includes(actionType)) return 'task';
  if (clientActions.includes(actionType)) return 'client';
  if (noteActions.includes(actionType)) return 'note';
  if (notificationActions.includes(actionType)) return 'notification';
  if (flowControlActions.includes(actionType)) return 'flowControl';
  if (webhookActions.includes(actionType)) return 'webhook';

  return 'unknown';
}
