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
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

const slashCommands: SlashCommand[] = [
  {
    command: '/task',
    label: 'Create Task',
    description: 'Create a new task',
    icon: <IconChecklist size={20} />,
    placeholder: 'Task description...',
  },
  {
    command: '/note',
    label: 'Create Note',
    description: 'Create a quick note',
    icon: <IconNotes size={20} />,
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

  // Check if query is a slash command
  const activeCommand = slashCommands.find(cmd => query.toLowerCase().startsWith(cmd.command));
  const commandContent = activeCommand ? query.slice(activeCommand.command.length).trim() : '';

  // Define quick actions
  const actions: QuickAction[] = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      description: 'View your dashboard',
      icon: <IconDashboard size={20} />,
      action: () => { navigate('/'); close(); },
      keywords: ['home', 'main', 'dashboard'],
    },
    {
      id: 'clients',
      label: 'Go to Clients',
      description: 'View all clients',
      icon: <IconUsers size={20} />,
      action: () => { navigate('/clients'); close(); },
      keywords: ['clients', 'customers', 'contacts'],
    },
    {
      id: 'add-client',
      label: 'Add New Client',
      description: 'Create a new client',
      icon: <IconPlus size={20} />,
      action: () => { navigate('/clients?action=add'); close(); },
      keywords: ['add', 'new', 'create', 'client'],
    },
    {
      id: 'pipeline',
      label: 'Go to Pipeline',
      description: 'View loan pipeline',
      icon: <IconLayoutKanban size={20} />,
      action: () => { navigate('/pipeline'); close(); },
      keywords: ['pipeline', 'kanban', 'board', 'loans'],
    },
    {
      id: 'notes',
      label: 'Go to Notes',
      description: 'View all notes',
      icon: <IconNotes size={20} />,
      action: () => { navigate('/notes'); close(); },
      keywords: ['notes', 'memo', 'journal'],
    },
    {
      id: 'documents',
      label: 'Go to Documents',
      description: 'View all documents',
      icon: <IconFileText size={20} />,
      action: () => { navigate('/documents'); close(); },
      keywords: ['documents', 'files', 'uploads'],
    },
    {
      id: 'calculator',
      label: 'Go to Calculator',
      description: 'Open loan calculator',
      icon: <IconCalculator size={20} />,
      action: () => { navigate('/calculator'); close(); },
      keywords: ['calculator', 'calc', 'math', 'loan'],
    },
    {
      id: 'analytics',
      label: 'Go to Analytics',
      description: 'View analytics',
      icon: <IconChartBar size={20} />,
      action: () => { navigate('/analytics'); close(); },
      keywords: ['analytics', 'reports', 'stats', 'charts'],
    },
    {
      id: 'settings',
      label: 'Go to Settings',
      description: 'Manage settings',
      icon: <IconSettings size={20} />,
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

  // Create task via API
  const createTask = async (text: string) => {
    if (!text.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          text: text.trim(),
          status: 'TODO',
          priority: 'MEDIUM',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      notifications.show({
        title: 'Task Created',
        message: `"${text.trim()}" has been added to your tasks`,
        color: 'green',
        icon: <IconCheck size={16} />,
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

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset query when modal opens/closes
  useEffect(() => {
    if (opened) {
      setQuery('');
      setSelectedIndex(0);
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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = activeCommand ? 0 : (showSlashSuggestions ? filteredSlashCommands.length - 1 : filteredActions.length - 1);
      setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();

      // Handle slash command execution
      if (activeCommand) {
        if (activeCommand.command === '/task' && commandContent) {
          createTask(commandContent);
        } else if (activeCommand.command === '/note' && commandContent) {
          // Note creation could be implemented similarly
          notifications.show({
            title: 'Coming Soon',
            message: 'Quick note creation will be available soon',
            color: 'blue',
          });
        }
        return;
      }

      // Handle slash command selection
      if (showSlashSuggestions && filteredSlashCommands[selectedIndex]) {
        setQuery(filteredSlashCommands[selectedIndex].command + ' ');
        return;
      }

      // Handle regular action
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
      }
    }
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

    return (
      <Box p="sm">
        <Group gap="sm" mb="xs">
          <Badge color="violet" variant="light" leftSection={activeCommand.icon}>
            {activeCommand.command}
          </Badge>
          <Text size="sm" c="dimmed">{activeCommand.description}</Text>
        </Group>
        {commandContent ? (
          <UnstyledButton
            onClick={() => {
              if (activeCommand.command === '/task') {
                createTask(commandContent);
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
                {isCreating ? <Loader size={20} /> : <IconPlus size={20} />}
              </Box>
              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500}>
                  Create: "{commandContent}"
                </Text>
                <Text size="xs" c="dimmed">
                  Press Enter to create this {activeCommand.command.slice(1)}
                </Text>
              </div>
            </Group>
          </UnstyledButton>
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
        <Box p="md" pb={0}>
          <TextInput
            placeholder={activeCommand ? activeCommand.placeholder : "Type / for commands, or search..."}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            leftSection={activeCommand ? activeCommand.icon : <IconSearch size={18} />}
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

        <ScrollArea.Autosize mah={300} p="xs">
          {activeCommand ? (
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
              {filteredActions.length === 0 ? (
                <Text c="dimmed" ta="center" py="md">
                  No results found. Try typing / for commands.
                </Text>
              ) : (
                filteredActions.map((action, index) => (
                  <UnstyledButton
                    key={action.id}
                    onClick={action.action}
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
                ))
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
