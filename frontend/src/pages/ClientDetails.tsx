import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Title,
  Button,
  Group,
  Text,
  Paper,
  LoadingOverlay,
  Badge,
  Stack,
  Tabs,
  Card,
  SimpleGrid,
  Center,
  Alert,
  Breadcrumbs,
  Anchor,
  Select,
  Grid,
  ThemeIcon,
  TagsInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconNotes,
  IconFiles,
  IconChecklist,
  IconCalculator,
  IconAlertCircle,
  IconLock,
  IconChevronRight,
  IconEdit,
  IconTrash,
  IconTag,
  IconCheck,
  IconMail,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { canWriteClients } from '../utils/roleUtils';
import { api } from '../utils/api';
import {
  CLIENT_STATUS_COLORS,
} from '../utils/constants';
import type { Note, Task, LoanScenario, ClientDocument } from '../types';
import { OverviewTab, NotesTab, DocumentsTab, TasksTab, LoansTab, CommunicationsTab, ActivitySidebar } from '../components/client';
import { EditClientModal, DeleteClientModal, UnsavedChangesModal, AddNoteModal, EditNoteModal, AddTaskModal, AddScenarioModal, CompareModal, DeleteScenarioModal, AddDocumentModal, DeleteDocumentModal, AssignPackageModal, RequestDocumentModal, CommunicationPreviewModal, LogInteractionModal } from '../components/client/modals';
import { useClientStatuses, useClient, useClientNotes, useClientTasks, useClientLoanScenarios, useClientDocuments, useClientActivities } from '../hooks';

const statusColors = CLIENT_STATUS_COLORS;

// Define valid tab values
const validTabs = ['overview', 'notes', 'documents', 'tasks', 'loans', 'communications'];

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, user } = useAuthStore();
  const canWrite = canWriteClients(user?.role);
  const queryClient = useQueryClient();

  // Store the referrer URL when coming from clients list with filters
  const clientsListUrl = useMemo(() => {
    // Check if we have a stored referrer in sessionStorage
    const storedReferrer = sessionStorage.getItem('clientsListReferrer');
    // If we came from /clients with params, use that; otherwise default to /clients
    if (storedReferrer && storedReferrer.startsWith('/clients')) {
      return storedReferrer;
    }
    return '/clients';
  }, []);

  // Get initial tab from URL or default to 'overview'
  const tabFromUrl = searchParams.get('tab');
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'overview';
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);

  // Handle tab change - update URL when tab changes
  const handleTabChange = (value: string | null) => {
    setActiveTab(value);
    if (value) {
      setSearchParams({ tab: value }, { replace: true });
    }
  };

  // Sync activeTab with URL changes (e.g., when navigating with browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);
  // --- Shared hooks for data fetching ---
  const { data: client = null, isLoading: loading, error: clientError } = useClient(id);
  const accessDenied = (clientError as any)?.status === 403;
  const error = clientError && !accessDenied ? (clientError as Error).message : null;

  const statusOptions = useClientStatuses();
  const { data: notes = [], isLoading: loadingNotes } = useClientNotes(id);
  const existingNoteTags = useMemo(() => {
    const allTags = notes.flatMap((n: Note) => n.tags || []);
    return [...new Set(allTags)];
  }, [notes]);
  const { data: tasks = [], isLoading: loadingTasks } = useClientTasks(id);
  const { data: loanScenarios = [], isLoading: loadingScenarios } = useClientLoanScenarios(id);
  const { data: documents = [], isLoading: loadingDocuments } = useClientDocuments(id);
  const { data: activities = [], isLoading: loadingActivities } = useClientActivities(id);

  // Communications filter state (must be declared before communications query)
  const [communicationsTypeFilter, setCommunicationsTypeFilter] = useState<string>('all');
  const [communicationsStatusFilter, setCommunicationsStatusFilter] = useState<string>('all');

  // --- React Query: communications ---
  const { data: communications = [], isLoading: loadingCommunications } = useQuery({
    queryKey: ['client-communications', id, communicationsTypeFilter, communicationsStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ client_id: id! });
      if (communicationsTypeFilter !== 'all') params.append('type', communicationsTypeFilter);
      if (communicationsStatusFilter !== 'all') params.append('status', communicationsStatusFilter);
      const response = await api.get(`/communications?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch communications');
      const data = await response.json();
      return (data.data || data.communications || []) as any[];
    },
    enabled: !!id,
  });

  // --- React Query: workflow executions ---
  const { data: workflowExecutions = [], isLoading: loadingWorkflowExecutions } = useQuery({
    queryKey: ['client-workflow-executions', id],
    queryFn: async () => {
      const response = await api.get(`/workflow-executions?client_id=${id}`);
      if (!response.ok) throw new Error('Failed to fetch workflow executions');
      const data = await response.json();
      return (data.executions || data || []) as any[];
    },
    enabled: !!id,
  });

  // --- React Query: team members ---
  const { data: teamMembers = [], isLoading: loadingTeamMembers } = useQuery({
    queryKey: ['client-team-members'],
    queryFn: async () => {
      const response = await api.get('/users/team');
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json() as Promise<{ id: string; name: string; role: string }[]>;
    },
  });

  // --- React Query: document packages (on-demand) ---
  const { data: availablePackages = [], refetch: refetchPackages } = useQuery({
    queryKey: ['document-packages'],
    queryFn: async () => {
      const response = await api.get('/document-packages');
      if (!response.ok) throw new Error('Failed to fetch packages');
      return response.json() as Promise<any[]>;
    },
    enabled: false,
  });

  // Helper to refresh activities after mutations
  const refreshActivities = () => {
    queryClient.invalidateQueries({ queryKey: ['client-activities', id] });
  };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editHasUnsavedChanges, setEditHasUnsavedChanges] = useState(false);
  const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  // Note UI state
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [editNoteModalOpen, setEditNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Task UI state
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Loan scenario UI state
  const [addScenarioModalOpen, setAddScenarioModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<LoanScenario | null>(null);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [deleteScenarioModalOpen, setDeleteScenarioModalOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<LoanScenario | null>(null);

  // Document UI state
  const [addDocumentModalOpen, setAddDocumentModalOpen] = useState(false);
  const [deleteDocumentModalOpen, setDeleteDocumentModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ClientDocument | null>(null);
  const [assignPackageModalOpen, setAssignPackageModalOpen] = useState(false);
  const [requestDocumentModalOpen, setRequestDocumentModalOpen] = useState(false);

  // Log Interaction UI state
  const [logInteractionModalOpen, setLogInteractionModalOpen] = useState(false);

  // Communications UI state
  const [previewCommunicationOpened, setPreviewCommunicationOpened] = useState(false);
  const [previewCommunication, setPreviewCommunication] = useState<any | null>(null);

  // Track pending navigation path when warning dialog is shown
  const pendingNavigation = useRef<(() => void) | null>(null);

  // Custom navigation function that checks for unsaved changes in edit modal
  const safeNavigate = useCallback((path: string | number) => {
    if (editHasUnsavedChanges) {
      pendingNavigation.current = () => {
        if (typeof path === 'number') {
          navigate(path);
        } else {
          navigate(path);
        }
      };
      setUnsavedChangesModalOpen(true);
    } else {
      if (typeof path === 'number') {
        navigate(path);
      } else {
        navigate(path);
      }
    }
  }, [editHasUnsavedChanges, navigate]);

  // Handle "Stay" button in unsaved changes modal
  const handleStayOnPage = () => {
    setUnsavedChangesModalOpen(false);
    pendingNavigation.current = null;
  };

  // Handle "Leave" button in unsaved changes modal
  const handleLeavePage = () => {
    setUnsavedChangesModalOpen(false);
    setEditModalOpen(false);
    if (pendingNavigation.current) {
      pendingNavigation.current();
      pendingNavigation.current = null;
    }
  };

  // Handle closing the edit modal with unsaved changes check
  const handleCloseEditModal = useCallback(() => {
    if (editHasUnsavedChanges) {
      pendingNavigation.current = () => {
        // No navigation needed, just close the modal
      };
      setUnsavedChangesModalOpen(true);
    } else {
      setEditModalOpen(false);
    }
  }, [editHasUnsavedChanges]);

  const getCsrfToken = (): string | null => {
    const match = document.cookie.match(/(?:^|; )csrf-token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus || !client || newStatus === client.status) return;

    const oldStatus = client.status;
    setUpdatingStatus(true);
    setStatusUpdateSuccess(false);

    try {
      const response = await api.put(`/clients/${id}`, {
        name: client.name,
        email: client.email,
        phone: client.phone,
        status: newStatus,
      });

      // Handle deleted client scenario (404)
      if (response.status === 404) {
        notifications.show({
          title: 'Client Not Found',
          message: 'This client has been deleted by another user. You will be redirected to the clients list.',
          color: 'orange',
          autoClose: 4000,
        });
        // Redirect to clients list after a short delay
        setTimeout(() => {
          navigate('/clients');
        }, 4000);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const updatedClient = await response.json();

      // Show inline success indicator - set before updating client to ensure it renders
      setStatusUpdateSuccess(true);
      queryClient.setQueryData(['client', id], updatedClient);

      // Auto-hide the success indicator after 2.5 seconds
      setTimeout(() => {
        setStatusUpdateSuccess(false);
      }, 2500);
    } catch (error) {
      console.error('Error updating status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update status',
        color: 'red',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTagsChange = async (newTags: string[]) => {
    if (!client) return;

    setUpdatingTags(true);

    try {
      const response = await api.put(`/clients/${id}`, {
        name: client.name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        tags: newTags,
      });

      if (!response.ok) {
        throw new Error('Failed to update tags');
      }

      const updatedClient = await response.json();
      queryClient.setQueryData(['client', id], updatedClient);

      notifications.show({
        title: 'Tags Updated',
        message: `Tags updated successfully`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating tags:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update tags',
        color: 'red',
      });
    } finally {
      setUpdatingTags(false);
    }
  };

  const sortedNotes = useMemo(() => {
    const copy = [...notes];
    copy.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });
    return copy;
  }, [notes]);

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setEditNoteModalOpen(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await api.delete(`/notes/${noteId}`);

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      queryClient.setQueryData(['client-notes', id], (old: Note[] = []) => old.filter(n => n.id !== noteId));
      refreshActivities();

      notifications.show({
        title: 'Success',
        message: 'Note deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete note',
        color: 'red',
      });
    }
  };

  const handleTogglePin = async (note: Note) => {
    const newPinnedState = !note.isPinned;

    try {
      const response = await api.put(`/notes/${note.id}`, {
        isPinned: newPinnedState,
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const updatedNote = await response.json();
      queryClient.setQueryData(['client-notes', id], (old: Note[] = []) => old.map(n => n.id === note.id ? { ...n, isPinned: updatedNote.isPinned } : n));
      refreshActivities();

      notifications.show({
        title: 'Success',
        message: newPinnedState ? 'Note pinned to top' : 'Note unpinned',
        color: 'green',
      });
    } catch (error) {
      console.error('Error toggling pin:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update note',
        color: 'red',
      });
    }
  };

  // ...

  const handleToggleTaskStatus = async (task: Task) => {
    if (togglingTaskId === task.id) {
      return;
    }

    const newStatus = task.status === 'COMPLETE' ? 'TODO' : 'COMPLETE';
    setTogglingTaskId(task.id);

    try {
      const response = await api.patch(`/tasks/${task.id}/status`, {
        status: newStatus,
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const updatedTask = await response.json();
      queryClient.setQueryData(['client-tasks', id], (old: Task[] = []) => old.map(t => t.id === task.id ? { ...t, status: updatedTask.status, completedAt: updatedTask.completedAt } : t));
      refreshActivities();

      notifications.show({
        title: 'Success',
        message: newStatus === 'COMPLETE' ? 'Task completed' : 'Task reopened',
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating task:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update task',
        color: 'red',
      });
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await api.delete(`/tasks/${taskId}`);

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      queryClient.setQueryData(['client-tasks', id], (old: Task[] = []) => old.filter(t => t.id !== taskId));
      refreshActivities();

      notifications.show({
        title: 'Success',
        message: 'Task deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete task',
        color: 'red',
      });
    }
  };

  const handleSetPreferred = async (scenarioId: string) => {
    try {
      const response = await api.patch(`/loan-scenarios/${scenarioId}/preferred`);

      if (!response.ok) {
        throw new Error('Failed to set preferred');
      }

      queryClient.setQueryData(['client-loan-scenarios', id], (old: LoanScenario[] = []) => old.map(s => ({
        ...s,
        isPreferred: s.id === scenarioId,
      })));
      refreshActivities();

      notifications.show({
        title: 'Success',
        message: 'Preferred scenario updated',
        color: 'green',
      });
    } catch (error) {
      console.error('Error setting preferred:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to set preferred scenario',
        color: 'red',
      });
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    const scenario = loanScenarios.find(s => s.id === scenarioId) || null;
    setScenarioToDelete(scenario);
    setDeleteScenarioModalOpen(true);
  };

  const handleEditScenario = (scenario: LoanScenario) => {
    setEditingScenario(scenario);
    setAddScenarioModalOpen(true);
  };

  const handleScenarioStatusChange = async (scenarioId: string, status: string) => {
    try {
      const response = await api.patch(`/loan-scenarios/${scenarioId}/status`, { status });
      if (!response.ok) throw new Error('Failed to update status');
      queryClient.invalidateQueries({ queryKey: ['client-loan-scenarios', id] });
      queryClient.invalidateQueries({ queryKey: ['client-activities', id] });
      notifications.show({
        title: 'Status Updated',
        message: `Scenario ${status === 'SHARED' ? 'shared with client' : status === 'PROPOSED' ? 'proposed' : status === 'ARCHIVED' ? 'archived' : 'updated'}`,
        color: status === 'SHARED' ? 'green' : status === 'PROPOSED' ? 'blue' : 'gray',
      });
    } catch (error) {
      console.error('Error updating scenario status:', error);
      notifications.show({ title: 'Error', message: 'Failed to update scenario status', color: 'red' });
    }
  };

  const handleExportScenarioPDF = (scenario: LoanScenario) => {
    const content = `
<!DOCTYPE html>
<html>
<head>
  <title>Loan Scenario - ${scenario.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #228be6; border-bottom: 2px solid #228be6; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .info-item { background: #f8f9fa; padding: 15px; border-radius: 8px; }
    .info-item label { display: block; color: #666; font-size: 12px; margin-bottom: 5px; }
    .info-item value { display: block; font-size: 18px; font-weight: bold; color: #333; }
    .highlight { background: #e7f5ff; border: 1px solid #228be6; }
    .summary { background: #fff3cd; padding: 20px; border-radius: 8px; margin-top: 30px; }
    .footer { margin-top: 40px; color: #666; font-size: 12px; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Loan Scenario Analysis</h1>
  <h2>${scenario.name}</h2>
  <p><strong>Type:</strong> ${scenario.loanType}</p>
  ${client ? `<p><strong>Client:</strong> ${client.name}</p>` : ''}
  <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>

  <h2>Loan Details</h2>
  <div class="info-grid">
    <div class="info-item">
      <label>Loan Amount</label>
      <value>${formatCurrency(scenario.amount)}</value>
    </div>
    <div class="info-item">
      <label>Property Value</label>
      <value>${formatCurrency(scenario.propertyValue)}</value>
    </div>
    <div class="info-item">
      <label>Down Payment</label>
      <value>${formatCurrency(scenario.downPayment)}</value>
    </div>
    <div class="info-item">
      <label>Interest Rate</label>
      <value>${scenario.interestRate?.toFixed(2)}%</value>
    </div>
    <div class="info-item">
      <label>Loan Term</label>
      <value>${scenario.termYears} years</value>
    </div>
    <div class="info-item">
      <label>LTV Ratio</label>
      <value>${scenario.loanToValue ? scenario.loanToValue.toFixed(2) + '%' : '-'}</value>
    </div>
  </div>

  <h2>Monthly Costs</h2>
  <div class="info-grid">
    <div class="info-item highlight">
      <label>Monthly P&I Payment</label>
      <value>${formatCurrency(scenario.monthlyPayment)}</value>
    </div>
    <div class="info-item highlight">
      <label>Total Monthly Payment</label>
      <value>${formatCurrency(scenario.totalMonthlyPayment)}</value>
    </div>
    <div class="info-item">
      <label>Property Taxes (Annual)</label>
      <value>${formatCurrency(scenario.propertyTaxes)}</value>
    </div>
    <div class="info-item">
      <label>Home Insurance (Annual)</label>
      <value>${formatCurrency(scenario.homeInsurance)}</value>
    </div>
    <div class="info-item">
      <label>HOA Fees (Monthly)</label>
      <value>${formatCurrency(scenario.hoaFees)}</value>
    </div>
  </div>

  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Total Interest Over ${scenario.termYears} Years:</strong> ${formatCurrency(scenario.totalInterest)}</p>
    <p><strong>Total Cost of Loan:</strong> ${formatCurrency((scenario.amount || 0) + (scenario.totalInterest || 0))}</p>
  </div>

  <div class="footer">
    Generated by MLO Dashboard on ${new Date().toLocaleString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleExportAmortizationSchedule = (scenario: LoanScenario) => {
    const monthlyRate = (scenario.interestRate || 0) / 100 / 12;
    const totalMonths = (scenario.termYears || 0) * 12;
    const principal = scenario.amount || 0;

    let monthlyPayment = 0;
    if (monthlyRate > 0 && totalMonths > 0) {
      monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1);
    } else if (totalMonths > 0) {
      monthlyPayment = principal / totalMonths;
    }

    const schedule: Array<{ month: number; payment: number; principal: number; interest: number; balance: number }> = [];
    let balance = principal;
    let totalInterest = 0;

    for (let month = 1; month <= totalMonths; month += 1) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance = Math.max(0, balance - principalPayment);
      totalInterest += interestPayment;

      schedule.push({
        month,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance,
      });
    }

    const rows = schedule.map(row => `
      <tr>
        <td>${row.month}</td>
        <td>${formatCurrency(row.payment)}</td>
        <td>${formatCurrency(row.principal)}</td>
        <td>${formatCurrency(row.interest)}</td>
        <td>${formatCurrency(row.balance)}</td>
      </tr>
    `).join('');

    const totalPrincipal = schedule.reduce((sum, row) => sum + row.principal, 0);

    const content = `
<!DOCTYPE html>
<html>
<head>
  <title>Amortization Schedule - ${scenario.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 30px; }
    h1 { color: #228be6; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th, td { padding: 8px; border: 1px solid #ddd; text-align: right; }
    th { background: #f8f9fa; }
    .summary { margin: 20px 0; padding: 15px; background: #e7f5ff; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Amortization Schedule</h1>
  <h2>${scenario.name}</h2>
  ${client ? `<p><strong>Client:</strong> ${client.name}</p>` : ''}
  <p><strong>Loan Amount:</strong> ${formatCurrency(scenario.amount)}</p>
  <p><strong>Interest Rate:</strong> ${scenario.interestRate?.toFixed(2)}%</p>
  <p><strong>Term:</strong> ${scenario.termYears} years</p>

  <div class="summary">
    <p><strong>Monthly Payment:</strong> ${formatCurrency(scenario.monthlyPayment)}</p>
    <p><strong>Total Principal:</strong> ${formatCurrency(totalPrincipal)}</p>
    <p><strong>Total Interest:</strong> ${formatCurrency(totalInterest)}</p>
    <p><strong>Total Cost:</strong> ${formatCurrency(totalPrincipal + totalInterest)}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Payment</th>
        <th>Principal</th>
        <th>Interest</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr>
        <td><strong>Total</strong></td>
        <td>${formatCurrency(scenario.monthlyPayment ? scenario.monthlyPayment * totalMonths : 0)}</td>
        <td>${formatCurrency(totalPrincipal)}</td>
        <td>${formatCurrency(totalInterest)}</td>
        <td>${formatCurrency(0)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleToggleScenarioSelection = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      }
      return [...prev, scenarioId];
    });
  };

  const handleUpdateDocumentStatus = async (documentId: string, newStatus: ClientDocument['status']) => {
    try {
      const response = await api.put(`/documents/${documentId}`, {
        status: newStatus,
      });

      if (!response.ok) {
        throw new Error('Failed to update document status');
      }

      const updatedDocument = await response.json();
      queryClient.setQueryData(['client-documents', id], (old: ClientDocument[] = []) => old.map(doc => doc.id === documentId ? { ...doc, status: updatedDocument.status } : doc));
      refreshActivities();

      notifications.show({
        title: 'Status Updated',
        message: `Document status changed to ${newStatus.replace('_', ' ')}`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating document status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update document status',
        color: 'red',
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await api.delete(`/documents/${documentId}`);

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      queryClient.setQueryData(['client-documents', id], (old: ClientDocument[] = []) => old.filter(doc => doc.id !== documentId));
      refreshActivities();

      notifications.show({
        title: 'Success',
        message: 'Document deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete document',
        color: 'red',
      });
    }
  };

  const handleDownloadDocument = async (documentId: string, fileName?: string) => {
    try {
      const response = await api.get(`/documents/${documentId}/download`);

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to download document',
        color: 'red',
      });
    }
  };


  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '-';
    return `${value.toFixed(2)}%`;
  };

  const getSelectedScenariosData = () => {
    return loanScenarios.filter(s => selectedScenarios.includes(s.id));
  };

  if (loading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (accessDenied) {
    return (
      <Container size="xl" py="md">
        <Center h={400}>
          <Paper p="xl" withBorder shadow="sm" style={{ textAlign: 'center', maxWidth: 500 }}>
            <IconLock size={64} color="var(--mantine-color-red-6)" style={{ marginBottom: 16 }} aria-hidden="true" />
            <Title order={2} mb="sm">Access Denied</Title>
            <Text c="dimmed" mb="lg">
              You do not have permission to view this client. This client belongs to another user.
            </Text>
            <Button onClick={() => navigate('/clients')}>
              Back to Clients
            </Button>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (error || !client) {
    return (
      <Container size="xl" py="md">
        <Center h={400}>
          <Paper p="xl" withBorder shadow="sm" style={{ textAlign: 'center', maxWidth: 500 }}>
            <IconAlertCircle size={64} color="var(--mantine-color-orange-6)" style={{ marginBottom: 16 }} aria-hidden="true" />
            <Title order={2} mb="sm">Client Not Found</Title>
            <Text c="dimmed" mb="lg">
              {error || 'The requested client could not be found.'}
            </Text>
            <Button onClick={() => navigate('/clients')}>
              Back to Clients
            </Button>
          </Paper>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        separator={<IconChevronRight size={14} color="gray" aria-hidden="true" />}
        mb="md"
      >
        <Anchor onClick={() => safeNavigate('/')} style={{ cursor: 'pointer' }}>
          Dashboard
        </Anchor>
        <Anchor onClick={() => safeNavigate(clientsListUrl)} style={{ cursor: 'pointer' }}>
          Clients
        </Anchor>
        <Text>{client.name}</Text>
      </Breadcrumbs>

      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>{client.name}</Title>
          <Group gap="xs">
            <Select
              value={client.status}
              onChange={handleStatusChange}
              data={statusOptions}
              disabled={updatingStatus}
              size="sm"
              w={160}
              styles={{
                input: {
                  backgroundColor: `var(--mantine-color-${statusColors[client.status] || 'gray'}-light)`,
                  color: `var(--mantine-color-${statusColors[client.status] || 'gray'}-filled)`,
                  fontWeight: 600,
                  border: `1px solid var(--mantine-color-${statusColors[client.status] || 'gray'}-outline)`,
                },
              }}
            />
            {statusUpdateSuccess && (
              <ThemeIcon color="green" size="md" radius="xl" variant="filled">
                <IconCheck size={16} aria-hidden="true" />
              </ThemeIcon>
            )}
          </Group>
        </Group>
        {canWrite && (
          <Group>
            <Button
              leftSection={<IconEdit size={16} aria-hidden="true" />}
              variant="light"
              onClick={() => setEditModalOpen(true)}
            >
              Edit
            </Button>
            <Button
              leftSection={<IconTrash size={16} aria-hidden="true" />}
              variant="light"
              color="red"
              onClick={() => setDeleteModalOpen(true)}
            >
              Delete
            </Button>
          </Group>
        )}
      </Group>

      {/* Client Info Card */}
      <Paper shadow="xs" p="md" withBorder mb="lg">
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <div>
            <Text size="sm" c="dimmed">Email</Text>
            <Text>{client.email}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Phone</Text>
            <Text>{client.phone || '-'}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Created</Text>
            <Text>{new Date(client.createdAt).toLocaleDateString()}</Text>
          </div>
        </SimpleGrid>
        <TagsInput
          label="Tags"
          placeholder="Add tags (press Enter to add)"
          value={client.tags || []}
          onChange={handleTagsChange}
          disabled={updatingTags}
          leftSection={<IconTag size={16} aria-hidden="true" />}
          clearable
        />
      </Paper>

      {/* Two-column layout: Tabs + Activity Sidebar */}
      <Grid gutter="md" align="stretch">
        {/* Left column: Tabs */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<IconUser size={16} aria-hidden="true" />}>
                Overview
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} aria-hidden="true" />}>
                Notes ({notes.length})
              </Tabs.Tab>
              <Tabs.Tab value="documents" leftSection={<IconFiles size={16} aria-hidden="true" />}>
                Documents ({documents.length})
              </Tabs.Tab>
              <Tabs.Tab value="tasks" leftSection={<IconChecklist size={16} aria-hidden="true" />}>
                Tasks ({tasks.length})
              </Tabs.Tab>
              <Tabs.Tab value="loans" leftSection={<IconCalculator size={16} aria-hidden="true" />}>
                Loan Scenarios ({loanScenarios.length})
              </Tabs.Tab>
              <Tabs.Tab value="communications" leftSection={<IconMail size={16} aria-hidden="true" />}>
                Communications ({communications.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <OverviewTab client={client} />
            </Tabs.Panel>

            <Tabs.Panel value="notes" pt="md">
              <NotesTab
                notes={notes}
                sortedNotes={sortedNotes}
                loadingNotes={loadingNotes}
                onAddNote={() => setAddNoteModalOpen(true)}
                onTogglePin={handleTogglePin}
                onEditNote={handleEditNote}
                onDeleteNote={handleDeleteNote}
              />
            </Tabs.Panel>

            <Tabs.Panel value="documents" pt="md">
              <DocumentsTab
                documents={documents}
                loadingDocuments={loadingDocuments}
                onAddDocument={() => setAddDocumentModalOpen(true)}
                onAssignPackage={async () => {
                  await refetchPackages();
                  setAssignPackageModalOpen(true);
                }}
                onRequestDocument={() => setRequestDocumentModalOpen(true)}
                onUpdateStatus={handleUpdateDocumentStatus}
                onDownload={handleDownloadDocument}
                onDelete={handleDeleteDocument}
              />
            </Tabs.Panel>

            <Tabs.Panel value="tasks" pt="md">
              <TasksTab
                tasks={tasks}
                loadingTasks={loadingTasks}
                togglingTaskId={togglingTaskId}
                onAddTask={() => setAddTaskModalOpen(true)}
                onToggleTaskStatus={handleToggleTaskStatus}
                onDeleteTask={handleDeleteTask}
                onSubtasksChange={(taskId, updatedSubtasks) => {
                  queryClient.setQueryData(['client-tasks', id], (old: Task[] = []) => old.map(t =>
                    t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t
                  ));
                }}
              />
            </Tabs.Panel>

            <Tabs.Panel value="loans" pt="md">
              <LoansTab
                loanScenarios={loanScenarios}
                loadingScenarios={loadingScenarios}
                onAddScenario={() => { setEditingScenario(null); setAddScenarioModalOpen(true); }}
                onEditScenario={handleEditScenario}
                onCompare={() => setCompareModalOpen(true)}
                onToggleSelection={handleToggleScenarioSelection}
                onSetPreferred={handleSetPreferred}
                onDelete={handleDeleteScenario}
                onStatusChange={handleScenarioStatusChange}
                onExportPDF={handleExportScenarioPDF}
                onExportAmortization={handleExportAmortizationSchedule}
                selectedScenarios={selectedScenarios}
                formatCurrency={formatCurrency}
                formatPercent={formatPercent}
              />
            </Tabs.Panel>

            <Tabs.Panel value="communications" pt="md">
              <CommunicationsTab
                clientId={id!}
                communications={communications}
                loadingCommunications={loadingCommunications}
                communicationsTypeFilter={communicationsTypeFilter}
                communicationsStatusFilter={communicationsStatusFilter}
                onTypeFilterChange={setCommunicationsTypeFilter}
                onStatusFilterChange={setCommunicationsStatusFilter}
                onPreview={(comm) => {
                  setPreviewCommunication(comm);
                  setPreviewCommunicationOpened(true);
                }}
              />
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>

        {/* Right column: Activity Sidebar (always visible) */}
        <Grid.Col span={{ base: 12, lg: 4 }} style={{ display: 'flex', minHeight: 500 }}>
          <ActivitySidebar
            activities={activities}
            loadingActivities={loadingActivities}
            onLogInteraction={() => setLogInteractionModalOpen(true)}
            onAddNote={() => setAddNoteModalOpen(true)}
            onAddTask={() => setAddTaskModalOpen(true)}
          />
        </Grid.Col>
      </Grid>

      {/* Edit Client Modal */}
      <EditClientModal
        opened={editModalOpen}
        onClose={handleCloseEditModal}
        client={client}
        clientId={id!}
        onUnsavedChange={setEditHasUnsavedChanges}
      />

      {/* Delete Confirmation Modal */}
      <DeleteClientModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        clientId={id!}
        clientName={client.name}
      />
      {/* Add Note Modal */}
      <AddNoteModal
        opened={addNoteModalOpen}
        onClose={() => setAddNoteModalOpen(false)}
        clientId={id!}
        existingNoteTags={existingNoteTags}
      />

      {/* Edit Note Modal */}
      <EditNoteModal
        opened={editNoteModalOpen}
        onClose={() => { setEditNoteModalOpen(false); setEditingNote(null); }}
        clientId={id!}
        note={editingNote}
        existingNoteTags={existingNoteTags}
      />

      {/* Add Document Modal */}
      <AddDocumentModal
        opened={addDocumentModalOpen}
        onClose={() => setAddDocumentModalOpen(false)}
        clientId={id!}
      />

      {/* Assign Package Modal */}
      <AssignPackageModal
        opened={assignPackageModalOpen}
        onClose={() => setAssignPackageModalOpen(false)}
        clientId={id!}
      />

      {/* Request Document Modal */}
      <RequestDocumentModal
        opened={requestDocumentModalOpen}
        onClose={() => setRequestDocumentModalOpen(false)}
        clientId={id!}
      />

      {/* Delete Document Confirmation Modal */}
      <DeleteDocumentModal
        opened={deleteDocumentModalOpen}
        onClose={() => { setDeleteDocumentModalOpen(false); setDocumentToDelete(null); }}
        clientId={id!}
        document={documentToDelete}
      />

      {/* Delete Loan Scenario Confirmation Modal */}
      <DeleteScenarioModal
        opened={deleteScenarioModalOpen}
        onClose={() => { setDeleteScenarioModalOpen(false); setScenarioToDelete(null); }}
        clientId={id!}
        scenario={scenarioToDelete}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        opened={addTaskModalOpen}
        onClose={() => setAddTaskModalOpen(false)}
        clientId={id!}
      />

      {/* Add/Edit Loan Scenario Modal */}
      <AddScenarioModal
        opened={addScenarioModalOpen}
        onClose={() => { setAddScenarioModalOpen(false); setEditingScenario(null); }}
        clientId={id!}
        editingScenario={editingScenario}
      />

      {/* Compare Loan Scenarios Modal */}
      <CompareModal
        opened={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        scenarios={getSelectedScenariosData()}
      />

      {/* Communication Preview Modal */}
      <CommunicationPreviewModal
        opened={previewCommunicationOpened}
        onClose={() => setPreviewCommunicationOpened(false)}
        communication={previewCommunication}
        clientId={id!}
      />

      {/* Log Interaction Modal */}
      <LogInteractionModal
        opened={logInteractionModalOpen}
        onClose={() => setLogInteractionModalOpen(false)}
        clientId={id!}
      />

      {/* Unsaved Changes Warning Modal */}
      <UnsavedChangesModal
        opened={unsavedChangesModalOpen}
        onStay={handleStayOnPage}
        onLeave={handleLeavePage}
      />

    </Container>
  );
}
