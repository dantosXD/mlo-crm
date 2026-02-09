import { useState } from 'react';
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
  Center,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import { api } from '../utils/api';
import { TaskSnoozeButton } from '../components/tasks/TaskSnoozeButton';
import TaskForm from '../components/tasks/TaskForm';
import { MobileTaskCard } from '../components/tasks/MobileTaskCard';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { SimpleFab } from '../components/common/MobileFloatingActionButton';
import { PRIORITY_COLORS } from '../utils/constants';
import type { Task, TaskStatistics, TasksResponse } from '../types';

const priorityColors = PRIORITY_COLORS;

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
  const { user } = useAuthStore();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // State
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [taskFormOpened, setTaskFormOpened] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: tasksData, isLoading: loading } = useQuery({
    queryKey: ['tasks', selectedFilter, selectedPriority, selectedStatus, sortBy, sortDirection, page],
    queryFn: async () => {
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
      if (selectedPriority) params.append('priority', selectedPriority);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await api.get(`/tasks?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data: TasksResponse = await response.json();
      setSelectedTasks(new Set());
      return data;
    },
  });

  const tasks = tasksData?.tasks ?? [];
  const pagination = tasksData?.pagination ?? { total: 0, page: 1, limit: 50, totalPages: 0 };

  const { data: statistics = null } = useQuery({
    queryKey: ['task-statistics'],
    queryFn: async () => {
      const response = await api.get('/tasks/statistics');
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json() as Promise<TaskStatistics>;
    },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['task-statistics'] });
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      refreshAll();
      await new Promise(r => setTimeout(r, 500));
    } finally {
      setRefreshing(false);
    }
  };

  // Handle task status toggle
  const handleToggleTaskStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'COMPLETE' ? 'TODO' : 'COMPLETE';

      const response = await api.patch(`/tasks/${task.id}/status`, { status: newStatus });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      // Update local state
      // Refresh tasks and statistics
      refreshAll();

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
      const response = await api.delete(`/tasks/${taskId}`);

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      refreshAll();

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
      const response = await api.patch('/tasks/bulk', {
          taskIds: Array.from(selectedTasks),
          action,
          data,
        });

      if (!response.ok) {
        throw new Error('Failed to perform bulk action');
      }

      refreshAll();
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
  const formatDate = (dateString?: string | null) => {
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
      (task.client?.name ? task.client.name.toLowerCase().includes(query) : false)
    );
  });

  // Statistics cards
  function StatCard({ label, value, icon: Icon, color }: any) {
    return (
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
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Container size={isMobile ? 'sm' : 'xl'} py={isMobile ? 'xs' : 'md'}>
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between">
            <Title order={isMobile ? 3 : 2}>Tasks Dashboard</Title>
            <Group gap="xs">
              {!isMobile && (
                <>
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
                    onClick={refreshAll}
                  >
                    Refresh
                  </Button>
                </>
              )}
              {isMobile && (
                <ActionIcon
                  size="lg"
                  variant="light"
                  onClick={refreshAll}
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <IconRefresh size={20} />
                </ActionIcon>
              )}
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
                        {task.client?.id ? (
                          <Button
                            variant="subtle"
                            size="xs"
                            onClick={() => navigate(`/clients/${task.client!.id}`)}
                          >
                            {task.client?.name || 'Client'}
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
                              onSnooze={refreshAll}
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
          onSuccess={refreshAll}
          editTask={editingTask}
        />
      </Stack>
    </Container>
    </PullToRefresh>
  );
}
