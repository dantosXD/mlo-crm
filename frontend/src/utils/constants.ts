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
  NOTE_ADDED: 'Note Added', NOTE_UPDATED: 'Note Updated', NOTE_DELETED: 'Note Deleted',
  TASK_CREATED: 'Task Created', TASK_COMPLETED: 'Task Completed', TASK_DELETED: 'Task Deleted',
  DOCUMENT_UPLOADED: 'Document Uploaded', DOCUMENT_STATUS_CHANGED: 'Document Status Changed',
  DOCUMENT_DELETED: 'Document Deleted', STATUS_CHANGED: 'Status Changed',
  CLIENT_CREATED: 'Client Created', CLIENT_UPDATED: 'Client Updated',
  LOAN_SCENARIO_CREATED: 'Loan Scenario Created', LOAN_SCENARIO_DELETED: 'Loan Scenario Deleted',
};

export const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  NOTE_ADDED: 'blue', NOTE_UPDATED: 'cyan', NOTE_DELETED: 'gray',
  TASK_CREATED: 'green', TASK_COMPLETED: 'teal', TASK_DELETED: 'gray',
  DOCUMENT_UPLOADED: 'violet', DOCUMENT_STATUS_CHANGED: 'orange', DOCUMENT_DELETED: 'gray',
  STATUS_CHANGED: 'yellow', CLIENT_CREATED: 'green', CLIENT_UPDATED: 'blue',
  LOAN_SCENARIO_CREATED: 'pink', LOAN_SCENARIO_DELETED: 'gray',
};

export const COMM_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  EMAIL: { label: 'Email', color: 'blue' },
  SMS: { label: 'SMS', color: 'cyan' },
  LETTER: { label: 'Letter', color: 'grape' },
};

export const COMM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'gray' },
  READY: { label: 'Ready', color: 'blue' },
  PENDING: { label: 'Pending', color: 'yellow' },
  SENT: { label: 'Sent', color: 'green' },
  FAILED: { label: 'Failed', color: 'red' },
  DELIVERED: { label: 'Delivered', color: 'green' },
  SCHEDULED: { label: 'Scheduled', color: 'cyan' },
};

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
