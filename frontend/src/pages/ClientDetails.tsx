import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
  Modal,
  TextInput,
  Select,
  TagsInput,
  Textarea,
  ActionIcon,
  Checkbox,
  NumberInput,
  Grid,
  Divider,
  ThemeIcon,
  Table,
  FileInput,
  Progress,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconUser,
  IconNotes,
  IconFiles,
  IconChecklist,
  IconCalculator,
  IconTimeline,
  IconAlertCircle,
  IconAlertTriangle,
  IconLock,
  IconHome,
  IconChevronRight,
  IconEdit,
  IconTrash,
  IconTag,
  IconPlus,
  IconPin,
  IconPinnedOff,
  IconStar,
  IconStarFilled,
  IconCurrencyDollar,
  IconPercentage,
  IconCalendar,
  IconScale,
  IconCheck,
  IconDownload,
  IconUpload,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';
import { canWriteClients } from '../utils/roleUtils';

// Helper function to format relative time (e.g., "just now", "5 minutes ago", "2 hours ago")
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }

  // For older dates, show the full date
  return date.toLocaleDateString();
};

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  notes: any[];
  tasks: any[];
  documents: any[];
  loanScenarios: any[];
}
interface Note {
  id: string;
  clientId: string;
  text: string;
  tags: string[];
  isPinned: boolean;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt?: string;
}

interface Task {
  id: string;
  clientId: string;
  text: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  completedAt?: string;
  assignedTo?: { id: string; name: string };
  createdAt: string;
  updatedAt?: string;
}

interface LoanScenario {
  id: string;
  clientId: string;
  name: string;
  loanType: 'PURCHASE' | 'REFINANCE';
  amount: number;
  interestRate: number;
  termYears: number;
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
  createdAt: string;
  updatedAt?: string;
}

interface Document {
  id: string;
  clientId: string;
  name: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  status: 'REQUIRED' | 'REQUESTED' | 'UPLOADED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  category: 'INCOME' | 'EMPLOYMENT' | 'ASSETS' | 'PROPERTY' | 'INSURANCE' | 'CREDIT' | 'OTHER';
  dueDate?: string;
  expiresAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Activity {
  id: string;
  clientId: string;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  user: { id: string; name: string };
  createdAt: string;
}

const activityTypeLabels: Record<string, string> = {
  NOTE_ADDED: 'Note Added',
  NOTE_UPDATED: 'Note Updated',
  NOTE_DELETED: 'Note Deleted',
  TASK_CREATED: 'Task Created',
  TASK_COMPLETED: 'Task Completed',
  TASK_DELETED: 'Task Deleted',
  DOCUMENT_UPLOADED: 'Document Uploaded',
  DOCUMENT_STATUS_CHANGED: 'Document Status Changed',
  DOCUMENT_DELETED: 'Document Deleted',
  STATUS_CHANGED: 'Status Changed',
  CLIENT_CREATED: 'Client Created',
  CLIENT_UPDATED: 'Client Updated',
  LOAN_SCENARIO_CREATED: 'Loan Scenario Created',
  LOAN_SCENARIO_DELETED: 'Loan Scenario Deleted',
};

const activityTypeColors: Record<string, string> = {
  NOTE_ADDED: 'blue',
  NOTE_UPDATED: 'cyan',
  NOTE_DELETED: 'gray',
  TASK_CREATED: 'green',
  TASK_COMPLETED: 'teal',
  TASK_DELETED: 'gray',
  DOCUMENT_UPLOADED: 'violet',
  DOCUMENT_STATUS_CHANGED: 'orange',
  DOCUMENT_DELETED: 'gray',
  STATUS_CHANGED: 'yellow',
  CLIENT_CREATED: 'green',
  CLIENT_UPDATED: 'blue',
  LOAN_SCENARIO_CREATED: 'pink',
  LOAN_SCENARIO_DELETED: 'gray',
};

const documentStatusColors: Record<string, string> = {
  REQUIRED: 'gray',
  REQUESTED: 'yellow',
  UPLOADED: 'blue',
  UNDER_REVIEW: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
  EXPIRED: 'gray',
};

// Helper function to check if a document is expired or expiring soon
const isDocumentExpired = (doc: Document): boolean => {
  if (!doc.expiresAt) return false;
  const expiresAt = new Date(doc.expiresAt);
  const today = new Date();
  expiresAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return expiresAt < today;
};

const isDocumentExpiringSoon = (doc: Document): boolean => {
  if (!doc.expiresAt) return false;
  const expiresAt = new Date(doc.expiresAt);
  const today = new Date();
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + 30); // 30 days warning
  expiresAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  warningDate.setHours(0, 0, 0, 0);
  return expiresAt >= today && expiresAt <= warningDate;
};

const documentCategoryLabels: Record<string, string> = {
  INCOME: 'Income',
  EMPLOYMENT: 'Employment',
  ASSETS: 'Assets',
  PROPERTY: 'Property',
  INSURANCE: 'Insurance',
  CREDIT: 'Credit',
  OTHER: 'Other',
};

const statusColors: Record<string, string> = {
  LEAD: 'gray',
  PRE_QUALIFIED: 'blue',
  ACTIVE: 'green',
  PROCESSING: 'yellow',
  UNDERWRITING: 'orange',
  CLEAR_TO_CLOSE: 'lime',
  CLOSED: 'green.9',
  DENIED: 'red',
  INACTIVE: 'gray',
};

const API_URL = 'http://localhost:3000/api';

// Define valid tab values
const validTabs = ['overview', 'notes', 'documents', 'tasks', 'loans', 'activity'];

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, user } = useAuthStore();
  const canWrite = canWriteClients(user?.role);

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
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [editNoteModalOpen, setEditNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNoteTags, setEditNoteTags] = useState<string[]>([]);
  const [noteTemplates, setNoteTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [existingNoteTags, setExistingNoteTags] = useState<string[]>([]);

  // Task state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string | null>(null);
  const [newTaskForm, setNewTaskForm] = useState({
    text: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    dueDate: null as Date | null,
  });

  // Loan scenario state
  const [loanScenarios, setLoanScenarios] = useState<LoanScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [addScenarioModalOpen, setAddScenarioModalOpen] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState<{
    monthlyPayment?: number;
    totalMonthlyPayment?: number;
    totalInterest?: number;
    loanToValue?: number;
  } | null>(null);
  const [newScenarioForm, setNewScenarioForm] = useState({
    name: '',
    loanType: 'PURCHASE' as 'PURCHASE' | 'REFINANCE',
    amount: 400000,
    interestRate: 6.5,
    termYears: 30,
    downPayment: 80000,
    propertyValue: 500000,
    propertyTaxes: 0,
    homeInsurance: 0,
    hoaFees: 0,
  });
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [scenarioFormErrors, setScenarioFormErrors] = useState<{ name?: string; amount?: string; interestRate?: string; termYears?: string }>({});

  // Document state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [addDocumentModalOpen, setAddDocumentModalOpen] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newDocumentForm, setNewDocumentForm] = useState({
    name: '',
    fileName: '',
    category: 'OTHER' as Document['category'],
    status: 'UPLOADED' as Document['status'],
    expiresAt: null as Date | null,
    notes: '',
  });

  // Activity state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const statusOptions = [
    { value: 'LEAD', label: 'Lead' },
    { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'UNDERWRITING', label: 'Underwriting' },
    { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'DENIED', label: 'Denied' },
  ];

  useEffect(() => {
    if (id) {
      // Reset state immediately when navigating to a new client to prevent stale data flash
      setClient(null);
      setNotes([]);
      setTasks([]);
      setLoanScenarios([]);
      setDocuments([]);
      setActivities([]);
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      fetchClient();
      fetchNotes();
      fetchTasks();
      fetchLoanScenarios();
      fetchDocuments();
      fetchActivities();
    }
  }, [id]);

  // Track pending navigation path when warning dialog is shown
  const pendingNavigation = useRef<(() => void) | null>(null);

  // Check if edit form has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!editModalOpen || !client) return false;
    return (
      editForm.name !== client.name ||
      editForm.email !== client.email ||
      editForm.phone !== (client.phone || '') ||
      editForm.status !== client.status
    );
  }, [editModalOpen, client, editForm]);

  // Handle browser back/forward and tab close with beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Custom navigation function that checks for unsaved changes
  const safeNavigate = useCallback((path: string | number) => {
    if (hasUnsavedChanges) {
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
  }, [hasUnsavedChanges, navigate]);

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
    if (hasUnsavedChanges) {
      // Set a flag to close modal after confirming
      pendingNavigation.current = () => {
        // No navigation needed, just close the modal
      };
      setUnsavedChangesModalOpen(true);
    } else {
      setEditModalOpen(false);
    }
  }, [hasUnsavedChanges]);

  const fetchActivities = async () => {
    if (!id) return;
    setLoadingActivities(true);
    try {
      const response = await fetch(`${API_URL}/activities?client_id=${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchClient = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (response.status === 404) {
        setError('Client not found');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch client');
      }

      const data = await response.json();
      setClient(data);
    } catch (error) {
      console.error('Error fetching client:', error);
      setError('Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = () => {
    if (client) {
      setEditForm({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        status: client.status,
      });
      setEditModalOpen(true);
    }
  };

  const handleSaveClient = async () => {
    if (!editForm.name || !editForm.email) {
      notifications.show({
        title: 'Validation Error',
        message: 'Name and email are required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      const updatedClient = await response.json();
      setClient(updatedClient);
      setEditModalOpen(false);

      notifications.show({
        title: 'Success',
        message: 'Client updated successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating client:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update client',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
      }

      notifications.show({
        title: 'Success',
        message: 'Client deleted successfully',
        color: 'green',
      });

      // Navigate to clients list after successful deletion
      navigate('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete client',
        color: 'red',
      });
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus || !client || newStatus === client.status) return;

    const oldStatus = client.status;
    setUpdatingStatus(true);
    setStatusUpdateSuccess(false);

    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: client.name,
          email: client.email,
          phone: client.phone,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const updatedClient = await response.json();

      // Show inline success indicator - set before updating client to ensure it renders
      setStatusUpdateSuccess(true);
      setClient(updatedClient);

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
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: client.name,
          email: client.email,
          phone: client.phone,
          status: client.status,
          tags: newTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update tags');
      }

      const updatedClient = await response.json();
      setClient(updatedClient);

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

  const fetchNotes = async () => {
    if (!id) return;
    setLoadingNotes(true);
    try {
      const response = await fetch(`${API_URL}/notes?client_id=${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
        // Extract unique tags from all notes for autocomplete
        const allTags = data.flatMap((note: Note) => note.tags || []);
        const uniqueTags = Array.from(new Set(allTags));
        setExistingNoteTags(uniqueTags);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchNoteTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch(`${API_URL}/notes/templates/list`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNoteTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching note templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Note text is required',
        color: 'red',
      });
      return;
    }

    setSavingNote(true);
    try {
      const response = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId: id,
          text: newNoteText,
          tags: newNoteTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const createdNote = await response.json();
      setNotes([createdNote, ...notes]);
      // Update existing tags list
      const newTagsToAdd = newNoteTags.filter(tag => !existingNoteTags.includes(tag));
      if (newTagsToAdd.length > 0) {
        setExistingNoteTags([...existingNoteTags, ...newTagsToAdd]);
      }
      setAddNoteModalOpen(false);
      setNewNoteText('');
      setNewNoteTags([]);

      // Refresh activities to show the new note activity
      fetchActivities();

      notifications.show({
        title: 'Success',
        message: 'Note created successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create note',
        color: 'red',
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setEditNoteText(note.text);
    setEditNoteTags(note.tags || []);
    setEditNoteModalOpen(true);
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !editNoteText.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Note text is required',
        color: 'red',
      });
      return;
    }

    setSavingNote(true);
    try {
      const response = await fetch(`${API_URL}/notes/${editingNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          text: editNoteText,
          tags: editNoteTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const updatedNote = await response.json();
      setNotes(notes.map(n => n.id === updatedNote.id ? { ...n, text: updatedNote.text, tags: updatedNote.tags, updatedAt: updatedNote.updatedAt } : n));
      // Update existing tags list
      const newTagsToAdd = editNoteTags.filter(tag => !existingNoteTags.includes(tag));
      if (newTagsToAdd.length > 0) {
        setExistingNoteTags([...existingNoteTags, ...newTagsToAdd]);
      }
      setEditNoteModalOpen(false);
      setEditingNote(null);
      setEditNoteText('');
      setEditNoteTags([]);

      notifications.show({
        title: 'Success',
        message: 'Note updated successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update note',
        color: 'red',
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      setNotes(notes.filter(n => n.id !== noteId));

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
      const response = await fetch(`${API_URL}/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          isPinned: newPinnedState,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const updatedNote = await response.json();
      setNotes(notes.map(n => n.id === note.id ? { ...n, isPinned: updatedNote.isPinned } : n));

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

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Task functions
  const fetchTasks = async () => {
    if (!id) return;
    setLoadingTasks(true);
    try {
      const response = await fetch(`${API_URL}/tasks?client_id=${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskForm.text.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Task text is required',
        color: 'red',
      });
      return;
    }

    setSavingTask(true);
    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId: id,
          text: newTaskForm.text,
          description: newTaskForm.description || undefined,
          priority: newTaskForm.priority,
          dueDate: newTaskForm.dueDate ? newTaskForm.dueDate.toISOString() : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const createdTask = await response.json();
      setTasks([createdTask, ...tasks]);
      setAddTaskModalOpen(false);
      setNewTaskForm({
        text: '',
        description: '',
        priority: 'MEDIUM',
        dueDate: null,
      });

      notifications.show({
        title: 'Success',
        message: 'Task created successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating task:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create task',
        color: 'red',
      });
    } finally {
      setSavingTask(false);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    // Prevent rapid clicks - ignore if already toggling this task
    if (togglingTaskId === task.id) {
      return;
    }

    const newStatus = task.status === 'COMPLETE' ? 'TODO' : 'COMPLETE';
    setTogglingTaskId(task.id);

    try {
      const response = await fetch(`${API_URL}/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const updatedTask = await response.json();
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: updatedTask.status, completedAt: updatedTask.completedAt } : t));

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
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      setTasks(tasks.filter(t => t.id !== taskId));

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

  const priorityColors: Record<string, string> = {
    LOW: 'blue',
    MEDIUM: 'yellow',
    HIGH: 'red',
  };

  // Helper function to check if a task is overdue
  const isTaskOverdue = (task: Task): boolean => {
    if (!task.dueDate || task.status === 'COMPLETE') return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    // Set both dates to midnight for accurate comparison
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Loan Scenario functions
  const fetchLoanScenarios = async () => {
    if (!id) return;
    setLoadingScenarios(true);
    try {
      const response = await fetch(`${API_URL}/loan-scenarios?client_id=${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setLoanScenarios(data);
      }
    } catch (error) {
      console.error('Error fetching loan scenarios:', error);
    } finally {
      setLoadingScenarios(false);
    }
  };

  const handleCalculateScenario = async () => {
    // Validate required fields for calculation
    const errors: { name?: string; amount?: string; interestRate?: string; termYears?: string } = {};

    if (!newScenarioForm.name.trim()) {
      errors.name = 'Scenario name is required';
    }

    if (newScenarioForm.amount <= 0) {
      errors.amount = 'Loan amount must be greater than 0';
    }

    if (newScenarioForm.interestRate <= 0) {
      errors.interestRate = 'Interest rate must be greater than 0%';
    } else if (newScenarioForm.interestRate > 30) {
      errors.interestRate = 'Interest rate cannot exceed 30%';
    }

    if (!newScenarioForm.termYears || newScenarioForm.termYears <= 0) {
      errors.termYears = 'Term is required and must be greater than 0';
    } else if (newScenarioForm.termYears > 40) {
      errors.termYears = 'Term cannot exceed 40 years';
    }

    if (Object.keys(errors).length > 0) {
      setScenarioFormErrors(errors);
      return;
    }

    // Clear errors
    setScenarioFormErrors({});

    try {
      const response = await fetch(`${API_URL}/loan-scenarios/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: newScenarioForm.amount,
          interestRate: newScenarioForm.interestRate,
          termYears: newScenarioForm.termYears,
          downPayment: newScenarioForm.downPayment,
          propertyValue: newScenarioForm.propertyValue,
          propertyTaxes: newScenarioForm.propertyTaxes,
          homeInsurance: newScenarioForm.homeInsurance,
          hoaFees: newScenarioForm.hoaFees,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate');
      }

      const result = await response.json();
      setCalculatedValues(result);

      notifications.show({
        title: 'Calculated',
        message: `Monthly Payment: $${result.monthlyPayment?.toLocaleString()}`,
        color: 'blue',
      });
    } catch (error) {
      console.error('Error calculating scenario:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to calculate loan scenario',
        color: 'red',
      });
    }
  };

  const handleCreateScenario = async () => {
    // Validate required fields
    const errors: { name?: string; amount?: string; interestRate?: string; termYears?: string } = {};

    if (!newScenarioForm.name.trim()) {
      errors.name = 'Scenario name is required';
    }

    // Validate loan amount - must be positive
    if (newScenarioForm.amount <= 0) {
      errors.amount = 'Loan amount must be greater than 0';
    }

    // Validate interest rate - must be between 0 and 30%
    if (newScenarioForm.interestRate <= 0) {
      errors.interestRate = 'Interest rate must be greater than 0%';
    } else if (newScenarioForm.interestRate > 30) {
      errors.interestRate = 'Interest rate cannot exceed 30%';
    }

    // Validate term years
    if (!newScenarioForm.termYears || newScenarioForm.termYears <= 0) {
      errors.termYears = 'Term is required and must be greater than 0';
    } else if (newScenarioForm.termYears > 40) {
      errors.termYears = 'Term cannot exceed 40 years';
    }

    if (Object.keys(errors).length > 0) {
      setScenarioFormErrors(errors);
      return;
    }

    // Clear errors
    setScenarioFormErrors({});
    setSavingScenario(true);
    try {
      const response = await fetch(`${API_URL}/loan-scenarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId: id,
          ...newScenarioForm,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create loan scenario');
      }

      const createdScenario = await response.json();
      setLoanScenarios([createdScenario, ...loanScenarios]);
      setAddScenarioModalOpen(false);
      setNewScenarioForm({
        name: '',
        loanType: 'PURCHASE',
        amount: 400000,
        interestRate: 6.5,
        termYears: 30,
        downPayment: 80000,
        propertyValue: 500000,
        propertyTaxes: 0,
        homeInsurance: 0,
        hoaFees: 0,
      });
      setCalculatedValues(null);

      notifications.show({
        title: 'Success',
        message: 'Loan scenario created successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating loan scenario:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create loan scenario',
        color: 'red',
      });
    } finally {
      setSavingScenario(false);
    }
  };

  const handleSetPreferred = async (scenarioId: string) => {
    try {
      const response = await fetch(`${API_URL}/loan-scenarios/${scenarioId}/preferred`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to set preferred');
      }

      // Update local state
      setLoanScenarios(loanScenarios.map(s => ({
        ...s,
        isPreferred: s.id === scenarioId,
      })));

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
    if (!confirm('Are you sure you want to delete this loan scenario?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/loan-scenarios/${scenarioId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete loan scenario');
      }

      setLoanScenarios(loanScenarios.filter(s => s.id !== scenarioId));

      notifications.show({
        title: 'Success',
        message: 'Loan scenario deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting loan scenario:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete loan scenario',
        color: 'red',
      });
    }
  };

  // Export loan scenario to PDF
  const handleExportScenarioPDF = (scenario: LoanScenario) => {
    // Generate PDF content as HTML
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
      <label>Total Monthly (PITI)</label>
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
    <h2 style="margin-top: 0;">Total Cost Summary</h2>
    <p><strong>Total Interest Over ${scenario.termYears} Years:</strong> ${formatCurrency(scenario.totalInterest)}</p>
    <p><strong>Total Cost of Loan:</strong> ${formatCurrency((scenario.amount || 0) + (scenario.totalInterest || 0))}</p>
  </div>

  <div class="footer">
    <p>This is an estimate based on the information provided. Actual terms may vary.</p>
    <p>Generated by MLO Dashboard</p>
  </div>
</body>
</html>
    `;

    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      // Trigger print dialog after a short delay to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    notifications.show({
      title: 'PDF Export',
      message: 'Use your browser\'s print dialog to save as PDF',
      color: 'blue',
    });
  };

  // Generate amortization schedule data
  const generateAmortizationSchedule = (scenario: LoanScenario) => {
    const schedule = [];
    const principal = scenario.amount;
    const monthlyRate = (scenario.interestRate / 100) / 12;
    const totalMonths = scenario.termYears * 12;
    const monthlyPayment = scenario.monthlyPayment || 0;

    let balance = principal;

    for (let month = 1; month <= totalMonths; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance = Math.max(0, balance - principalPayment);

      schedule.push({
        month,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: balance,
      });
    }

    return schedule;
  };

  // Export amortization schedule to PDF/HTML
  const handleExportAmortizationSchedule = (scenario: LoanScenario) => {
    const schedule = generateAmortizationSchedule(scenario);
    const totalMonths = scenario.termYears * 12;
    const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
    const totalPrincipal = schedule.reduce((sum, row) => sum + row.principal, 0);

    // Generate schedule rows HTML
    const scheduleRows = schedule.map(row => `
      <tr>
        <td>${row.month}</td>
        <td>${formatCurrency(row.payment)}</td>
        <td>${formatCurrency(row.principal)}</td>
        <td>${formatCurrency(row.interest)}</td>
        <td>${formatCurrency(row.balance)}</td>
      </tr>
    `).join('');

    const content = `
<!DOCTYPE html>
<html>
<head>
  <title>Amortization Schedule - ${scenario.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; font-size: 11px; }
    h1 { color: #228be6; border-bottom: 2px solid #228be6; padding-bottom: 10px; font-size: 20px; }
    h2 { color: #333; margin-top: 20px; font-size: 16px; }
    .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .summary-item label { display: block; color: #666; font-size: 10px; margin-bottom: 3px; }
    .summary-item value { display: block; font-size: 14px; font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #228be6; color: white; padding: 8px 6px; text-align: right; font-size: 10px; }
    th:first-child { text-align: center; }
    td { padding: 6px; border-bottom: 1px solid #e9ecef; text-align: right; }
    td:first-child { text-align: center; }
    tr:nth-child(even) { background: #f8f9fa; }
    tr:hover { background: #e7f5ff; }
    .totals { background: #228be6; color: white; font-weight: bold; }
    .totals td { border-bottom: none; }
    .footer { margin-top: 20px; color: #666; font-size: 10px; text-align: center; }
    @media print {
      body { padding: 10px; font-size: 9px; }
      h1 { font-size: 16px; }
      th, td { padding: 4px 3px; }
    }
  </style>
</head>
<body>
  <h1>Amortization Schedule</h1>
  <h2>${scenario.name}</h2>
  ${client ? `<p><strong>Client:</strong> ${client.name}</p>` : ''}
  <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>

  <div class="summary">
    <h2 style="margin-top: 0;">Loan Summary</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <label>Loan Amount</label>
        <value>${formatCurrency(scenario.amount)}</value>
      </div>
      <div class="summary-item">
        <label>Interest Rate</label>
        <value>${scenario.interestRate?.toFixed(3)}%</value>
      </div>
      <div class="summary-item">
        <label>Loan Term</label>
        <value>${scenario.termYears} years (${totalMonths} months)</value>
      </div>
      <div class="summary-item">
        <label>Monthly Payment</label>
        <value>${formatCurrency(scenario.monthlyPayment)}</value>
      </div>
      <div class="summary-item">
        <label>Total Principal</label>
        <value>${formatCurrency(totalPrincipal)}</value>
      </div>
      <div class="summary-item">
        <label>Total Interest</label>
        <value>${formatCurrency(totalInterest)}</value>
      </div>
      <div class="summary-item">
        <label>Total Cost of Loan</label>
        <value>${formatCurrency(totalPrincipal + totalInterest)}</value>
      </div>
      <div class="summary-item">
        <label>LTV Ratio</label>
        <value>${scenario.loanToValue ? scenario.loanToValue.toFixed(2) + '%' : '-'}</value>
      </div>
    </div>
  </div>

  <h2>Monthly Payment Schedule</h2>
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
      ${scheduleRows}
      <tr class="totals">
        <td>TOTAL</td>
        <td>${formatCurrency(scenario.monthlyPayment ? scenario.monthlyPayment * totalMonths : 0)}</td>
        <td>${formatCurrency(totalPrincipal)}</td>
        <td>${formatCurrency(totalInterest)}</td>
        <td>$0.00</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>This amortization schedule is an estimate based on the information provided. Actual payments may vary.</p>
    <p>Generated by MLO Dashboard</p>
  </div>
</body>
</html>
    `;

    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      // Trigger print dialog after a short delay to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    notifications.show({
      title: 'Amortization Schedule Export',
      message: 'Use your browser\'s print dialog to save as PDF',
      color: 'blue',
    });
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '-';
    return `${value.toFixed(2)}%`;
  };

  const handleToggleScenarioSelection = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      }
      return [...prev, scenarioId];
    });
  };

  const getSelectedScenariosData = () => {
    return loanScenarios.filter(s => selectedScenarios.includes(s.id));
  };

  // Document functions
  const fetchDocuments = async () => {
    if (!id) return;
    setLoadingDocuments(true);
    try {
      const response = await fetch(`${API_URL}/documents?client_id=${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocumentForm.name.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Document name is required',
        color: 'red',
      });
      return;
    }

    // If no file is selected, require fileName for metadata-only upload
    if (!selectedFile && !newDocumentForm.fileName.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Either select a file or enter a file name',
        color: 'red',
      });
      return;
    }

    setSavingDocument(true);

    // If a file is selected, use XHR for progress tracking
    if (selectedFile) {
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', id || '');
      formData.append('name', newDocumentForm.name);
      formData.append('category', newDocumentForm.category);
      formData.append('status', newDocumentForm.status);
      if (newDocumentForm.notes) {
        formData.append('notes', newDocumentForm.notes);
      }

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const newDocument = JSON.parse(xhr.responseText);
            setDocuments([newDocument, ...documents]);
            setAddDocumentModalOpen(false);
            setNewDocumentForm({
              name: '',
              fileName: '',
              category: 'OTHER',
              status: 'UPLOADED',
              expiresAt: null,
              notes: '',
            });
            setSelectedFile(null);
            setUploadProgress(null);

            notifications.show({
              title: 'Success',
              message: 'Document uploaded successfully',
              color: 'green',
            });
          } catch {
            notifications.show({
              title: 'Error',
              message: 'Failed to process upload response',
              color: 'red',
            });
          }
        } else {
          notifications.show({
            title: 'Error',
            message: 'Failed to upload document',
            color: 'red',
          });
        }
        setSavingDocument(false);
        setUploadProgress(null);
      });

      xhr.addEventListener('error', () => {
        notifications.show({
          title: 'Error',
          message: 'Upload failed. Please check your connection.',
          color: 'red',
        });
        setSavingDocument(false);
        setUploadProgress(null);
      });

      xhr.open('POST', `${API_URL}/documents/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.send(formData);
    } else {
      // Metadata-only upload (no file)
      try {
        const response = await fetch(`${API_URL}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            clientId: id,
            name: newDocumentForm.name,
            fileName: newDocumentForm.fileName,
            category: newDocumentForm.category,
            status: newDocumentForm.status,
            expiresAt: newDocumentForm.expiresAt ? newDocumentForm.expiresAt.toISOString() : undefined,
            notes: newDocumentForm.notes || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create document');
        }

        const newDocument = await response.json();
        setDocuments([newDocument, ...documents]);
        setAddDocumentModalOpen(false);
        setNewDocumentForm({
          name: '',
          fileName: '',
          category: 'OTHER',
          status: 'UPLOADED',
          expiresAt: null,
          notes: '',
        });

        notifications.show({
          title: 'Success',
          message: 'Document created successfully',
          color: 'green',
        });
      } catch (error) {
        console.error('Error creating document:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to create document',
          color: 'red',
        });
      } finally {
        setSavingDocument(false);
      }
    }
  };

  const handleUpdateDocumentStatus = async (documentId: string, newStatus: Document['status']) => {
    try {
      const response = await fetch(`${API_URL}/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update document status');
      }

      setDocuments(documents.map(doc =>
        doc.id === documentId ? { ...doc, status: newStatus } : doc
      ));

      notifications.show({
        title: 'Success',
        message: `Document status updated to ${newStatus.replace('_', ' ')}`,
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
      const response = await fetch(`${API_URL}/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments(documents.filter(d => d.id !== documentId));

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
            <IconLock size={64} color="var(--mantine-color-red-6)" style={{ marginBottom: 16 }} />
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
            <IconAlertCircle size={64} color="var(--mantine-color-orange-6)" style={{ marginBottom: 16 }} />
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
        separator={<IconChevronRight size={14} color="gray" />}
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
                <IconCheck size={16} />
              </ThemeIcon>
            )}
          </Group>
        </Group>
        {canWrite && (
          <Group>
            <Button
              leftSection={<IconEdit size={16} />}
              variant="light"
              onClick={openEditModal}
            >
              Edit
            </Button>
            <Button
              leftSection={<IconTrash size={16} />}
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
          leftSection={<IconTag size={16} />}
          clearable
        />
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconUser size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
            Notes ({notes.length})
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFiles size={16} />}>
            Documents ({documents.length})
          </Tabs.Tab>
          <Tabs.Tab value="tasks" leftSection={<IconChecklist size={16} />}>
            Tasks ({tasks.length})
          </Tabs.Tab>
          <Tabs.Tab value="loans" leftSection={<IconCalculator size={16} />}>
            Loan Scenarios ({loanScenarios.length})
          </Tabs.Tab>
          <Tabs.Tab value="activity" leftSection={<IconTimeline size={16} />}>
            Activity
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Card withBorder>
              <Title order={4} mb="sm">Recent Notes</Title>
              {client.notes?.length > 0 ? (
                <Stack gap="xs">
                  {client.notes.map((note: any) => (
                    <Paper key={note.id} p="sm" withBorder>
                      <Text size="sm" lineClamp={2}>{note.text}</Text>
                      <Text size="xs" c="dimmed" mt="xs">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Stack align="center" gap="xs" py="md">
                  <ThemeIcon size={40} radius="xl" variant="light" color="blue" style={{ opacity: 0.6 }}>
                    <IconNotes size={20} stroke={1.5} />
                  </ThemeIcon>
                  <Text c="dimmed" size="sm" ta="center">No notes yet</Text>
                  <Text c="dimmed" size="xs" ta="center" maw={200}>
                    Add notes to track important information
                  </Text>
                </Stack>
              )}
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">Recent Tasks</Title>
              {client.tasks?.length > 0 ? (
                <Stack gap="xs">
                  {client.tasks.map((task: any) => (
                    <Paper key={task.id} p="sm" withBorder>
                      <Group justify="space-between">
                        <Text size="sm">{task.text}</Text>
                        <Badge size="sm" color={task.status === 'COMPLETE' ? 'green' : 'blue'}>
                          {task.status}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Stack align="center" gap="xs" py="md">
                  <ThemeIcon size={40} radius="xl" variant="light" color="orange" style={{ opacity: 0.6 }}>
                    <IconChecklist size={20} stroke={1.5} />
                  </ThemeIcon>
                  <Text c="dimmed" size="sm" ta="center">No tasks yet</Text>
                  <Text c="dimmed" size="xs" ta="center" maw={200}>
                    Create tasks to track action items
                  </Text>
                </Stack>
              )}
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="notes" pt="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Notes</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                fetchNoteTemplates();
                setAddNoteModalOpen(true);
              }}
            >
              Add Note
            </Button>
          </Group>
          {loadingNotes ? (
            <Text c="dimmed">Loading notes...</Text>
          ) : notes.length === 0 ? (
            <EmptyState
              iconType="notes"
              title="No notes yet"
              description="Add notes to keep track of important information about this client."
              ctaLabel="Add Note"
              onCtaClick={() => {
                fetchNoteTemplates();
                setAddNoteModalOpen(true);
              }}
            />
          ) : (
            <Stack gap="md">
              {sortedNotes.map((note) => (
                <Paper key={note.id} p="md" withBorder style={note.isPinned ? { borderColor: 'var(--mantine-color-blue-5)', borderWidth: 2 } : {}}>
                  <Group justify="space-between" align="flex-start">
                    <Group gap="xs" style={{ flex: 1 }}>
                      {note.isPinned && <IconPin size={16} color="var(--mantine-color-blue-6)" />}
                      <Text style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{note.text}</Text>
                    </Group>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color={note.isPinned ? 'blue' : 'gray'}
                        onClick={() => handleTogglePin(note)}
                        title={note.isPinned ? 'Unpin note' : 'Pin to top'}
                        aria-label={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                      >
                        {note.isPinned ? <IconPinnedOff size={16} /> : <IconPin size={16} />}
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="blue" onClick={() => handleEditNote(note)} aria-label="Edit note">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteNote(note.id)} aria-label="Delete note">
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <Group justify="space-between" mt="sm">
                    <Text size="xs" c="dimmed">
                      By {note.createdBy?.name || 'Unknown'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(note.createdAt).toLocaleString()}
                    </Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="documents" pt="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Documents</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setAddDocumentModalOpen(true)}
            >
              Add Document
            </Button>
          </Group>
          {loadingDocuments ? (
            <Text c="dimmed">Loading documents...</Text>
          ) : documents.length === 0 ? (
            <EmptyState
              iconType="documents"
              title="No documents yet"
              description="Upload and manage documents for this client's loan application."
              ctaLabel="Add Document"
              onCtaClick={() => setAddDocumentModalOpen(true)}
            />
          ) : (
            <Stack gap="md">
              {documents.map((doc) => {
                const expired = isDocumentExpired(doc);
                const expiringSoon = isDocumentExpiringSoon(doc);
                return (
                  <Paper
                    key={doc.id}
                    p="md"
                    withBorder
                    style={{
                      ...(expired ? { borderColor: 'var(--mantine-color-red-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-red-0)' } : {}),
                      ...(expiringSoon && !expired ? { borderColor: 'var(--mantine-color-yellow-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-yellow-0)' } : {}),
                    }}
                  >
                    <Group justify="space-between" align="flex-start">
                      <div style={{ flex: 1 }}>
                        <Group gap="sm" mb="xs">
                          <IconFiles size={20} />
                          <Text fw={500}>{doc.name}</Text>
                          {expired && (
                            <Badge color="red" variant="filled" size="sm">EXPIRED</Badge>
                          )}
                          {expiringSoon && !expired && (
                            <Badge color="yellow" variant="filled" size="sm" leftSection={<IconAlertTriangle size={12} />}>
                              EXPIRING SOON
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" c="dimmed">{doc.fileName}</Text>
                        {doc.notes && (
                          <Text size="sm" c="dimmed" mt="xs">{doc.notes}</Text>
                        )}
                      </div>
                      <Group gap="xs">
                        <Badge color={documentCategoryLabels[doc.category] ? 'blue' : 'gray'} variant="light" size="sm">
                          {documentCategoryLabels[doc.category] || doc.category}
                        </Badge>
                        <Select
                          size="xs"
                          value={doc.status}
                          data={[
                            { value: 'REQUIRED', label: 'Required' },
                            { value: 'REQUESTED', label: 'Requested' },
                            { value: 'UPLOADED', label: 'Uploaded' },
                            { value: 'UNDER_REVIEW', label: 'Under Review' },
                            { value: 'APPROVED', label: 'Approved' },
                            { value: 'REJECTED', label: 'Rejected' },
                            { value: 'EXPIRED', label: 'Expired' },
                          ]}
                          onChange={(value) => value && handleUpdateDocumentStatus(doc.id, value as Document['status'])}
                          styles={{
                            input: {
                              backgroundColor: `var(--mantine-color-${documentStatusColors[doc.status]}-1)`,
                              color: `var(--mantine-color-${documentStatusColors[doc.status]}-9)`,
                              fontWeight: 500,
                            },
                          }}
                        />
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteDocument(doc.id)} aria-label={`Delete document ${doc.name}`}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    <Group justify="space-between" mt="sm">
                      <Group gap="xs">
                        {doc.dueDate && (
                          <Text size="xs" c="dimmed">Due: {new Date(doc.dueDate).toLocaleDateString()}</Text>
                        )}
                        {doc.expiresAt && (
                          <Text size="xs" c={expired ? 'red' : expiringSoon ? 'yellow.7' : 'dimmed'} fw={expired || expiringSoon ? 600 : 400}>
                            Expires: {new Date(doc.expiresAt).toLocaleDateString()}
                          </Text>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        Created: {new Date(doc.createdAt).toLocaleDateString()}
                      </Text>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="tasks" pt="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Tasks</Title>
            <Group>
              <Select
                placeholder="Filter by priority"
                clearable
                data={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                ]}
                value={taskPriorityFilter}
                onChange={setTaskPriorityFilter}
                style={{ width: 160 }}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setAddTaskModalOpen(true)}
              >
                Add Task
              </Button>
            </Group>
          </Group>
          {loadingTasks ? (
            <Text c="dimmed">Loading tasks...</Text>
          ) : tasks.length === 0 ? (
            <EmptyState
              iconType="tasks"
              title="No tasks yet"
              description="Create tasks to track what needs to be done for this client."
              ctaLabel="Add Task"
              onCtaClick={() => setAddTaskModalOpen(true)}
            />
          ) : tasks.filter(task => !taskPriorityFilter || task.priority === taskPriorityFilter).length === 0 ? (
            <EmptyState
              iconType="tasks"
              title="No matching tasks"
              description="No tasks match the selected priority filter. Try changing the filter or add a new task."
              ctaLabel="Clear Filter"
              onCtaClick={() => setTaskPriorityFilter(null)}
            />
          ) : (
            <Stack gap="md">
              {tasks.filter(task => !taskPriorityFilter || task.priority === taskPriorityFilter).map((task) => {
                const overdue = isTaskOverdue(task);
                return (
                  <Paper
                    key={task.id}
                    p="md"
                    withBorder
                    style={{
                      ...(task.status === 'COMPLETE' ? { opacity: 0.7 } : {}),
                      ...(overdue ? { borderColor: 'var(--mantine-color-red-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-red-0)' } : {}),
                    }}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm" style={{ flex: 1 }}>
                        <Checkbox
                          checked={task.status === 'COMPLETE'}
                          onChange={() => handleToggleTaskStatus(task)}
                          size="md"
                          disabled={togglingTaskId === task.id}
                        />
                        <div style={{ flex: 1 }}>
                          <Text style={{ textDecoration: task.status === 'COMPLETE' ? 'line-through' : 'none' }}>
                            {task.text}
                          </Text>
                          {task.description && (
                            <Text size="sm" c="dimmed" mt="xs">{task.description}</Text>
                          )}
                        </div>
                      </Group>
                      <Group gap="xs">
                        {overdue && (
                          <Badge color="red" size="sm" variant="filled">
                            OVERDUE
                          </Badge>
                        )}
                        <Badge color={priorityColors[task.priority]} size="sm">
                          {task.priority}
                        </Badge>
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteTask(task.id)} aria-label={`Delete task: ${task.text}`}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    <Group justify="space-between" mt="sm">
                      <Text size="xs" c={overdue ? 'red' : 'dimmed'} fw={overdue ? 600 : 400}>
                        {task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Created: {new Date(task.createdAt).toLocaleDateString()}
                      </Text>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="loans" pt="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Loan Scenarios</Title>
            <Group>
              {selectedScenarios.length >= 2 && (
                <Button
                  leftSection={<IconScale size={16} />}
                  variant="light"
                  onClick={() => setCompareModalOpen(true)}
                >
                  Compare ({selectedScenarios.length})
                </Button>
              )}
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setAddScenarioModalOpen(true)}
              >
                Add Scenario
              </Button>
            </Group>
          </Group>
          {loadingScenarios ? (
            <Text c="dimmed">Loading loan scenarios...</Text>
          ) : loanScenarios.length === 0 ? (
            <EmptyState
              iconType="scenarios"
              title="No loan scenarios yet"
              description="Create loan scenarios to compare different financing options for this client."
              ctaLabel="Add Scenario"
              onCtaClick={() => setAddScenarioModalOpen(true)}
            />
          ) : (
            <>
              {loanScenarios.length > 1 && (
                <Text size="sm" c="dimmed" mb="md">
                  Select 2 or more scenarios to compare them side-by-side
                </Text>
              )}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {loanScenarios.map((scenario) => (
                  <Card
                    key={scenario.id}
                    withBorder
                    shadow="sm"
                    padding="lg"
                    style={{
                      ...(scenario.isPreferred ? { borderColor: 'var(--mantine-color-yellow-5)', borderWidth: 2 } : {}),
                      ...(selectedScenarios.includes(scenario.id) ? { borderColor: 'var(--mantine-color-blue-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-blue-0)' } : {}),
                    }}
                  >
                    <Group justify="space-between" mb="sm">
                      <Group gap="xs">
                        <Checkbox
                          checked={selectedScenarios.includes(scenario.id)}
                          onChange={() => handleToggleScenarioSelection(scenario.id)}
                        />
                        {scenario.isPreferred && (
                          <ThemeIcon color="yellow" size="sm" variant="light">
                            <IconStarFilled size={14} />
                          </ThemeIcon>
                        )}
                        <Text fw={600} size="lg">{scenario.name}</Text>
                      </Group>
                      <Badge color={scenario.loanType === 'PURCHASE' ? 'blue' : 'green'}>
                        {scenario.loanType}
                      </Badge>
                    </Group>

                  <Divider mb="sm" />

                  <SimpleGrid cols={2} spacing="xs" mb="md">
                    <div>
                      <Text size="xs" c="dimmed">Loan Amount</Text>
                      <Text fw={500}>{formatCurrency(scenario.amount)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Property Value</Text>
                      <Text fw={500}>{formatCurrency(scenario.propertyValue)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Interest Rate</Text>
                      <Text fw={500}>{formatPercent(scenario.interestRate)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Term</Text>
                      <Text fw={500}>{scenario.termYears} years</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Down Payment</Text>
                      <Text fw={500}>{formatCurrency(scenario.downPayment)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">LTV Ratio</Text>
                      <Text fw={500}>{formatPercent(scenario.loanToValue)}</Text>
                    </div>
                  </SimpleGrid>

                  <Divider mb="sm" />

                  <SimpleGrid cols={2} spacing="xs" mb="md">
                    <div>
                      <Text size="xs" c="dimmed">Monthly P&I</Text>
                      <Text fw={600} c="blue" size="lg">{formatCurrency(scenario.monthlyPayment)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Total Monthly (PITI)</Text>
                      <Text fw={600} c="green" size="lg">{formatCurrency(scenario.totalMonthlyPayment)}</Text>
                    </div>
                  </SimpleGrid>

                  <Text size="xs" c="dimmed" mb="md">
                    Total Interest: {formatCurrency(scenario.totalInterest)} over {scenario.termYears} years
                  </Text>

                  <Group justify="flex-end" gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => handleExportScenarioPDF(scenario)}
                      title="Export to PDF"
                      aria-label={`Export ${scenario.name} to PDF`}
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="teal"
                      onClick={() => handleExportAmortizationSchedule(scenario)}
                      title="Export Amortization Schedule"
                      aria-label={`Export amortization schedule for ${scenario.name}`}
                    >
                      <IconCalendar size={16} />
                    </ActionIcon>
                    {!scenario.isPreferred && (
                      <ActionIcon
                        variant="subtle"
                        color="yellow"
                        onClick={() => handleSetPreferred(scenario.id)}
                        title="Set as preferred"
                        aria-label={`Set ${scenario.name} as preferred scenario`}
                      >
                        <IconStar size={16} />
                      </ActionIcon>
                    )}
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDeleteScenario(scenario.id)}
                      title="Delete scenario"
                      aria-label={`Delete scenario: ${scenario.name}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Card>
              ))}
              </SimpleGrid>
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="activity" pt="md">
          <Title order={4} mb="md">Activity Timeline</Title>
          {loadingActivities ? (
            <Text c="dimmed">Loading activities...</Text>
          ) : activities.length === 0 ? (
            <EmptyState
              iconType="activity"
              title="No activity recorded yet"
              description="Activity will appear here as you work with this client's records."
            />
          ) : (
            <Stack gap="md">
              {activities.map((activity) => (
                <Paper key={activity.id} p="md" withBorder>
                  <Group justify="space-between" align="flex-start">
                    <Group gap="sm">
                      <Badge color={activityTypeColors[activity.type] || 'gray'} variant="light">
                        {activityTypeLabels[activity.type] || activity.type}
                      </Badge>
                      <Text size="sm">{activity.description}</Text>
                    </Group>
                  </Group>
                  <Group justify="space-between" mt="sm">
                    <Text size="xs" c="dimmed">
                      By {activity.user?.name || 'Unknown'}
                    </Text>
                    <Text size="xs" c="dimmed" title={new Date(activity.createdAt).toLocaleString()}>
                      {formatRelativeTime(activity.createdAt)}
                    </Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Edit Client Modal */}
      <Modal
        opened={editModalOpen}
        onClose={handleCloseEditModal}
        title="Edit Client"
      >
        <Stack>
          <TextInput
            label="Name"
            placeholder="Client name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <TextInput
            label="Email"
            placeholder="client@example.com"
            required
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <TextInput
            label="Phone"
            placeholder="(555) 123-4567"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <Select
            label="Status"
            data={[
              { value: 'LEAD', label: 'Lead' },
              { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PROCESSING', label: 'Processing' },
              { value: 'UNDERWRITING', label: 'Underwriting' },
              { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
              { value: 'CLOSED', label: 'Closed' },
            ]}
            value={editForm.status}
            onChange={(value) => setEditForm({ ...editForm, status: value || 'LEAD' })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleCloseEditModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveClient} loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Client"
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to delete <strong>{client.name}</strong>? This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteClient} loading={deleting}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
      {/* Add Note Modal */}
      <Modal
        opened={addNoteModalOpen}
        onClose={() => { setAddNoteModalOpen(false); setNewNoteText(''); setNewNoteTags([]); }}
        title="Add Note"
      >
        <Stack>
          <Select
            label="Use Template (optional)"
            placeholder={loadingTemplates ? "Loading templates..." : "Select a template to start with"}
            data={noteTemplates.map(t => ({ value: t.id, label: t.name }))}
            clearable
            disabled={loadingTemplates}
            onChange={(value) => {
              const template = noteTemplates.find(t => t.id === value);
              if (template) {
                setNewNoteText(template.content);
              }
            }}
          />
          <Textarea
            label="Note"
            placeholder="Enter your note..."
            required
            minRows={4}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
          />
          <TagsInput
            label="Tags (optional)"
            placeholder="Add tags (press Enter to add)"
            value={newNoteTags}
            onChange={setNewNoteTags}
            data={existingNoteTags}
            clearable
            acceptValueOnBlur
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => { setAddNoteModalOpen(false); setNewNoteText(''); setNewNoteTags([]); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} loading={savingNote}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
      {/* Edit Note Modal */}
      <Modal
        opened={editNoteModalOpen}
        onClose={() => { setEditNoteModalOpen(false); setEditingNote(null); setEditNoteText(''); setEditNoteTags([]); }}
        title="Edit Note"
      >
        <Stack>
          <Textarea
            label="Note"
            placeholder="Enter your note..."
            required
            minRows={4}
            value={editNoteText}
            onChange={(e) => setEditNoteText(e.target.value)}
          />
          <TagsInput
            label="Tags (optional)"
            placeholder="Add tags (press Enter to add)"
            value={editNoteTags}
            onChange={setEditNoteTags}
            data={existingNoteTags}
            clearable
            acceptValueOnBlur
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => { setEditNoteModalOpen(false); setEditingNote(null); setEditNoteText(''); setEditNoteTags([]); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNote} loading={savingNote}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add Document Modal */}
      <Modal
        opened={addDocumentModalOpen}
        onClose={() => {
          if (!savingDocument) {
            setAddDocumentModalOpen(false);
            setNewDocumentForm({ name: '', fileName: '', category: 'OTHER', status: 'UPLOADED', expiresAt: null, notes: '' });
            setSelectedFile(null);
            setUploadProgress(null);
          }
        }}
        title="Add Document"
        closeOnClickOutside={!savingDocument}
        closeOnEscape={!savingDocument}
      >
        <Stack>
          <TextInput
            label="Document Name"
            placeholder="e.g., W-2 Tax Form 2025"
            required
            value={newDocumentForm.name}
            onChange={(e) => setNewDocumentForm({ ...newDocumentForm, name: e.target.value })}
            disabled={savingDocument}
          />
          <FileInput
            label="Upload File (optional)"
            placeholder="Click to select file"
            value={selectedFile}
            onChange={(file) => {
              setSelectedFile(file);
              // Auto-fill document name from file name if empty
              if (file && !newDocumentForm.name) {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                setNewDocumentForm({ ...newDocumentForm, name: nameWithoutExt });
              }
            }}
            accept="*/*"
            clearable
            disabled={savingDocument}
          />
          {selectedFile && (
            <Text size="sm" c="dimmed">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </Text>
          )}
          {uploadProgress !== null && (
            <Stack gap="xs">
              <Progress value={uploadProgress} size="lg" animated striped />
              <Text size="sm" ta="center" c="blue">
                Uploading... {uploadProgress}%
              </Text>
            </Stack>
          )}
          {!selectedFile && (
            <TextInput
              label="File Name (if not uploading)"
              placeholder="e.g., w2_2025.pdf"
              value={newDocumentForm.fileName}
              onChange={(e) => setNewDocumentForm({ ...newDocumentForm, fileName: e.target.value })}
              disabled={savingDocument}
            />
          )}
          <Select
            label="Category"
            data={[
              { value: 'INCOME', label: 'Income' },
              { value: 'EMPLOYMENT', label: 'Employment' },
              { value: 'ASSETS', label: 'Assets' },
              { value: 'PROPERTY', label: 'Property' },
              { value: 'INSURANCE', label: 'Insurance' },
              { value: 'CREDIT', label: 'Credit' },
              { value: 'OTHER', label: 'Other' },
            ]}
            value={newDocumentForm.category}
            onChange={(value) => setNewDocumentForm({ ...newDocumentForm, category: (value as Document['category']) || 'OTHER' })}
            disabled={savingDocument}
          />
          <Select
            label="Status"
            data={[
              { value: 'REQUIRED', label: 'Required' },
              { value: 'REQUESTED', label: 'Requested' },
              { value: 'UPLOADED', label: 'Uploaded' },
              { value: 'UNDER_REVIEW', label: 'Under Review' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            value={newDocumentForm.status}
            onChange={(value) => setNewDocumentForm({ ...newDocumentForm, status: (value as Document['status']) || 'UPLOADED' })}
            disabled={savingDocument}
          />
          <DateInput
            label="Expiration Date (optional)"
            placeholder="Select expiration date"
            value={newDocumentForm.expiresAt}
            onChange={(value) => setNewDocumentForm({ ...newDocumentForm, expiresAt: value })}
            clearable
            disabled={savingDocument}
          />
          <Textarea
            label="Notes (optional)"
            placeholder="Add any notes about this document..."
            minRows={2}
            value={newDocumentForm.notes}
            onChange={(e) => setNewDocumentForm({ ...newDocumentForm, notes: e.target.value })}
            disabled={savingDocument}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setAddDocumentModalOpen(false);
                setNewDocumentForm({ name: '', fileName: '', category: 'OTHER', status: 'UPLOADED', expiresAt: null, notes: '' });
                setSelectedFile(null);
                setUploadProgress(null);
              }}
              disabled={savingDocument}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateDocument} loading={savingDocument}>
              {selectedFile ? 'Upload' : 'Save'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add Task Modal */}
      <Modal
        opened={addTaskModalOpen}
        onClose={() => {
          setAddTaskModalOpen(false);
          setNewTaskForm({ text: '', description: '', priority: 'MEDIUM', dueDate: null });
        }}
        title="Add Task"
      >
        <Stack>
          <TextInput
            label="Task"
            placeholder="Enter task description..."
            required
            value={newTaskForm.text}
            onChange={(e) => setNewTaskForm({ ...newTaskForm, text: e.target.value })}
          />
          <Textarea
            label="Description (optional)"
            placeholder="Add more details..."
            minRows={2}
            value={newTaskForm.description}
            onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
          />
          <Select
            label="Priority"
            data={[
              { value: 'LOW', label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH', label: 'High' },
            ]}
            value={newTaskForm.priority}
            onChange={(value) => setNewTaskForm({ ...newTaskForm, priority: (value as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM' })}
          />
          <DateInput
            label="Due Date (optional)"
            placeholder="Select due date"
            value={newTaskForm.dueDate}
            onChange={(date) => setNewTaskForm({ ...newTaskForm, dueDate: date })}
            clearable
            minDate={new Date()}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setAddTaskModalOpen(false);
                setNewTaskForm({ text: '', description: '', priority: 'MEDIUM', dueDate: null });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTask} loading={savingTask}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add Loan Scenario Modal */}
      <Modal
        opened={addScenarioModalOpen}
        onClose={() => {
          setAddScenarioModalOpen(false);
          setNewScenarioForm({
            name: '',
            loanType: 'PURCHASE',
            amount: 400000,
            interestRate: 6.5,
            termYears: 30,
            downPayment: 80000,
            propertyValue: 500000,
            propertyTaxes: 0,
            homeInsurance: 0,
            hoaFees: 0,
          });
          setCalculatedValues(null);
          setScenarioFormErrors({});
        }}
        title="Add Loan Scenario"
        size="lg"
      >
        <Stack>
          <TextInput
            label="Scenario Name"
            placeholder="e.g., 30-Year Fixed 6.5%"
            required
            value={newScenarioForm.name}
            onChange={(e) => {
              setNewScenarioForm({ ...newScenarioForm, name: e.target.value });
              if (scenarioFormErrors.name) setScenarioFormErrors({ ...scenarioFormErrors, name: undefined });
            }}
            error={scenarioFormErrors.name}
          />

          <Select
            label="Loan Type"
            data={[
              { value: 'PURCHASE', label: 'Purchase' },
              { value: 'REFINANCE', label: 'Refinance' },
            ]}
            value={newScenarioForm.loanType}
            onChange={(value) => setNewScenarioForm({ ...newScenarioForm, loanType: (value as 'PURCHASE' | 'REFINANCE') || 'PURCHASE' })}
          />

          <SimpleGrid cols={2}>
            <NumberInput
              label="Loan Amount"
              placeholder="400000"
              required
              value={newScenarioForm.amount}
              onChange={(value) => {
                setNewScenarioForm({ ...newScenarioForm, amount: Number(value) || 0 });
                if (scenarioFormErrors.amount) setScenarioFormErrors({ ...scenarioFormErrors, amount: undefined });
              }}
              leftSection={<IconCurrencyDollar size={16} />}
              thousandSeparator=","
              error={scenarioFormErrors.amount}
            />
            <NumberInput
              label="Property Value"
              placeholder="500000"
              min={0}
              value={newScenarioForm.propertyValue}
              onChange={(value) => setNewScenarioForm({ ...newScenarioForm, propertyValue: Number(value) || 0 })}
              leftSection={<IconCurrencyDollar size={16} />}
              thousandSeparator=","
            />
          </SimpleGrid>

          <SimpleGrid cols={3}>
            <NumberInput
              label="Interest Rate (%)"
              placeholder="6.5"
              required
              min={0}
              step={0.125}
              decimalScale={3}
              value={newScenarioForm.interestRate}
              onChange={(value) => {
                setNewScenarioForm({ ...newScenarioForm, interestRate: Number(value) || 0 });
                if (scenarioFormErrors.interestRate) setScenarioFormErrors({ ...scenarioFormErrors, interestRate: undefined });
              }}
              leftSection={<IconPercentage size={16} />}
              error={scenarioFormErrors.interestRate}
            />
            <NumberInput
              label="Term (Years)"
              placeholder="30"
              required
              min={1}
              max={40}
              value={newScenarioForm.termYears}
              onChange={(value) => {
                setNewScenarioForm({ ...newScenarioForm, termYears: Number(value) || 0 });
                if (scenarioFormErrors.termYears) setScenarioFormErrors({ ...scenarioFormErrors, termYears: undefined });
              }}
              leftSection={<IconCalendar size={16} />}
              error={scenarioFormErrors.termYears}
            />
            <NumberInput
              label="Down Payment"
              placeholder="80000"
              min={0}
              value={newScenarioForm.downPayment}
              onChange={(value) => setNewScenarioForm({ ...newScenarioForm, downPayment: Number(value) || 0 })}
              leftSection={<IconCurrencyDollar size={16} />}
              thousandSeparator=","
            />
          </SimpleGrid>

          <Divider label="Additional Costs (Annual)" labelPosition="center" />

          <SimpleGrid cols={3}>
            <NumberInput
              label="Property Taxes"
              placeholder="0"
              min={0}
              value={newScenarioForm.propertyTaxes}
              onChange={(value) => setNewScenarioForm({ ...newScenarioForm, propertyTaxes: Number(value) || 0 })}
              leftSection={<IconCurrencyDollar size={16} />}
              thousandSeparator=","
            />
            <NumberInput
              label="Home Insurance"
              placeholder="0"
              min={0}
              value={newScenarioForm.homeInsurance}
              onChange={(value) => setNewScenarioForm({ ...newScenarioForm, homeInsurance: Number(value) || 0 })}
              leftSection={<IconCurrencyDollar size={16} />}
              thousandSeparator=","
            />
            <NumberInput
              label="HOA Fees (Monthly)"
              placeholder="0"
              min={0}
              value={newScenarioForm.hoaFees}
              onChange={(value) => setNewScenarioForm({ ...newScenarioForm, hoaFees: Number(value) || 0 })}
              leftSection={<IconCurrencyDollar size={16} />}
              thousandSeparator=","
            />
          </SimpleGrid>

          {calculatedValues && (
            <>
              <Divider label="Calculated Values" labelPosition="center" />
              <Paper p="md" withBorder bg="gray.0">
                <SimpleGrid cols={2}>
                  <div>
                    <Text size="xs" c="dimmed">Monthly P&I</Text>
                    <Text fw={600} size="lg" c="blue">{formatCurrency(calculatedValues.monthlyPayment)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Total Monthly (PITI)</Text>
                    <Text fw={600} size="lg" c="green">{formatCurrency(calculatedValues.totalMonthlyPayment)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Total Interest</Text>
                    <Text fw={500}>{formatCurrency(calculatedValues.totalInterest)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">LTV Ratio</Text>
                    <Text fw={500}>{formatPercent(calculatedValues.loanToValue)}</Text>
                  </div>
                </SimpleGrid>
              </Paper>
            </>
          )}

          <Group justify="space-between" mt="md">
            <Button variant="light" onClick={handleCalculateScenario}>
              Calculate
            </Button>
            <Group>
              <Button
                variant="subtle"
                onClick={() => {
                  setAddScenarioModalOpen(false);
                  setNewScenarioForm({
                    name: '',
                    loanType: 'PURCHASE',
                    amount: 400000,
                    interestRate: 6.5,
                    termYears: 30,
                    downPayment: 80000,
                    propertyValue: 500000,
                    propertyTaxes: 0,
                    homeInsurance: 0,
                    hoaFees: 0,
                  });
                  setCalculatedValues(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateScenario} loading={savingScenario}>
                Save
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Compare Loan Scenarios Modal */}
      <Modal
        opened={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        title="Compare Loan Scenarios"
        size="xl"
      >
        <Stack>
          {getSelectedScenariosData().length >= 2 && (() => {
            const scenarios = getSelectedScenariosData();
            const minPayment = Math.min(...scenarios.map(s => s.monthlyPayment || 0));
            const maxPayment = Math.max(...scenarios.map(s => s.monthlyPayment || 0));
            const minInterest = Math.min(...scenarios.map(s => s.totalInterest || 0));
            const maxInterest = Math.max(...scenarios.map(s => s.totalInterest || 0));
            const paymentDiff = maxPayment - minPayment;
            const interestDiff = maxInterest - minInterest;

            return (
              <>
                <Paper p="md" withBorder bg="blue.0" mb="md">
                  <SimpleGrid cols={2}>
                    <div>
                      <Text size="sm" c="dimmed">Monthly Payment Difference</Text>
                      <Text fw={700} size="xl" c="blue">{formatCurrency(paymentDiff)}/mo</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">Total Interest Difference</Text>
                      <Text fw={700} size="xl" c="red">{formatCurrency(interestDiff)}</Text>
                    </div>
                  </SimpleGrid>
                </Paper>

                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Metric</Table.Th>
                      {scenarios.map(s => (
                        <Table.Th key={s.id}>{s.name}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={500}>Loan Type</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>
                          <Badge color={s.loanType === 'PURCHASE' ? 'blue' : 'green'}>{s.loanType}</Badge>
                        </Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>Loan Amount</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>{formatCurrency(s.amount)}</Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>Interest Rate</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>{formatPercent(s.interestRate)}</Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>Term</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>{s.termYears} years</Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>Down Payment</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>{formatCurrency(s.downPayment)}</Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>Property Value</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>{formatCurrency(s.propertyValue)}</Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>LTV Ratio</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>{formatPercent(s.loanToValue)}</Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr bg="blue.0">
                      <Table.Td fw={700}>Monthly P&I</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>
                          <Text fw={700} c={s.monthlyPayment === minPayment ? 'green' : s.monthlyPayment === maxPayment ? 'red' : undefined}>
                            {formatCurrency(s.monthlyPayment)}
                            {s.monthlyPayment === minPayment && <Badge ml="xs" size="xs" color="green">Lowest</Badge>}
                          </Text>
                        </Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr bg="blue.0">
                      <Table.Td fw={700}>Total Monthly (PITI)</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>
                          <Text fw={700}>{formatCurrency(s.totalMonthlyPayment)}</Text>
                        </Table.Td>
                      ))}
                    </Table.Tr>
                    <Table.Tr bg="red.0">
                      <Table.Td fw={700}>Total Interest</Table.Td>
                      {scenarios.map(s => (
                        <Table.Td key={s.id}>
                          <Text fw={700} c={s.totalInterest === minInterest ? 'green' : s.totalInterest === maxInterest ? 'red' : undefined}>
                            {formatCurrency(s.totalInterest)}
                            {s.totalInterest === minInterest && <Badge ml="xs" size="xs" color="green">Lowest</Badge>}
                          </Text>
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </>
            );
          })()}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setCompareModalOpen(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Unsaved Changes Warning Modal */}
      <Modal
        opened={unsavedChangesModalOpen}
        onClose={handleStayOnPage}
        title="Unsaved Changes"
        centered
      >
        <Stack>
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            You have unsaved changes in the edit form. Are you sure you want to leave? Your changes will be lost.
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleStayOnPage}>
              Stay
            </Button>
            <Button color="red" onClick={handleLeavePage}>
              Leave
            </Button>
          </Group>
        </Stack>
      </Modal>

    </Container>
  );
}
