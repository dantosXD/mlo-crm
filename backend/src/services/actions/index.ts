// Barrel re-export for all action modules
export type { ExecutionContext, ActionResult } from './types.js';
export { replacePlaceholders, getClientData, sleep } from './types.js';
export { executeSendEmail, executeSendSms, executeGenerateLetter, executeCommunicationAction } from './communicationActions.js';
export { executeCreateTask, executeCompleteTask, executeAssignTask, executeTaskAction } from './taskActions.js';
export { executeUpdateClientStatus, executeAddTag, executeRemoveTag, executeAssignClient, executeClientAction } from './clientActions.js';
export { executeUpdateDocumentStatus, executeRequestDocument, executeDocumentAction } from './documentActions.js';
export { executeCallWebhook, executeWebhookAction } from './webhookActions.js';
export { executeCreateNote, executeNoteAction } from './noteActions.js';
export { executeSendNotification, executeLogActivity, executeNotificationAction } from './notificationActions.js';
export { executeWait, executeBranch, executeParallel, executeFlowControlAction } from './flowControlActions.js';
