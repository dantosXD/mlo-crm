/**
 * Static metadata for workflow trigger types and action types.
 * Extracted from workflowRoutes.ts to keep routes thin.
 */

export const TRIGGER_TYPES_META = [
  {
    type: 'CLIENT_CREATED',
    label: 'Client Created',
    description: 'Triggered when a new client is created',
    configFields: [],
  },
  {
    type: 'CLIENT_STATUS_CHANGED',
    label: 'Client Status Changed',
    description: 'Triggered when a client status changes',
    configFields: [
      {
        name: 'fromStatus',
        type: 'select',
        label: 'From Status',
        options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
      },
      {
        name: 'toStatus',
        type: 'select',
        label: 'To Status',
        options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
      },
    ],
  },
  {
    type: 'DOCUMENT_UPLOADED',
    label: 'Document Uploaded',
    description: 'Triggered when a document is uploaded',
    configFields: [
      {
        name: 'category',
        type: 'select',
        label: 'Document Category',
        options: ['INCOME', 'EMPLOYMENT', 'ASSETS', 'PROPERTY', 'INSURANCE', 'CREDIT', 'OTHER'],
      },
    ],
  },
  {
    type: 'DOCUMENT_STATUS_CHANGED',
    label: 'Document Status Changed',
    description: 'Triggered when a document status changes',
    configFields: [
      {
        name: 'fromStatus',
        type: 'select',
        label: 'From Status',
        options: ['REQUIRED', 'REQUESTED', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
      },
      {
        name: 'toStatus',
        type: 'select',
        label: 'To Status',
        options: ['REQUIRED', 'REQUESTED', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
      },
    ],
  },
  {
    type: 'TASK_CREATED',
    label: 'Task Created',
    description: 'Triggered when a new task is created',
    configFields: [
      {
        name: 'priority',
        type: 'select',
        label: 'Priority',
        options: ['LOW', 'MEDIUM', 'HIGH'],
        description: 'Only trigger for tasks with this priority (leave empty for all)',
      },
    ],
  },
  {
    type: 'TASK_ASSIGNED',
    label: 'Task Assigned',
    description: 'Triggered when a task is assigned to a user',
    configFields: [
      {
        name: 'assignedToId',
        type: 'text',
        label: 'Assigned To User ID',
        description: 'Only trigger when assigned to this specific user (leave empty for all)',
      },
    ],
  },
  {
    type: 'TASK_DUE',
    label: 'Task Due',
    description: 'Triggered when a task becomes due',
    configFields: [
      {
        name: 'priority',
        type: 'select',
        label: 'Priority',
        options: ['LOW', 'MEDIUM', 'HIGH'],
      },
    ],
  },
  {
    type: 'TASK_COMPLETED',
    label: 'Task Completed',
    description: 'Triggered when a task is marked complete',
    configFields: [],
  },
  {
    type: 'NOTE_CREATED',
    label: 'Note Created',
    description: 'Triggered when a note is created',
    configFields: [],
  },
  {
    type: 'NOTE_WITH_TAG',
    label: 'Note with Tag',
    description: 'Triggered when a note is created with a specific tag',
    configFields: [
      {
        name: 'tag',
        type: 'text',
        label: 'Tag Name',
        description: 'Only trigger when this specific tag is added to a note',
      },
    ],
  },
  {
    type: 'CLIENT_INACTIVITY',
    label: 'Client Inactivity',
    description: 'Triggered when a client has been inactive for a specified period',
    configFields: [
      {
        name: 'inactiveDays',
        type: 'number',
        label: 'Inactive Days',
        description: 'Number of days of inactivity to trigger the workflow',
        default: 7,
      },
    ],
  },
  {
    type: 'DOCUMENT_DUE_DATE',
    label: 'Document Due Date',
    description: 'Triggered when a document due date is approaching or has passed',
    configFields: [
      {
        name: 'daysBefore',
        type: 'number',
        label: 'Days Before Due Date',
        description: 'Trigger this many days before the due date (use 0 for due date, negative for after)',
        default: 3,
      },
      {
        name: 'daysAfter',
        type: 'number',
        label: 'Days After Due Date',
        description: 'Also trigger after due date until this many days past (0 means only before)',
        default: 0,
      },
    ],
  },
  {
    type: 'DOCUMENT_EXPIRED',
    label: 'Document Expired',
    description: 'Triggered when a document has expired (expiration date passed)',
    configFields: [],
  },
  {
    type: 'TASK_OVERDUE',
    label: 'Task Overdue',
    description: 'Triggered when a task becomes overdue',
    configFields: [
      {
        name: 'priority',
        type: 'select',
        label: 'Priority',
        options: ['LOW', 'MEDIUM', 'HIGH'],
        description: 'Only trigger for tasks with this priority (leave empty for all)',
      },
      {
        name: 'overdueDays',
        type: 'number',
        label: 'Overdue Days',
        description: 'Number of days overdue to trigger (0 means immediately overdue)',
        default: 0,
      },
    ],
  },
  {
    type: 'PIPELINE_STAGE_ENTRY',
    label: 'Pipeline Stage Entry',
    description: 'Triggered when a client enters a pipeline stage',
    configFields: [
      {
        name: 'stage',
        type: 'select',
        label: 'Stage',
        description: 'Only trigger when entering this specific stage (leave empty for all stages)',
        options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
      },
    ],
  },
  {
    type: 'PIPELINE_STAGE_EXIT',
    label: 'Pipeline Stage Exit',
    description: 'Triggered when a client exits a pipeline stage',
    configFields: [
      {
        name: 'fromStage',
        type: 'select',
        label: 'From Stage',
        description: 'Only trigger when exiting this specific stage (leave empty for all stages)',
        options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
      },
      {
        name: 'toStage',
        type: 'select',
        label: 'To Stage',
        description: 'Only trigger when moving to this specific stage (leave empty for all stages)',
        options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
      },
    ],
  },
  {
    type: 'TIME_IN_STAGE_THRESHOLD',
    label: 'Time in Stage Threshold',
    description: 'Triggered when a client has been in a stage too long',
    configFields: [
      {
        name: 'stage',
        type: 'select',
        label: 'Stage',
        description: 'Only check clients in this stage (leave empty to check all stages)',
        options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
      },
      {
        name: 'thresholdDays',
        type: 'number',
        label: 'Threshold Days',
        description: 'Number of days in stage to trigger the workflow',
        default: 30,
      },
    ],
  },
  {
    type: 'SCHEDULED',
    label: 'Scheduled',
    description: 'Triggered on a recurring schedule (daily, weekly, monthly)',
    configFields: [
      {
        name: 'schedule',
        type: 'select',
        label: 'Schedule',
        options: ['daily', 'weekly', 'monthly'],
        description: 'How often to trigger the workflow',
      },
      {
        name: 'time',
        type: 'time',
        label: 'Time',
        description: 'Time of day to trigger (HH:MM format)',
      },
      {
        name: 'dayOfWeek',
        type: 'number',
        label: 'Day of Week',
        description: 'For weekly schedules: 0=Sunday, 1=Monday, etc.',
      },
      {
        name: 'dayOfMonth',
        type: 'number',
        label: 'Day of Month',
        description: 'For monthly schedules: 1-31',
      },
    ],
  },
  {
    type: 'DATE_BASED',
    label: 'Date Based',
    description: 'Triggered on a specific date or relative to a client field',
    configFields: [
      {
        name: 'dateField',
        type: 'select',
        label: 'Date Field',
        options: ['client.createdAt', 'client.updatedAt', 'custom'],
        description: 'Which date field to use for triggering',
      },
      {
        name: 'customDate',
        type: 'date',
        label: 'Custom Date',
        description: 'Specific date to trigger (only if dateField is "custom")',
      },
      {
        name: 'offsetDays',
        type: 'number',
        label: 'Offset Days',
        description: 'Number of days before/after the date to trigger (negative for before, positive for after)',
      },
    ],
  },
  {
    type: 'MANUAL',
    label: 'Manual Trigger',
    description: 'Triggered manually by a user',
    configFields: [],
  },
  {
    type: 'WEBHOOK',
    label: 'Webhook',
    description: 'Triggered by an external system via webhook',
    configFields: [
      {
        name: 'secret',
        type: 'text',
        label: 'Webhook Secret',
        description: 'Secret key for verifying webhook signatures (leave empty to auto-generate)',
        required: false,
      },
    ],
  },
];

export const ACTION_TYPES_META = [
  {
    type: 'SEND_EMAIL',
    label: 'Send Email',
    description: 'Send an email to the client',
    configFields: [
      { name: 'templateId', type: 'select', label: 'Email Template', required: true },
      { name: 'to', type: 'text', label: 'To Email', description: 'Leave blank to use client email' },
    ],
  },
  {
    type: 'SEND_SMS',
    label: 'Send SMS',
    description: 'Send an SMS to the client',
    configFields: [
      { name: 'templateId', type: 'select', label: 'SMS Template', required: true },
      { name: 'to', type: 'text', label: 'To Phone', description: 'Leave blank to use client phone' },
    ],
  },
  {
    type: 'CREATE_TASK',
    label: 'Create Task',
    description: 'Create a new task',
    configFields: [
      { name: 'text', type: 'text', label: 'Task Description', required: true },
      { name: 'priority', type: 'select', label: 'Priority', options: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
      { name: 'dueDays', type: 'number', label: 'Due in Days', default: 7 },
      { name: 'assignedToId', type: 'select', label: 'Assign To', description: 'Leave blank to assign to workflow creator' },
    ],
  },
  {
    type: 'UPDATE_CLIENT_STATUS',
    label: 'Update Client Status',
    description: 'Change the status of a client',
    configFields: [
      {
        name: 'status',
        type: 'select',
        label: 'Status',
        required: true,
        options: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING', 'CLEAR_TO_CLOSE', 'CLOSED', 'DENIED'],
      },
    ],
  },
  {
    type: 'ADD_TAG',
    label: 'Add Tag',
    description: 'Add tags to a client',
    configFields: [
      { name: 'tags', type: 'text', label: 'Tags', required: true, description: 'Comma-separated list of tags to add' },
    ],
  },
  {
    type: 'REMOVE_TAG',
    label: 'Remove Tag',
    description: 'Remove tags from a client',
    configFields: [
      { name: 'tags', type: 'text', label: 'Tags', required: true, description: 'Comma-separated list of tags to remove' },
    ],
  },
  {
    type: 'ASSIGN_CLIENT',
    label: 'Assign Client',
    description: 'Assign or reassign a client to a user',
    configFields: [
      { name: 'assignedToId', type: 'select', label: 'Assign To', required: true, description: 'User to assign the client to' },
    ],
  },
  {
    type: 'REQUEST_DOCUMENT',
    label: 'Request Document',
    description: 'Request a document from the client',
    configFields: [
      { name: 'category', type: 'select', label: 'Document Category', required: true, options: ['INCOME', 'EMPLOYMENT', 'ASSETS', 'PROPERTY', 'INSURANCE', 'CREDIT', 'OTHER'] },
      { name: 'name', type: 'text', label: 'Document Name', required: true },
      { name: 'dueDays', type: 'number', label: 'Due in Days', default: 7 },
    ],
  },
  {
    type: 'ADD_NOTE',
    label: 'Add Note',
    description: 'Add a note to the client',
    configFields: [
      { name: 'text', type: 'textarea', label: 'Note Text', required: true },
      { name: 'tags', type: 'text', label: 'Tags', description: 'Comma-separated list of tags' },
    ],
  },
  {
    type: 'SEND_NOTIFICATION',
    label: 'Send Notification',
    description: 'Send an in-app notification to a user',
    configFields: [
      { name: 'userId', type: 'select', label: 'User', description: 'User to notify (leave blank to use workflow creator)' },
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'message', type: 'textarea', label: 'Message', required: true },
      { name: 'link', type: 'text', label: 'Link', description: 'Optional link to related resource' },
    ],
  },
  {
    type: 'CALL_WEBHOOK',
    label: 'Call Webhook',
    description: 'Call an external webhook/API with optional retry logic',
    configFields: [
      { name: 'url', type: 'text', label: 'Webhook URL', required: true },
      { name: 'method', type: 'select', label: 'HTTP Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' },
      { name: 'headers', type: 'json', label: 'Headers', description: 'JSON object of headers (e.g., {"Authorization": "Bearer token"})' },
      { name: 'bodyTemplate', type: 'textarea', label: 'Body Template', description: 'JSON body template with placeholders (use {{client_name}}, {{client_email}}, etc.)' },
      { name: 'retryOnFailure', type: 'checkbox', label: 'Retry on Failure', default: true },
      { name: 'maxRetries', type: 'number', label: 'Max Retries', default: 3, description: 'Maximum number of retry attempts' },
      { name: 'retryDelaySeconds', type: 'number', label: 'Retry Delay (seconds)', default: 5, description: 'Delay between retry attempts' },
      { name: 'timeoutSeconds', type: 'number', label: 'Timeout (seconds)', default: 30, description: 'Request timeout in seconds' },
    ],
  },
  {
    type: 'WAIT',
    label: 'Wait',
    description: 'Pause workflow execution for a specified period',
    configFields: [
      { name: 'duration', type: 'number', label: 'Duration', required: true, default: 1 },
      { name: 'unit', type: 'select', label: 'Unit', required: true, options: ['minutes', 'hours', 'days'], default: 'hours' },
    ],
  },
];
