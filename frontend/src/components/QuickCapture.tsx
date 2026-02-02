import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../utils/apiBase';

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

interface SlashCommand {
  command: string;
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
];

export function QuickCapture() {
  const [opened, { open, close }] = useDisclosure(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  // Note creation with client selection
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Check if query is a slash command
  const activeCommand = slashCommands.find(cmd => query.toLowerCase().startsWith(cmd.command));
  const commandContent = activeCommand ? query.slice(activeCommand.command.length).trim() : '';

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

  // Fetch clients when entering note client selection mode
  const fetchClients = async () => {
    setIsLoadingClients(true);
    try {
      const response = await fetch(`${API_URL}/clients`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  // Create task via API with optional client and due date
  const createTask = async (text: string, clientId?: string, dueDate?: Date) => {
    if (!text.trim()) return;

    setIsCreating(true);
    try {
      const taskData: Record<string, unknown> = {
        text: text.trim(),
        status: 'TODO',
        priority: 'MEDIUM',
      };

      if (clientId) {
        taskData.clientId = clientId;
      }

      if (dueDate) {
        taskData.dueDate = dueDate.toISOString();
      }

      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const clientName = clientId ? clients.find(c => c.id === clientId)?.name : null;
      const dueDateStr = dueDate ? dueDate.toLocaleDateString() : null;

      let message = `"${text.trim()}" has been added to your tasks`;
      if (clientName && dueDateStr) {
        message = `Task created for ${clientName}, due ${dueDateStr}`;
      } else if (clientName) {
        message = `Task created for ${clientName}`;
      } else if (dueDateStr) {
        message = `Task created, due ${dueDateStr}`;
      }

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
        message: 'Failed to create task. Please try again.',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Create note via API
  const createNote = async (text: string, clientId: string) => {
    if (!text.trim() || !clientId) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId,
          text: text.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const client = clients.find(c => c.id === clientId);
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
        message: 'Failed to create note. Please try again.',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Start note creation - show client selector
  const startNoteCreation = (content: string) => {
    setNoteContent(content);
    setClientSearchQuery('');
    setSelectedIndex(0);
    fetchClients();
  };

  // Go back from client selection to note input
  const cancelClientSelection = () => {
    setNoteContent(null);
    setClientSearchQuery('');
    setSelectedIndex(0);
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
      setNoteContent(null);
      setClientSearchQuery('');
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

  // Handle keyboard navigation within the modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle client selection mode for notes
    if (noteContent !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredClients.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredClients[selectedIndex]) {
          createNote(noteContent, filteredClients[selectedIndex].id);
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

      // Handle slash command execution
      if (activeCommand) {
        if (activeCommand.command === '/task' && commandContent) {
          const parsed = parseNaturalLanguageTask(commandContent, clients);
          createTask(
            commandContent,
            parsed.detectedClient?.id,
            parsed.detectedDate || undefined
          );
        } else if (activeCommand.command === '/note' && commandContent) {
          startNoteCreation(commandContent);
        }
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

  // Render client selection for note
  const renderClientSelection = () => {
    return (
      <Box p="sm">
        <Group gap="sm" mb="xs">
          <UnstyledButton onClick={cancelClientSelection}>
            <IconArrowLeft size={16} aria-hidden="true" />
          </UnstyledButton>
          <Badge color="violet" variant="light" leftSection={<IconNotes size={14} aria-hidden="true" />}>
            /note
          </Badge>
          <Text size="sm" c="dimmed" style={{ flex: 1 }} lineClamp={1}>
            "{noteContent}"
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
                onClick={() => createNote(noteContent!, client.id)}
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

    // Parse natural language for /task command
    const parsedTask = activeCommand.command === '/task' && commandContent
      ? parseNaturalLanguageTask(commandContent, clients)
      : null;

    return (
      <Box p="sm">
        <Group gap="sm" mb="xs">
          <Badge color="violet" variant="light" leftSection={activeCommand.icon}>
            {activeCommand.command}
          </Badge>
          <Text size="sm" c="dimmed">{activeCommand.description}</Text>
        </Group>
        {commandContent ? (
          <Stack gap="xs">
            <UnstyledButton
              onClick={() => {
                if (activeCommand.command === '/task') {
                  createTask(
                    commandContent,
                    parsedTask?.detectedClient?.id,
                    parsedTask?.detectedDate || undefined
                  );
                } else if (activeCommand.command === '/note') {
                  startNoteCreation(commandContent);
                }
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
                  <Text size="sm" fw={500}>
                    Create: "{commandContent}"
                  </Text>
                  <Text size="xs" c="dimmed">
                    Press Enter to {activeCommand.command === '/note' ? 'select client' : `create this ${activeCommand.command.slice(1)}`}
                  </Text>
                </div>
              </Group>
            </UnstyledButton>

            {/* Show detected entities for /task command */}
            {parsedTask && (parsedTask.detectedClient || parsedTask.detectedDate) && (
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
                  {parsedTask.detectedClient && (
                    <Badge
                      variant="light"
                      color="green"
                      leftSection={<IconUser size={12} aria-hidden="true" />}
                    >
                      {parsedTask.detectedClient.name}
                    </Badge>
                  )}
                  {parsedTask.detectedDate && (
                    <Badge
                      variant="light"
                      color="blue"
                      leftSection={<IconCalendar size={12} aria-hidden="true" />}
                    >
                      {parsedTask.dateLabel} ({parsedTask.detectedDate.toLocaleDateString()})
                    </Badge>
                  )}
                </Group>
              </Box>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="md">
            Type {activeCommand.placeholder}
          </Text>
        )}
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
        {noteContent === null && (
          <Box p="md" pb={0}>
            <TextInput
              placeholder={activeCommand ? activeCommand.placeholder : "Type / for commands, or search..."}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              leftSection={activeCommand ? activeCommand.icon : <IconSearch size={18} aria-hidden="true" />}
              size="md"
              autoFocus
              disabled={isCreating}
              styles={{
                input: {
                  border: 'none',
                  fontSize: '16px',
                },
              }}
            />
          </Box>
        )}

        <ScrollArea.Autosize mah={350} p="xs">
          {noteContent !== null ? (
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
