// Shared types used across multiple pages and components

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  notes?: any[];
  tasks?: any[];
  documents?: any[];
  loanScenarios?: any[];
  nameEncrypted?: string;
  emailEncrypted?: string;
  phoneEncrypted?: string;
}

export interface Note {
  id: string;
  clientId: string;
  clientName?: string;
  text: string;
  tags: string[];
  isPinned: boolean;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  clientId?: string;
  text: string;
  description?: string;
  status: string;
  priority: string;
  type?: string;
  dueDate?: string | null;
  completedAt?: string;
  assignedTo?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
  clientName?: string;
  subtasks?: Array<{
    id: string;
    text: string;
    isCompleted: boolean;
    order?: number;
    dueDate?: string;
  }>;
  tags?: string[];
  reminderEnabled?: boolean;
  reminderTimes?: string[];
  reminderMessage?: string;
  snoozedUntil?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  recurringInterval?: number;
  recurringEndDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskStatistics {
  total: number;
  dueToday: number;
  overdue: number;
  completed: number;
  upcoming: number;
}

export interface TasksResponse {
  tasks: Task[];
  pagination: PaginationInfo;
}

export interface LoanScenario {
  id: string;
  clientId: string;
  name: string;
  loanType?: 'PURCHASE' | 'REFINANCE';
  amount: number;
  interestRate?: number;
  termYears?: number;
  downPayment?: number;
  propertyValue?: number;
  propertyTaxes?: number;
  homeInsurance?: number;
  hoaFees?: number;
  pmiRate?: number;
  monthlyPayment?: number;
  totalMonthlyPayment?: number;
  totalInterest?: number;
  loanToValue?: number;
  debtToIncome?: number;
  isPreferred: boolean;
  scenarioData?: string | any;
  preferredProgramId?: string | null;
  status: string;
  recommendationNotes?: string | null;
  sharedAt?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientDocument {
  id: string;
  clientId: string;
  name: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  status: 'REQUIRED' | 'REQUESTED' | 'UPLOADED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  category: 'INCOME' | 'EMPLOYMENT' | 'ASSETS' | 'PROPERTY' | 'INSURANCE' | 'CREDIT' | 'OTHER';
  dueDate?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  clientName?: string;
}

export interface Activity {
  id: string;
  clientId: string;
  type: string;
  description: string;
  metadata?: Record<string, any> & {
    direction?: 'inbound' | 'outbound';
    duration?: number;
    outcome?: string;
    followUpDate?: string;
    followUpNeeded?: boolean;
  };
  user: { id: string; name: string };
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  remindAt: string;
  dueDate?: string;
  status: string;
  client?: {
    id: string;
    name: string;
  };
  tags?: string[];
  isRecurring: boolean;
  snoozedUntil?: string;
  snoozeCount: number;
}

export interface ReminderStats {
  total: number;
  pending: number;
  overdue: number;
  completed: number;
  snoozed: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface Communication {
  id: string;
  clientId: string;
  clientName: string;
  type: string;
  status: string;
  subject: string | null;
  body: string;
  recipient: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  followUpDate: string | null;
  attachments: any[];
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  templateName: string | null;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  subject: string | null;
  body: string;
  placeholders: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CommunicationsResponse {
  data: Communication[];
  pagination: PaginationInfo;
}

export interface DashboardStats {
  totalClients: number;
  totalDocuments: number;
  totalTasks: number;
  totalLoanScenarios: number;
  clientsByStatus: Record<string, number>;
  recentClients: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  pendingTasks: number;
  pendingTasksList: Task[];
  workflowStats?: {
    activeWorkflows: number;
    completedToday: number;
    failedToday: number;
    runningExecutions: Array<{
      id: string;
      status: string;
      startedAt: string;
      completedAt: string | null;
      workflow: {
        id: string;
        name: string;
      };
      client?: {
        id: string;
        name: string;
      } | null;
    }>;
  };
}

export interface MetaOption {
  value: string;
  label: string;
  description: string;
}
