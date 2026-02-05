import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Group,
  TextInput,
  Select,
  Button,
  Table,
  Badge,
  Checkbox,
  ActionIcon,
  Tooltip,
  Pagination,
  Stack,
  Text,
  Grid,
  Card,
  Loader,
  Menu,
  ScrollArea,
  Box,
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconCalendar,
  IconDots,
  IconRefresh,
  IconSquareCheck,
  IconCalendarTime,
  IconTrash,
  IconBell,
  IconPlus,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import { TaskSnoozeButton } from '../components/tasks/TaskSnoozeButton';
import TaskForm from '../components/tasks/TaskForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Task {
  id: string;
  text: string;
  description?: string;
  status: string;
  priority: string;
  type?: string;
  dueDate?: string;
  completedAt?: string;
  assignedTo?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
  subtasks?: Array<{ id: string; text: string; isCompleted: boolean }>;
  tags?: string[];
  reminderEnabled?: boolean;
  reminderTimes?: string[];
  reminderMessage?: string;
  snoozedUntil?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  recurringInterval?: number;
  recurringEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskStatistics {
  total: number;
  dueToday: number;
  overdue: number;
  completed: number;
  upcoming: number;
}

interface TasksResponse {
  tasks: Task[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const priorityColors: Record<string, string> = {
  LOW: 'gray',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

const statusColors: Record<string, string> = {
  TODO: 'gray',
  IN_PROGRESS: 'blue',
  COMPLETE: 'green',
};

const filterOptions = [
  { value: 'all', label: 'All Tasks' },
  { value: 'today', label: 'Due Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'assigned_to_me', label: 'Assigned to Me' },
  { value: 'unassigned', label: 'Unassigned' },
];

const priorityOptions = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const sortByOptions = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'text', label: 'Name' },
];

const sortDirectionOptions = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

export default function TasksDashboard() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();

  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statistics, setStatistics] = useState<TaskStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [taskFormOpened, setTaskFormOpened] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '50');
      params.append('sort_by', sortBy);
      params.append('sort_order', sortDirection);

      if (selectedFilter === 'assigned_to_me') {
        params.append('assigned_to', user?.id || '');
      } else if (selectedFilter === 'unassigned') {
        params.append('assigned_to', 'unassigned');
      } else if (selectedFilter !== 'all') {
        params.append('due_date', selectedFilter);
      }

      if (selectedPriority) {
        params.append('priority', selectedPriority);
      }

      if (selectedStatus) {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`${API_URL}/api/tasks?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data: TasksResponse = await response.json();
      setTasks(data.tasks);
      setPagination(data.pagination);
      setSelectedTasks(new Set()); // Clear selection on new fetch
    } catch (error) {
      console.error('Error fetching tasks:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load tasks',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/statistics`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data: TaskStatistics = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTasks();
    fetchStatistics();
  }, [selectedFilter, selectedPriority, selectedStatus, sortBy, sortDirection, page]);

  // Handle task status toggle
  const handleToggleTaskStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'COMPLETE' ? 'TODO' : 'COMPLETE';

      const response = await fetch(`${API_URL}/api/tasks/${task.id}/status`, {
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

      // Update local state
      setTasks(tasks.map(t =>
        t.id === task.id
          ? { ...t, status: newStatus, completedAt: newStatus === 'COMPLETE' ? new Date().toISOString() : undefined }
          : t
      ));

      // Refresh statistics
      fetchStatistics();

      notifications.show({
        title: 'Success',
        message: `Task marked as ${newStatus === 'COMPLETE' ? 'complete' : 'incomplete'}`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error toggling task status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update task status',
        color: 'red',
      });
    }
  };

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      setTasks(tasks.filter(t => t.id !== taskId));
      fetchStatistics();

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

  // Handle bulk actions
  const handleBulkAction = async (action: string, data?: any) => {
    if (selectedTasks.size === 0) {
      notifications.show({
        title: 'Warning',
        message: 'Please select at least one task',
        color: 'yellow',
      });
      return;
    }

    setBulkLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/tasks/bulk`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          taskIds: Array.from(selectedTasks),
          action,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform bulk action');
      }

      await fetchTasks();
      fetchStatistics();
      setSelectedTasks(new Set());

      notifications.show({
        title: 'Success',
        message: `Bulk action completed successfully`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error performing bulk action:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to perform bulk action',
        color: 'red',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Check if task is overdue
  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === 'COMPLETE') return false;
    return new Date(task.dueDate) < new Date();
  };

  // Filter tasks by search query
  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.text.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.client?.name.toLowerCase().includes(query)
    );
  });

  // Statistics cards
  const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <Paper p="md" radius="md" withBorder style={{ height: '100%' }}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
            {label}
          </Text>
          <Text size="xl" fw={700} mt="xs">
            {value}
          </Text>
        </div>
        <Box
          p="xs"
          style={{
            backgroundColor: `${color}15`,
            borderRadius: '8px',
          }}
        >
          <Icon size={24} color={color} />
        </Box>
      </Group>
    </Paper>
  );

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Title order={2}>Tasks Dashboard</Title>
          <Group gap="xs">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingTask(undefined);
                setTaskFormOpened(true);
              }}
            >
              New Task
            </Button>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => { fetchTasks(); fetchStatistics(); }}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        {/* Statistics Cards */}
        {statistics && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
              <StatCard
                label="Total Tasks"
                value={statistics.total}
                icon={IconSquareCheck}
                color="#228be6"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
              <StatCard
                label="Due Today"
                value={statistics.dueToday}
                icon={IconClock}
                color="#fa5252"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
              <StatCard
                label="Overdue"
                value={statistics.overdue}
                icon={IconAlertCircle}
                color="#fa5252"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
              <StatCard
                label="Upcoming"
                value={statistics.upcoming}
                icon={IconCalendar}
                color="#fab005"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
              <StatCard
                label="Completed"
                value={statistics.completed}
                icon={IconCheck}
                color="#40c057"
              />
            </Grid.Col>
          </Grid>
        )}

        {/* Filters and Controls */}
        <Paper p="md" radius="md" withBorder>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                placeholder="Search tasks..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 2 }}>
              <Select
                leftSection={<IconFilter size={16} />}
                placeholder="Filter"
                data={filterOptions}
                value={selectedFilter}
                onChange={(value) => {
                  setSelectedFilter(value || 'all');
                  setPage(1);
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 2 }}>
              <Select
                placeholder="Priority"
                data={priorityOptions}
                value={selectedPriority}
                onChange={(value) => {
                  setSelectedPriority(value || '');
                  setPage(1);
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 2 }}>
              <Select
                placeholder="Status"
                data={[
                  { value: '', label: 'All Statuses' },
                  { value: 'TODO', label: 'To Do' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'COMPLETE', label: 'Complete' },
                ]}
                value={selectedStatus}
                onChange={(value) => {
                  setSelectedStatus(value || '');
                  setPage(1);
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 2 }}>
              <Select
                placeholder="Sort by"
                data={sortByOptions}
                value={sortBy}
                onChange={(value) => setSortBy(value || 'createdAt')}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Bulk Actions */}
        {selectedTasks.size > 0 && (
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
            <Group justify="space-between">
              <Text size="sm">
                {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
              </Text>
              <Group gap="xs">
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconCheck size={14} />}
                  loading={bulkLoading}
                  onClick={() => handleBulkAction('mark_complete')}
                >
                  Mark Complete
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconCalendarTime size={14} />}
                  loading={bulkLoading}
                  onClick={() => handleBulkAction('snooze', { days: 1 })}
                >
                  Snooze 1 Day
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconCalendarTime size={14} />}
                  loading={bulkLoading}
                  onClick={() => handleBulkAction('snooze', { days: 7 })}
                >
                  Snooze 7 Days
                </Button>
              </Group>
            </Group>
          </Paper>
        )}

        {/* Tasks Table */}
        <Paper p="md" radius="md" withBorder>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox
                      checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                      indeterminate={selectedTasks.size > 0 && selectedTasks.size < filteredTasks.length}
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
                        } else {
                          setSelectedTasks(new Set());
                        }
                      }}
                    />
                  </Table.Th>
                  <Table.Th>Task</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Due Date</Table.Th>
                  <Table.Th>Reminders</Table.Th>
                  <Table.Th>Assigned To</Table.Th>
                  <Table.Th w={80}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Center py="xl">
                        <Loader size="md" />
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : filteredTasks.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Center py="xl">
                        <Text c="dimmed">No tasks found</Text>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredTasks.map((task) => (
                    <Table.Tr
                      key={task.id}
                      style={{
                        opacity: task.status === 'COMPLETE' ? 0.6 : 1,
                      }}
                    >
                      <Table.Td>
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedTasks);
                            if (e.currentTarget.checked) {
                              newSelected.add(task.id);
                            } else {
                              newSelected.delete(task.id);
                            }
                            setSelectedTasks(newSelected);
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={500} size="sm">
                            {task.text}
                          </Text>
                          {task.description && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {task.description}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        {task.client ? (
                          <Button
                            variant="subtle"
                            size="xs"
                            onClick={() => navigate(`/clients/${task.client.id}`)}
                          >
                            {task.client.name}
                          </Button>
                        ) : (
                          <Text c="dimmed" size="sm">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={priorityColors[task.priority]} size="sm">
                          {task.priority}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={statusColors[task.status]}
                          variant="light"
                          size="sm"
                          leftSection={
                            task.status === 'COMPLETE' ? (
                              <IconCheck size={12} />
                            ) : null
                          }
                        >
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Text size="sm">
                            {formatDate(task.dueDate)}
                          </Text>
                          {isOverdue(task) && (
                            <Tooltip label="Overdue">
                              <IconAlertCircle
                                size={14}
                                color="red"
                                style={{ display: 'block' }}
                              />
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {task.reminderEnabled ? (
                          <Tooltip label={`Reminders enabled (${task.reminderTimes?.length || 0} reminder(s))`}>
                            <Group gap={4}>
                              <IconBell size={16} color="blue" style={{ display: 'block' }} />
                              <Text size="xs" c="blue">
                                {task.reminderTimes?.length || 0}
                              </Text>
                            </Group>
                          </Tooltip>
                        ) : (
                          <Text c="dimmed" size="sm">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {task.assignedTo?.name || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="Toggle Complete">
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color={task.status === 'COMPLETE' ? 'yellow' : 'green'}
                              onClick={() => handleToggleTaskStatus(task)}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {task.dueDate && task.status !== 'COMPLETE' && (
                            <TaskSnoozeButton
                              taskId={task.id}
                              onSnooze={fetchTasks}
                            />
                          )}
                          <Menu shadow="md" width={200} position="bottom-end">
                            <Menu.Target>
                              <ActionIcon size="sm" variant="subtle">
                                <IconDots size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconTrash size={14} />}
                                color="red"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                Delete Task
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={pagination.totalPages}
                value={page}
                onChange={setPage}
                size="sm"
              />
            </Group>
          )}
        </Paper>

        {/* Task Form Modal */}
        <TaskForm
          opened={taskFormOpened}
          onClose={() => setTaskFormOpened(false)}
          onSuccess={() => {
            fetchTasks();
            fetchStatistics();
          }}
          editTask={editingTask}
        />
      </Stack>
    </Container>
  );
}

// Helper Center component
const Center = ({ children, py }: { children: React.ReactNode; py?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: py }}>
    {children}
  </div>
);
