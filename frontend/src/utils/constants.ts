// Shared constants used across multiple pages and components

export const PIPELINE_STAGES = [
  { key: 'LEAD', label: 'Lead', color: 'gray', hex: '#868e96' },
  { key: 'PRE_QUALIFIED', label: 'Pre-Qualified', color: 'blue', hex: '#339af0' },
  { key: 'ACTIVE', label: 'Active', color: 'green', hex: '#40c057' },
  { key: 'PROCESSING', label: 'Processing', color: 'yellow', hex: '#fab005' },
  { key: 'UNDERWRITING', label: 'Underwriting', color: 'orange', hex: '#fd7e14' },
  { key: 'CLEAR_TO_CLOSE', label: 'Clear to Close', color: 'lime', hex: '#69db7c' },
  { key: 'CLOSED', label: 'Closed', color: 'green.9', hex: '#2f9e44' },
  { key: 'DENIED', label: 'Denied', color: 'red', hex: '#fa5252' },
];

export const CLIENT_STATUS_COLORS: Record<string, string> = {
  LEAD: 'gray', PRE_QUALIFIED: 'blue', ACTIVE: 'green', PROCESSING: 'yellow',
  UNDERWRITING: 'orange', CLEAR_TO_CLOSE: 'lime', CLOSED: 'green.9',
  DENIED: 'red', INACTIVE: 'gray',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'gray', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red',
};

export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] || 'blue';
}

export const DOCUMENT_STATUS_COLORS: Record<string, string> = {
  REQUIRED: 'gray', REQUESTED: 'yellow', UPLOADED: 'blue', UNDER_REVIEW: 'orange',
  APPROVED: 'green', REJECTED: 'red', EXPIRED: 'gray',
};

export const DOCUMENT_CATEGORY_COLORS: Record<string, string> = {
  INCOME: 'blue', EMPLOYMENT: 'cyan', ASSETS: 'green', PROPERTY: 'orange',
  INSURANCE: 'grape', CREDIT: 'pink', OTHER: 'gray',
};

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  INCOME: 'Income', EMPLOYMENT: 'Employment', ASSETS: 'Assets', PROPERTY: 'Property',
  INSURANCE: 'Insurance', CREDIT: 'Credit', OTHER: 'Other',
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  NOTE_ADDED: 'Note Added', NOTE_UPDATED: 'Note Updated', NOTE_DELETED: 'Note Deleted', NOTE_ARCHIVED: 'Note Archived',
  TASK_CREATED: 'Task Created', TASK_COMPLETED: 'Task Completed', TASK_DELETED: 'Task Deleted', TASK_ARCHIVED: 'Task Archived',
  DOCUMENT_UPLOADED: 'Document Uploaded', DOCUMENT_STATUS_CHANGED: 'Document Status Changed',
  DOCUMENT_DELETED: 'Document Deleted', DOCUMENT_ARCHIVED: 'Document Archived', STATUS_CHANGED: 'Status Changed',
  CLIENT_CREATED: 'Client Created', CLIENT_UPDATED: 'Client Updated', CLIENT_ARCHIVED: 'Client Archived',
  LOAN_SCENARIO_CREATED: 'Loan Scenario Created', LOAN_SCENARIO_DELETED: 'Loan Scenario Deleted', LOAN_SCENARIO_ARCHIVED: 'Loan Scenario Archived',
  CALL_PLACED: 'Call Placed', CALL_RECEIVED: 'Call Received',
  EMAIL_SENT: 'Email Sent', EMAIL_RECEIVED: 'Email Received',
  MEETING: 'Meeting', TEXT_SENT: 'Text Sent', TEXT_RECEIVED: 'Text Received',
  INTERACTION_OTHER: 'Other Interaction',
};

export const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  NOTE_ADDED: 'blue', NOTE_UPDATED: 'cyan', NOTE_DELETED: 'gray', NOTE_ARCHIVED: 'gray',
  TASK_CREATED: 'green', TASK_COMPLETED: 'teal', TASK_DELETED: 'gray', TASK_ARCHIVED: 'gray',
  DOCUMENT_UPLOADED: 'violet', DOCUMENT_STATUS_CHANGED: 'orange', DOCUMENT_DELETED: 'gray', DOCUMENT_ARCHIVED: 'gray',
  STATUS_CHANGED: 'yellow', CLIENT_CREATED: 'green', CLIENT_UPDATED: 'blue', CLIENT_ARCHIVED: 'gray',
  LOAN_SCENARIO_CREATED: 'pink', LOAN_SCENARIO_DELETED: 'gray', LOAN_SCENARIO_ARCHIVED: 'gray',
  CALL_PLACED: 'lime', CALL_RECEIVED: 'teal',
  EMAIL_SENT: 'indigo', EMAIL_RECEIVED: 'cyan',
  MEETING: 'grape', TEXT_SENT: 'blue', TEXT_RECEIVED: 'cyan',
  INTERACTION_OTHER: 'orange',
};

export const INTERACTION_TYPES = [
  { value: 'CALL_PLACED', label: 'Call Placed' },
  { value: 'CALL_RECEIVED', label: 'Call Received' },
  { value: 'EMAIL_SENT', label: 'Email Sent' },
  { value: 'EMAIL_RECEIVED', label: 'Email Received' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'TEXT_SENT', label: 'Text Sent' },
  { value: 'TEXT_RECEIVED', label: 'Text Received' },
  { value: 'INTERACTION_OTHER', label: 'Other' },
];

export const INTERACTION_OUTCOMES = [
  { value: 'SUCCESSFUL', label: 'Successful' },
  { value: 'NO_ANSWER', label: 'No Answer' },
  { value: 'LEFT_VOICEMAIL', label: 'Left Voicemail' },
  { value: 'FOLLOW_UP_NEEDED', label: 'Follow-up Needed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
];

export const ACTIVITY_FILTER_GROUPS = [
  { value: 'all', label: 'All' },
  { value: 'interactions', label: 'Interactions' },
  { value: 'notes', label: 'Notes' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'documents', label: 'Documents' },
  { value: 'system', label: 'System' },
];

export const ACTIVITY_FILTER_TYPE_MAP: Record<string, string[]> = {
  all: [],
  interactions: ['CALL_PLACED', 'CALL_RECEIVED', 'EMAIL_SENT', 'EMAIL_RECEIVED', 'MEETING', 'TEXT_SENT', 'TEXT_RECEIVED', 'INTERACTION_OTHER'],
  notes: ['NOTE_ADDED', 'NOTE_UPDATED', 'NOTE_DELETED', 'NOTE_ARCHIVED'],
  tasks: ['TASK_CREATED', 'TASK_COMPLETED', 'TASK_DELETED', 'TASK_ARCHIVED'],
  documents: ['DOCUMENT_UPLOADED', 'DOCUMENT_STATUS_CHANGED', 'DOCUMENT_DELETED', 'DOCUMENT_ARCHIVED'],
  system: ['STATUS_CHANGED', 'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_ARCHIVED', 'LOAN_SCENARIO_CREATED', 'LOAN_SCENARIO_DELETED', 'LOAN_SCENARIO_ARCHIVED'],
};

export const COMM_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  EMAIL: { label: 'Email', color: 'blue' },
  SMS: { label: 'SMS', color: 'cyan' },
  LETTER: { label: 'Letter', color: 'grape' },
};

export const COMM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'gray' },
  READY: { label: 'Ready', color: 'blue' },
  SENT: { label: 'Sent', color: 'green' },
  FAILED: { label: 'Failed', color: 'red' },
};

export const COMM_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'READY', label: 'Ready' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
];

export const PLACEHOLDER_INFO: Record<string, { description: string; example: string }> = {
  '{{client_name}}': { description: 'Full name of the client', example: 'John Smith' },
  '{{client_email}}': { description: 'Email address of the client', example: 'john@example.com' },
  '{{client_phone}}': { description: 'Phone number of the client', example: '(555) 123-4567' },
  '{{client_status}}': { description: 'Current status of the client', example: 'Active' },
  '{{loan_amount}}': { description: 'Loan amount', example: '$350,000' },
  '{{loan_officer_name}}': { description: 'Name of the loan officer', example: 'Jane Doe' },
  '{{company_name}}': { description: 'Name of your company', example: 'ABC Mortgage' },
  '{{due_date}}': { description: 'Due date for documents/tasks', example: 'January 15, 2026' },
  '{{date}}': { description: 'Current date', example: 'February 2, 2026' },
  '{{time}}': { description: 'Current time', example: '2:30 PM' },
  '{{property_address}}': { description: 'Property address', example: '123 Main St, City, State 12345' },
  '{{trigger_type}}': { description: 'Type of trigger that initiated the communication', example: 'Document Uploaded' },
};

export const PLACEHOLDER_KEYS = Object.keys(PLACEHOLDER_INFO);
