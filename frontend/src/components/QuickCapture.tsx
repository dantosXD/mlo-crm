import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  TextInput,
  Group,
  Text,
  UnstyledButton,
  Stack,
  Kbd,
  Box,
  ScrollArea,
  Badge,
  Loader,
  ActionIcon,
  Tooltip,
  Select,
} from '@mantine/core';
import { useDisclosure, useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconDashboard,
  IconUsers,
  IconLayoutKanban,
  IconNotes,
  IconFileText,
  IconCalculator,
  IconChartBar,
  IconSettings,
  IconPlus,
  IconChecklist,
  IconCheck,
  IconUser,
  IconArrowLeft,
  IconCalendar,
  IconBell,
  IconActivity,
  IconMicrophone,
  IconMicrophoneOff,
} from '@tabler/icons-react';
import { api } from '../utils/api';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

type CommandId = '/task' | '/note' | '/reminder' | '/activity';

interface SlashCommand {
  command: CommandId;
  label: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
}

interface ParsedTask {
  text: string;
  detectedClient: Client | null;
  detectedDate: Date | null;
  dateLabel: string;
}

interface BasicTemplate {
  id: string;
  name: string;
}

interface TaskTemplate extends BasicTemplate {
  text?: string;
  description?: string | null;
  type?: string;
  priority?: string;
  dueDays?: number | null;
  tags?: string[];
}

interface NoteTemplate extends BasicTemplate {
  content?: string;
  tags?: string[];
}

interface ReminderTemplate extends BasicTemplate {
  config?: any;
}

interface ActivityTemplate extends BasicTemplate {
  config?: any;
  autoFollowUp?: any;
}

interface PendingClientAction {
  command: '/note' | '/activity';
  content: string;
}

const commandLabels: Record<CommandId, string> = {
  '/task': 'task',
  '/note': 'note',
  '/reminder': 'reminder',
  '/activity': 'activity',
};

// Date keywords mapping
const dateKeywords: Record<string, () => Date> = {
  'today': () => new Date(),
  'tomorrow': () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  },
  'next week': () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  },
  'monday': () => getNextDayOfWeek(1),
  'tuesday': () => getNextDayOfWeek(2),
  'wednesday': () => getNextDayOfWeek(3),
  'thursday': () => getNextDayOfWeek(4),
  'friday': () => getNextDayOfWeek(5),
  'saturday': () => getNextDayOfWeek(6),
  'sunday': () => getNextDayOfWeek(0),
};

function getNextDayOfWeek(dayOfWeek: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
  const result = new Date();
  result.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
  return result;
}

// Parse natural language to detect client and date
function parseNaturalLanguageTask(text: string, clients: Client[]): ParsedTask {
  const textLower = text.toLowerCase();
  let detectedClient: Client | null = null;
  let detectedDate: Date | null = null;
  let dateLabel = '';

  // Detect date from text
  for (const [keyword, getDate] of Object.entries(dateKeywords)) {
    if (textLower.includes(keyword)) {
      detectedDate = getDate();
      dateLabel = keyword;
      break;
    }
  }

  // Detect client from text (fuzzy match on first name, last name, or full name)
  for (const client of clients) {
    const clientNameLower = client.name.toLowerCase();
    const nameParts = clientNameLower.split(/\s+/);

    // Check if any part of client name appears in text
    for (const part of nameParts) {
      if (part.length >= 3 && textLower.includes(part)) {
        detectedClient = client;
        break;
      }
    }

    // Also check for full name
    if (textLower.includes(clientNameLower)) {
      detectedClient = client;
      break;
    }

    if (detectedClient) break;
  }

  return {
    text,
    detectedClient,
    detectedDate,
    dateLabel,
  };
}

const slashCommands: SlashCommand[] = [
  {
    command: '/task',
    label: 'Create Task',
    description: 'Create a new task',
    icon: <IconChecklist size={20} aria-hidden="true" />,
    placeholder: 'Task description...',
  },
  {
    command: '/note',
    label: 'Create Note',
    description: 'Create a quick note',
    icon: <IconNotes size={20} aria-hidden="true" />,
    placeholder: 'Note content...',
  },
  {
    command: '/reminder',
    label: 'Create Reminder',
    description: 'Create a quick reminder',
    icon: <IconBell size={20} aria-hidden="true" />,
    placeholder: 'Reminder title...',
  },
  {
    command: '/activity',
    label: 'Log Activity',
    description: 'Log client activity',
    icon: <IconActivity size={20} aria-hidden="true" />,
    placeholder: 'Activity details...',
  },
];

export function QuickCapture() {
  const [opened, { open, close }] = useDisclosure(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const speechRecognitionRef = useRef<any>(null);

  const [pendingClientAction, setPendingClientAction] = useState<PendingClientAction | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const clientsFetchPromiseRef = useRef<Promise<Client[]> | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Record<CommandId, string | null>>({
    '/task': null,
    '/note': null,
    '/reminder': null,
    '/activity': null,
  });

  const { data: taskTemplates = [] } = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const response = await api.get('/tasks/templates');
      if (!response.ok) throw new Error('Failed to fetch task templates');
      return response.json() as Promise<TaskTemplate[]>;
    },
    enabled: opened,
  });

  const { data: noteTemplates = [] } = useQuery({
    queryKey: ['note-templates'],
    queryFn: async () => {
      const response = await api.get('/notes/templates');
      if (!response.ok) throw new Error('Failed to fetch note templates');
      return response.json() as Promise<NoteTemplate[]>;
    },
    enabled: opened,
  });

  const { data: reminderTemplates = [] } = useQuery({
    queryKey: ['reminder-templates'],
    queryFn: async () => {
      const response = await api.get('/reminders/templates');
      if (!response.ok) throw new Error('Failed to fetch reminder templates');
      return response.json() as Promise<ReminderTemplate[]>;
    },
    enabled: opened,
  });

  const { data: activityTemplates = [] } = useQuery({
    queryKey: ['activity-templates'],
    queryFn: async () => {
      const response = await api.get('/activities/templates');
      if (!response.ok) throw new Error('Failed to fetch activity templates');
      return response.json() as Promise<ActivityTemplate[]>;
    },
    enabled: opened,
  });

  // Check if query is a slash command
  const activeCommand = slashCommands.find(cmd => query.toLowerCase().startsWith(cmd.command));
  const commandContent = activeCommand ? query.slice(activeCommand.command.length).trim() : '';

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      speechRecognitionRef.current = null;
      return;
    }

    setSpeechSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.trim() || '';
      if (!transcript) {
        return;
      }

      setQuery((prev) => (prev.trim() ? `${prev} ${transcript}` : transcript));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event?.error !== 'no-speech' && event?.error !== 'aborted') {
        notifications.show({
          title: 'Voice Input Error',
          message: 'Could not capture speech. Please try again.',
          color: 'red',
        });
      }
    };

    speechRecognitionRef.current = recognition;

    return () => {
      try {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.stop();
      } catch {
        // no-op during cleanup
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!speechRecognitionRef.current || !speechSupported) {
      notifications.show({
        title: 'Voice Input Unavailable',
        message: 'Speech recognition is not supported in this browser.',
        color: 'yellow',
      });
      return;
    }

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      speechRecognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      notifications.show({
        title: 'Voice Input Error',
        message: 'Could not start voice input.',
        color: 'red',
      });
    }
  };

  // Filter clients based on search (for note creation mode)
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  // Filter clients based on main query (for client search in main view)
  const searchedClients = query.trim() && !query.startsWith('/') && !activeCommand
    ? clients.filter(client =>
        client.name.toLowerCase().includes(query.toLowerCase()) ||
        client.email.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  // Define quick actions
  const actions: QuickAction[] = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      description: 'View your dashboard',
      icon: <IconDashboard size={20} aria-hidden="true" />,
      action: () => { navigate('/'); close(); },
      keywords: ['home', 'main', 'dashboard'],
    },
    {
      id: 'clients',
      label: 'Go to Clients',
      description: 'View all clients',
      icon: <IconUsers size={20} aria-hidden="true" />,
      action: () => { navigate('/clients'); close(); },
      keywords: ['clients', 'customers', 'contacts'],
    },
    {
      id: 'add-client',
      label: 'Add New Client',
      description: 'Create a new client',
      icon: <IconPlus size={20} aria-hidden="true" />,
      action: () => { navigate('/clients?action=add'); close(); },
      keywords: ['add', 'new', 'create', 'client'],
    },
    {
      id: 'pipeline',
      label: 'Go to Pipeline',
      description: 'View loan pipeline',
      icon: <IconLayoutKanban size={20} aria-hidden="true" />,
      action: () => { navigate('/pipeline'); close(); },
      keywords: ['pipeline', 'kanban', 'board', 'loans'],
    },
    {
      id: 'notes',
      label: 'Go to Notes',
      description: 'View all notes',
      icon: <IconNotes size={20} aria-hidden="true" />,
      action: () => { navigate('/notes'); close(); },
      keywords: ['notes', 'memo', 'journal'],
    },
    {
      id: 'documents',
      label: 'Go to Documents',
      description: 'View all documents',
      icon: <IconFileText size={20} aria-hidden="true" />,
      action: () => { navigate('/documents'); close(); },
      keywords: ['documents', 'files', 'uploads'],
    },
    {
      id: 'calculator',
      label: 'Go to Calculator',
      description: 'Open loan calculator',
      icon: <IconCalculator size={20} aria-hidden="true" />,
      action: () => { navigate('/calculator'); close(); },
      keywords: ['calculator', 'calc', 'math', 'loan'],
    },
    {
      id: 'analytics',
      label: 'Go to Analytics',
      description: 'View analytics',
      icon: <IconChartBar size={20} aria-hidden="true" />,
      action: () => { navigate('/analytics'); close(); },
      keywords: ['analytics', 'reports', 'stats', 'charts'],
    },
    {
      id: 'settings',
      label: 'Go to Settings',
      description: 'Manage settings',
      icon: <IconSettings size={20} aria-hidden="true" />,
      action: () => { navigate('/settings'); close(); },
      keywords: ['settings', 'preferences', 'config'],
    },
  ];

  // Filter actions based on query (only when not using slash command)
  const filteredActions = activeCommand
    ? []
    : query.trim() === ''
    ? actions
    : query.startsWith('/')
    ? [] // Show slash command suggestions
    : actions.filter((action) => {
        const searchLower = query.toLowerCase();
        return (
          action.label.toLowerCase().includes(searchLower) ||
          action.description.toLowerCase().includes(searchLower) ||
          action.keywords.some((kw) => kw.includes(searchLower))
        );
      });

  // Show slash command suggestions when user types /
  const showSlashSuggestions = query === '/' || (query.startsWith('/') && !activeCommand);
  const filteredSlashCommands = showSlashSuggestions
    ? slashCommands.filter(cmd => cmd.command.startsWith(query.toLowerCase()))
    : [];

  const fetchClients = async (): Promise<Client[]> => {
    if (clientsFetchPromiseRef.current) {
      return clientsFetchPromiseRef.current;
    }

    const fetchPromise = (async () => {
      setIsLoadingClients(true);
      try {
        const response = await api.get('/clients');
        if (!response.ok) {
          return [] as Client[];
        }

        const payload = await response.json();
        const normalizedClients = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload?.data) ? payload.data : []);
        setClients(normalizedClients);
        return normalizedClients as Client[];
      } catch (error) {
        console.error('Error fetching clients:', error);
        return [] as Client[];
      } finally {
        setIsLoadingClients(false);
        clientsFetchPromiseRef.current = null;
      }
    })();

    clientsFetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  };

  const parseResponseError = async (response: Response, fallback: string) => {
    const payload = await response.json().catch(() => ({}));
    return typeof payload?.message === 'string' ? payload.message : fallback;
  };

  const resolveOffsetDate = (offset?: { value?: number; unit?: 'minutes' | 'hours' | 'days'; atTime?: string }) => {
    if (!offset) return null;

    const date = new Date();
    const value = Number(offset.value ?? 0);
    switch (offset.unit) {
      case 'minutes':
        date.setMinutes(date.getMinutes() + value);
        break;
      case 'hours':
        date.setHours(date.getHours() + value);
        break;
      default:
        date.setDate(date.getDate() + value);
        break;
    }

    if (offset.atTime) {
      const [hours, minutes] = offset.atTime.split(':').map((part: string) => Number(part));
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        date.setHours(hours, minutes, 0, 0);
      }
    }

    return date;
  };

  const getSelectedTemplate = (command: CommandId) => selectedTemplates[command];

  const startClientSelection = (command: '/note' | '/activity', content: string) => {
    setPendingClientAction({ command, content });
    setClientSearchQuery('');
    setSelectedIndex(0);
    fetchClients();
  };

  const cancelClientSelection = () => {
    setPendingClientAction(null);
    setClientSearchQuery('');
    setSelectedIndex(0);
  };

  const createTask = async (text: string, clientId?: string, dueDate?: Date, templateId?: string | null) => {
    const template = taskTemplates.find((item) => item.id === (templateId || getSelectedTemplate('/task')));
    const finalText = text.trim() || template?.text?.trim() || '';
    if (!finalText) {
      notifications.show({
        title: 'Task Text Required',
        message: 'Enter task text or select a template with text.',
        color: 'orange',
      });
      return;
    }

    const templateDueDate = template?.dueDays != null
      ? new Date(Date.now() + (template.dueDays * 24 * 60 * 60 * 1000))
      : null;
    const finalDueDate = dueDate || templateDueDate || undefined;

    setIsCreating(true);
    try {
      const taskData: Record<string, unknown> = {
        text: finalText,
        status: 'TODO',
        priority: template?.priority || 'MEDIUM',
        type: template?.type || 'GENERAL',
      };

      if (template?.description) {
        taskData.description = template.description;
      }
      if (template?.tags?.length) {
        taskData.tags = JSON.stringify(template.tags);
      }
      if (clientId) {
        taskData.clientId = clientId;
      }
      if (finalDueDate) {
        taskData.dueDate = finalDueDate.toISOString();
      }

      const response = await api.post('/tasks', taskData);
      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to create task'));
      }

      const clientName = clientId ? clients.find((c) => c.id === clientId)?.name : null;
      const dueDateStr = finalDueDate ? finalDueDate.toLocaleDateString() : null;
      let message = `"${finalText}" has been added to your tasks`;
      if (clientName && dueDateStr) {
        message = `Task created for ${clientName}, due ${dueDateStr}`;
      } else if (clientName) {
        message = `Task created for ${clientName}`;
      } else if (dueDateStr) {
        message = `Task created, due ${dueDateStr}`;
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      notifications.show({
        title: 'Task Created',
        message,
        color: 'green',
        icon: <IconCheck size={16} aria-hidden="true" />,
      });
      close();
    } catch (error) {
      console.error('Error creating task:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create task. Please try again.',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const createNote = async (text: string, clientId: string, templateId?: string | null) => {
    const template = noteTemplates.find((item) => item.id === (templateId || getSelectedTemplate('/note')));
    const finalText = text.trim() || template?.content?.trim() || '';
    if (!clientId || !finalText) {
      notifications.show({
        title: 'Note Content Required',
        message: 'Enter note content or select a template with content.',
        color: 'orange',
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post('/notes', {
        clientId,
        text: finalText,
        tags: template?.tags || [],
      });
      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to create note'));
      }

      const client = clients.find((c) => c.id === clientId);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      notifications.show({
        title: 'Note Created',
        message: `Note added to ${client?.name || 'client'}`,
        color: 'green',
        icon: <IconCheck size={16} aria-hidden="true" />,
      });
      close();
    } catch (error) {
      console.error('Error creating note:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create note. Please try again.',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const createReminder = async (text: string, parsed: ParsedTask, templateId?: string | null) => {
    const template = reminderTemplates.find((item) => item.id === (templateId || getSelectedTemplate('/reminder')));
    const config = template?.config || {};
    const finalTitle = text.trim() || `${config.title || ''}`.trim();
    if (!finalTitle) {
      notifications.show({
        title: 'Reminder Title Required',
        message: 'Enter reminder text or select a template with a title.',
        color: 'orange',
      });
      return;
    }

    const remindAt = parsed.detectedDate || resolveOffsetDate(config.remindOffset) || new Date(Date.now() + (24 * 60 * 60 * 1000));
    const dueDate = resolveOffsetDate(config.dueOffset);

    setIsCreating(true);
    try {
      const response = await api.post('/reminders', {
        title: finalTitle,
        description: config.description || undefined,
        category: config.category || 'GENERAL',
        priority: config.priority || 'MEDIUM',
        remindAt: remindAt.toISOString(),
        dueDate: dueDate ? dueDate.toISOString() : undefined,
        clientId: parsed.detectedClient?.id || undefined,
        tags: Array.isArray(config.tags) ? config.tags : undefined,
        isRecurring: Boolean(config.isRecurring),
        recurringPattern: config.isRecurring ? config.recurringPattern : undefined,
        recurringInterval: config.isRecurring ? config.recurringInterval : undefined,
      });
      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to create reminder'));
      }

      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      notifications.show({
        title: 'Reminder Created',
        message: `Reminder scheduled for ${remindAt.toLocaleDateString()}`,
        color: 'green',
        icon: <IconCheck size={16} aria-hidden="true" />,
      });
      close();
    } catch (error) {
      console.error('Error creating reminder:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create reminder. Please try again.',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const createActivity = async (text: string, clientId: string, templateId?: string | null) => {
    const selectedTemplateId = templateId || getSelectedTemplate('/activity');
    const template = activityTemplates.find((item) => item.id === selectedTemplateId);
    const config = template?.config || {};
    const finalDescription = text.trim() || `${config.description || ''}`.trim();
    if (!finalDescription || !clientId) {
      notifications.show({
        title: 'Activity Details Required',
        message: 'Select a client and enter activity details or use a template.',
        color: 'orange',
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post('/activities', {
        clientId,
        type: config.type || 'INTERACTION_OTHER',
        description: finalDescription,
        metadata: config.metadata || undefined,
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
      });
      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to log activity'));
      }

      const created = await response.json();
      const followUpText = created?.followUp?.kind
        ? ` Follow-up ${created.followUp.kind.toLowerCase()} created.`
        : '';

      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      notifications.show({
        title: 'Activity Logged',
        message: `Activity logged for client.${followUpText}`,
        color: 'green',
        icon: <IconCheck size={16} aria-hidden="true" />,
      });
      close();
    } catch (error) {
      console.error('Error creating activity:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to log activity. Please try again.',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Reset selection when query/clientSearchQuery changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, clientSearchQuery]);

  // Reset everything when modal opens/closes
  useEffect(() => {
    if (opened) {
      setQuery('');
      setSelectedIndex(0);
      setPendingClientAction(null);
      setClientSearchQuery('');
      setSelectedTemplates({
        '/task': null,
        '/note': null,
        '/reminder': null,
        '/activity': null,
      });
      // Fetch clients when modal opens for quick client search
      fetchClients();
    }
  }, [opened]);

  // Register global hotkey
  useHotkeys([
    ['mod+k', (e) => {
      e.preventDefault();
      open();
    }],
  ]);

  useEffect(() => {
    const onOpenRequest = () => {
      open();
    };

    window.addEventListener('mlo:open-quick-capture', onOpenRequest);
    return () => {
      window.removeEventListener('mlo:open-quick-capture', onOpenRequest);
    };
  }, [open]);

  const executeActiveCommand = async () => {
    if (!activeCommand) return;
    const selectedTemplateId = selectedTemplates[activeCommand.command];
    if (!commandContent.trim() && !selectedTemplateId) {
      notifications.show({
        title: 'Input Needed',
        message: `Type ${activeCommand.placeholder} or select a template.`,
        color: 'orange',
      });
      return;
    }

    let availableClients = clients;
    if ((activeCommand.command === '/note' || activeCommand.command === '/activity') && commandContent.trim() && clients.length === 0) {
      availableClients = await fetchClients();
    }

    const parsed = parseNaturalLanguageTask(commandContent, availableClients);

    if (activeCommand.command === '/task') {
      createTask(
        commandContent,
        parsed.detectedClient?.id,
        parsed.detectedDate || undefined,
        selectedTemplateId,
      );
      return;
    }

    if (activeCommand.command === '/note') {
      if (parsed.detectedClient?.id) {
        createNote(commandContent, parsed.detectedClient.id, selectedTemplateId);
      } else {
        startClientSelection('/note', commandContent);
      }
      return;
    }

    if (activeCommand.command === '/reminder') {
      createReminder(commandContent, parsed, selectedTemplateId);
      return;
    }

    if (activeCommand.command === '/activity') {
      if (parsed.detectedClient?.id) {
        createActivity(commandContent, parsed.detectedClient.id, selectedTemplateId);
      } else {
        startClientSelection('/activity', commandContent);
      }
    }
  };

  // Handle keyboard navigation within the modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (pendingClientAction !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredClients.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredClients[selectedIndex]) {
          const selectedClientId = filteredClients[selectedIndex].id;
          const selectedTemplateId = selectedTemplates[pendingClientAction.command];
          if (pendingClientAction.command === '/note') {
            createNote(pendingClientAction.content, selectedClientId, selectedTemplateId);
          } else {
            createActivity(pendingClientAction.content, selectedClientId, selectedTemplateId);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelClientSelection();
      }
      return;
    }

    // Calculate total items: searchedClients first, then filteredActions
    const totalItems = searchedClients.length + filteredActions.length;
    const maxIndex = activeCommand ? 0 : (showSlashSuggestions ? filteredSlashCommands.length - 1 : totalItems - 1);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();

        if (activeCommand) {
          void executeActiveCommand();
          return;
        }

      // Handle slash command selection
      if (showSlashSuggestions && filteredSlashCommands[selectedIndex]) {
        setQuery(filteredSlashCommands[selectedIndex].command + ' ');
        return;
      }

      // Handle client selection (clients are listed first)
      if (selectedIndex < searchedClients.length) {
        const selectedClient = searchedClients[selectedIndex];
        navigate(`/clients/${selectedClient.id}`);
        close();
        return;
      }

      // Handle regular action (offset by number of searched clients)
      const actionIndex = selectedIndex - searchedClients.length;
      if (filteredActions[actionIndex]) {
        filteredActions[actionIndex].action();
      }
    }
  };

  // Render client selection for note/activity
  const renderClientSelection = () => {
    if (!pendingClientAction) return null;

    const selectionIcon = pendingClientAction.command === '/activity'
      ? <IconActivity size={14} aria-hidden="true" />
      : <IconNotes size={14} aria-hidden="true" />;

    return (
      <Box p="sm">
        <Group gap="sm" mb="xs">
          <UnstyledButton onClick={cancelClientSelection}>
            <IconArrowLeft size={16} aria-hidden="true" />
          </UnstyledButton>
          <Badge color="violet" variant="light" leftSection={selectionIcon}>
            {pendingClientAction.command}
          </Badge>
          <Text size="sm" c="dimmed" style={{ flex: 1 }} lineClamp={1}>
            "{pendingClientAction.content || '(template defaults)'}"
          </Text>
        </Group>
        <Text size="sm" fw={500} mb="xs">Select a client:</Text>
        <TextInput
          placeholder="Search clients..."
          value={clientSearchQuery}
          onChange={(e) => setClientSearchQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          leftSection={<IconSearch size={16} aria-hidden="true" />}
          size="sm"
          autoFocus
          mb="sm"
        />
        {isLoadingClients ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Loading clients...</Text>
          </Group>
        ) : filteredClients.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No clients found
          </Text>
        ) : (
          <Stack gap={4}>
            {filteredClients.slice(0, 10).map((client, index) => (
              <UnstyledButton
                key={client.id}
                onClick={() => {
                  const selectedTemplateId = selectedTemplates[pendingClientAction.command];
                  if (pendingClientAction.command === '/note') {
                    createNote(pendingClientAction.content, client.id, selectedTemplateId);
                  } else {
                    createActivity(pendingClientAction.content, client.id, selectedTemplateId);
                  }
                }}
                p="sm"
                style={{
                  borderRadius: 8,
                  backgroundColor: index === selectedIndex ? 'var(--mantine-color-blue-light)' : 'transparent',
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Group gap="sm">
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--mantine-color-blue-1)',
                      color: 'var(--mantine-color-blue-6)',
                    }}
                  >
                    <IconUser size={20} aria-hidden="true" />
                  </Box>
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>{client.name}</Text>
                    <Text size="xs" c="dimmed">{client.email}</Text>
                  </div>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Box>
    );
  };

  // Render slash command suggestion
  const renderSlashCommandSuggestion = (cmd: SlashCommand, index: number) => (
    <UnstyledButton
      key={cmd.command}
      onClick={() => setQuery(cmd.command + ' ')}
      p="sm"
      style={{
        borderRadius: 8,
        backgroundColor: index === selectedIndex ? 'var(--mantine-color-blue-light)' : 'transparent',
      }}
      onMouseEnter={() => setSelectedIndex(index)}
    >
      <Group gap="sm">
        <Box
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--mantine-color-violet-1)',
            color: 'var(--mantine-color-violet-6)',
          }}
        >
          {cmd.icon}
        </Box>
        <div style={{ flex: 1 }}>
          <Group gap="xs">
            <Text size="sm" fw={500}>{cmd.label}</Text>
            <Badge size="xs" variant="light" color="violet">{cmd.command}</Badge>
          </Group>
          <Text size="xs" c="dimmed">{cmd.description}</Text>
        </div>
      </Group>
    </UnstyledButton>
  );

  // Render active command UI
  const renderActiveCommand = () => {
    if (!activeCommand) return null;

    const parsed = parseNaturalLanguageTask(commandContent, clients);
    const selectedTemplateId = selectedTemplates[activeCommand.command];
    const templateOptions = activeCommand.command === '/task'
      ? taskTemplates.map((template) => ({ value: template.id, label: template.name }))
      : activeCommand.command === '/note'
      ? noteTemplates.map((template) => ({ value: template.id, label: template.name }))
      : activeCommand.command === '/reminder'
      ? reminderTemplates.map((template) => ({ value: template.id, label: template.name }))
      : activityTemplates.map((template) => ({ value: template.id, label: template.name }));

    const hasInput = !!commandContent.trim() || !!selectedTemplateId;
    const actionLabel = commandContent.trim()
      ? `Create: "${commandContent.trim()}"`
      : 'Create from selected template';
    const commandHelp = activeCommand.command === '/note' || activeCommand.command === '/activity'
      ? 'Press Enter to create with detected client or choose one'
      : `Press Enter to create this ${commandLabels[activeCommand.command]}`;

    return (
      <Box p="sm">
        <Group gap="sm" mb="xs">
          <Badge color="violet" variant="light" leftSection={activeCommand.icon}>
            {activeCommand.command}
          </Badge>
          <Text size="sm" c="dimmed">{activeCommand.description}</Text>
        </Group>
        <Stack gap="xs">
          <Select
            label="Template (optional)"
            placeholder="Select template"
            data={templateOptions}
            value={selectedTemplateId}
            onChange={(value) => {
              setSelectedTemplates((prev) => ({
                ...prev,
                [activeCommand.command]: value,
              }));
            }}
            clearable
            searchable
          />

          {hasInput ? (
            <UnstyledButton
              onClick={() => {
                void executeActiveCommand();
              }}
              p="sm"
              style={{
                borderRadius: 8,
                backgroundColor: 'var(--mantine-color-blue-light)',
                width: '100%',
              }}
            >
              <Group gap="sm">
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--mantine-color-green-1)',
                    color: 'var(--mantine-color-green-6)',
                  }}
                >
                  {isCreating ? <Loader size={20} /> : <IconPlus size={20} aria-hidden="true" />}
                </Box>
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500}>{actionLabel}</Text>
                  <Text size="xs" c="dimmed">{commandHelp}</Text>
                </div>
              </Group>
            </UnstyledButton>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Type {activeCommand.placeholder} or select a template
            </Text>
          )}

          {(parsed.detectedClient || parsed.detectedDate) && (
            <Box
              p="xs"
              style={{
                borderRadius: 8,
                backgroundColor: 'var(--mantine-color-gray-0)',
                border: '1px solid var(--mantine-color-gray-3)',
              }}
            >
              <Text size="xs" fw={600} c="dimmed" mb="xs">
                DETECTED:
              </Text>
              <Group gap="xs">
                {parsed.detectedClient && (
                  <Badge
                    variant="light"
                    color="green"
                    leftSection={<IconUser size={12} aria-hidden="true" />}
                  >
                    {parsed.detectedClient.name}
                  </Badge>
                )}
                {parsed.detectedDate && (
                  <Badge
                    variant="light"
                    color="blue"
                    leftSection={<IconCalendar size={12} aria-hidden="true" />}
                  >
                    {parsed.dateLabel} ({parsed.detectedDate.toLocaleDateString()})
                  </Badge>
                )}
              </Group>
            </Box>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      size="md"
      padding={0}
      withCloseButton={false}
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      transitionProps={{ transition: 'pop', duration: 150 }}
    >
      <Box>
        {pendingClientAction === null && (
          <Box p="md" pb={0}>
            <Group gap="xs" align="flex-end">
              <TextInput
                placeholder={activeCommand ? activeCommand.placeholder : "Type / for commands, or search..."}
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                leftSection={activeCommand ? activeCommand.icon : <IconSearch size={18} aria-hidden="true" />}
                size="md"
                autoFocus
                disabled={isCreating}
                style={{ flex: 1 }}
                styles={{
                  input: {
                    border: 'none',
                    fontSize: '16px',
                  },
                }}
              />
              {speechSupported && (
                <Tooltip label={isListening ? 'Stop voice input' : 'Start voice input'}>
                  <ActionIcon
                    onClick={toggleVoiceInput}
                    variant={isListening ? 'filled' : 'light'}
                    color={isListening ? 'red' : 'blue'}
                    size="lg"
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  >
                    {isListening ? (
                      <IconMicrophoneOff size={18} aria-hidden="true" />
                    ) : (
                      <IconMicrophone size={18} aria-hidden="true" />
                    )}
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Box>
        )}

        <ScrollArea.Autosize mah={350} p="xs">
          {pendingClientAction !== null ? (
            renderClientSelection()
          ) : activeCommand ? (
            renderActiveCommand()
          ) : showSlashSuggestions ? (
            <Stack gap={4}>
              {filteredSlashCommands.length === 0 ? (
                <Text c="dimmed" ta="center" py="md">
                  No matching commands
                </Text>
              ) : (
                filteredSlashCommands.map((cmd, index) => renderSlashCommandSuggestion(cmd, index))
              )}
            </Stack>
          ) : (
            <Stack gap={4}>
              {/* Show searched clients first */}
              {searchedClients.length > 0 && (
                <>
                  <Text size="xs" c="dimmed" fw={600} px="sm" pt="xs">
                    CLIENTS
                  </Text>
                  {searchedClients.map((client, index) => (
                    <UnstyledButton
                      key={`client-${client.id}`}
                      onClick={() => {
                        navigate(`/clients/${client.id}`);
                        close();
                      }}
                      p="sm"
                      style={{
                        borderRadius: 8,
                        backgroundColor: index === selectedIndex ? 'var(--mantine-color-blue-light)' : 'transparent',
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <Group gap="sm">
                        <Box
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--mantine-color-green-1)',
                            color: 'var(--mantine-color-green-6)',
                          }}
                        >
                          <IconUser size={20} aria-hidden="true" />
                        </Box>
                        <div style={{ flex: 1 }}>
                          <Text size="sm" fw={500}>
                            {client.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {client.email}
                          </Text>
                        </div>
                        <Badge size="xs" variant="light" color="green">
                          Client
                        </Badge>
                      </Group>
                    </UnstyledButton>
                  ))}
                </>
              )}

              {/* Show actions */}
              {filteredActions.length > 0 && (
                <>
                  {searchedClients.length > 0 && (
                    <Text size="xs" c="dimmed" fw={600} px="sm" pt="xs">
                      ACTIONS
                    </Text>
                  )}
                  {filteredActions.map((action, index) => {
                    const adjustedIndex = searchedClients.length + index;
                    return (
                      <UnstyledButton
                        key={action.id}
                        onClick={action.action}
                        p="sm"
                        style={{
                          borderRadius: 8,
                          backgroundColor: adjustedIndex === selectedIndex ? 'var(--mantine-color-blue-light)' : 'transparent',
                        }}
                        onMouseEnter={() => setSelectedIndex(adjustedIndex)}
                      >
                        <Group gap="sm">
                          <Box
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'var(--mantine-color-gray-1)',
                              color: 'var(--mantine-color-blue-6)',
                            }}
                          >
                            {action.icon}
                          </Box>
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500}>
                              {action.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {action.description}
                            </Text>
                          </div>
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </>
              )}

              {/* Show no results message */}
              {searchedClients.length === 0 && filteredActions.length === 0 && (
                <Text c="dimmed" ta="center" py="md">
                  No results found. Try typing / for commands.
                </Text>
              )}
            </Stack>
          )}
        </ScrollArea.Autosize>

        <Box
          p="xs"
          style={{
            borderTop: '1px solid var(--mantine-color-gray-3)',
            backgroundColor: 'var(--mantine-color-gray-0)',
          }}
        >
          <Group gap="lg" justify="center">
            <Group gap={4}>
              <Kbd size="xs">/</Kbd>
              <Text size="xs" c="dimmed">Commands</Text>
            </Group>
            <Group gap={4}>
              <Kbd size="xs">↑</Kbd>
              <Kbd size="xs">↓</Kbd>
              <Text size="xs" c="dimmed">Navigate</Text>
            </Group>
            <Group gap={4}>
              <Kbd size="xs">Enter</Kbd>
              <Text size="xs" c="dimmed">Select</Text>
            </Group>
            <Group gap={4}>
              <Kbd size="xs">Esc</Kbd>
              <Text size="xs" c="dimmed">Close</Text>
            </Group>
          </Group>
        </Box>
      </Box>
    </Modal>
  );
}
