import React, { useState } from 'react';
import {
  Container,
  Title,
  Group,
  Button,
  Stack,
  Text,
  Badge,
  Card,
  Select,
  TextInput,
  Grid,
  ActionIcon,
  Menu,
  Box,
  Flex,
  Progress,
  ThemeIcon,
  Tooltip,
  Checkbox,
  ScrollArea,
  LoadingOverlay,
  Paper,
  Center,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconBell,
  IconBellRinging,
  IconCheck,
  IconX,
  IconClock,
  IconCalendar,
  IconDots,
  IconPlus,
  IconRefresh,
  IconFilter,
  IconSearch,
  IconTrendingUp,
  IconAlertTriangle,
  IconCircleCheck,
  IconTrash,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';
import ReminderForm from '../components/reminders/ReminderForm';
import ReminderWidget from '../components/reminders/ReminderWidget';
import { MobileReminderCard } from '../components/reminders/MobileReminderCard';
import { SimpleFab } from '../components/common/MobileFloatingActionButton';
import type { Reminder, ReminderStats } from '../types';

const RemindersDashboard: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const queryClient = useQueryClient();
  const [selectedReminders, setSelectedReminders] = useState<Set<string>>(new Set());

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const categories = ['GENERAL', 'CLIENT', 'COMPLIANCE', 'CLOSING', 'FOLLOW_UP'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const statuses = ['PENDING', 'SNOOZED', 'COMPLETED', 'DISMISSED'];

  const { data: reminders = [], isLoading: loading } = useQuery({
    queryKey: ['reminders', statusFilter, categoryFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      const response = await api.get(`/reminders?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch reminders');
      return response.json() as Promise<Reminder[]>;
    },
  });

  const { data: stats = null } = useQuery({
    queryKey: ['reminder-stats'],
    queryFn: async () => {
      const response = await api.get('/reminders/stats/summary');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<ReminderStats>;
    },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['reminders'] });
    queryClient.invalidateQueries({ queryKey: ['reminder-stats'] });
  };

  const handleComplete = async (reminderId: string) => {
    try {
      const response = await api.post(`/reminders/${reminderId}/complete`);
      if (!response.ok) {
        throw new Error('Failed to complete reminder');
      }
      notifications.show({
        title: 'Success',
        message: 'Reminder marked as complete',
        color: 'green',
      });
      refreshAll();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to complete reminder',
        color: 'red',
      });
    }
  };

  const handleDismiss = async (reminderId: string) => {
    try {
      const response = await api.post(`/reminders/${reminderId}/dismiss`);
      if (!response.ok) {
        throw new Error('Failed to dismiss reminder');
      }
      notifications.show({
        title: 'Success',
        message: 'Reminder dismissed',
        color: 'blue',
      });
      refreshAll();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to dismiss reminder',
        color: 'red',
      });
    }
  };

  const handleSnooze = async (reminderId: string, minutes: number = 15) => {
    try {
      const response = await api.post(`/reminders/${reminderId}/snooze`, { minutes });
      if (!response.ok) {
        throw new Error('Failed to snooze reminder');
      }
      notifications.show({
        title: 'Success',
        message: `Reminder snoozed for ${minutes} minutes`,
        color: 'blue',
      });
      refreshAll();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to snooze reminder',
        color: 'red',
      });
    }
  };

  const handleDelete = async (reminderId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this reminder?');
    if (!confirmed) return;

    try {
      const response = await api.delete(`/reminders/${reminderId}`);
      if (!response.ok) {
        throw new Error('Failed to delete reminder');
      }
      notifications.show({
        title: 'Success',
        message: 'Reminder deleted',
        color: 'green',
      });
      refreshAll();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete reminder',
        color: 'red',
      });
    }
  };

  const handleBulkAction = async (action: 'complete' | 'dismiss' | 'delete') => {
    if (selectedReminders.size === 0) return;

    try {
      const response = await api.post('/reminders/bulk', {
        action,
        reminderIds: Array.from(selectedReminders),
      });
      if (!response.ok) {
        throw new Error(`Failed to ${action} reminders`);
      }
      notifications.show({
        title: 'Success',
        message: `${action.charAt(0).toUpperCase() + action.slice(1)}d ${selectedReminders.size} reminder(s)`,
        color: 'green',
      });
      setSelectedReminders(new Set());
      refreshAll();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Failed to ${action} reminders`,
        color: 'red',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'gray';
      default: return 'blue';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'CLIENT': return 'blue';
      case 'COMPLIANCE': return 'red';
      case 'CLOSING': return 'green';
      case 'FOLLOW_UP': return 'yellow';
      default: return 'gray';
    }
  };

  const isOverdue = (remindAt: string, status: string) => {
    return new Date(remindAt) < new Date() && status !== 'COMPLETED' && status !== 'DISMISSED';
  };

  const filteredReminders = reminders;

  return (
    <Container size={isMobile ? 'sm' : 'xl'} py={isMobile ? 'xs' : 'md'}>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={isMobile ? 'md' : 'lg'} radius="md" variant="light" color="blue">
              <IconBell size={isMobile ? 20 : 24} />
            </ThemeIcon>
            <div>
              <Title order={isMobile ? 4 : 2}>Reminders</Title>
              {!isMobile && (
                <Text size="sm" c="dimmed">
                  Time-sensitive notifications and follow-ups
                </Text>
              )}
            </div>
          </Group>
          <Group>
            {!isMobile && (
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={refreshAll}
              >
                Refresh
              </Button>
            )}
            {!isMobile && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setShowCreateModal(true)}
              >
                New Reminder
              </Button>
            )}
            {isMobile && (
              <ActionIcon
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
        {stats && !isMobile && (
          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card padding="md" radius="md" withBorder>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Total
                    </Text>
                    <Text size="xl" fw={500} mt="xs">
                      {stats.total}
                    </Text>
                  </div>
                  <ThemeIcon color="blue" size={36} radius="md">
                    <IconBell size={20} />
                  </ThemeIcon>
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card padding="md" radius="md" withBorder>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Pending
                    </Text>
                    <Text size="xl" fw={500} mt="xs">
                      {stats.pending}
                    </Text>
                  </div>
                  <ThemeIcon color="yellow" size={36} radius="md">
                    <IconClock size={20} />
                  </ThemeIcon>
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card padding="md" radius="md" withBorder>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Overdue
                    </Text>
                    <Text size="xl" fw={500} mt="xs" c="red">
                      {stats.overdue}
                    </Text>
                  </div>
                  <ThemeIcon color="red" size={36} radius="md">
                    <IconAlertTriangle size={20} />
                  </ThemeIcon>
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card padding="md" radius="md" withBorder>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Completed
                    </Text>
                    <Text size="xl" fw={500} mt="xs" c="green">
                      {stats.completed}
                    </Text>
                  </div>
                  <ThemeIcon color="green" size={36} radius="md">
                    <IconCircleCheck size={20} />
                  </ThemeIcon>
                </Group>
              </Card>
            </Grid.Col>
          </Grid>
        )}

        {/* Filters */}
        <Card padding="md" radius="md" withBorder>
          <Group wrap="wrap" gap="sm">
            <TextInput
              placeholder="Search reminders..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              placeholder="Filter by status"
              leftSection={<IconFilter size={16} />}
              data={[
                { value: 'all', label: 'All Statuses' },
                ...statuses.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || 'all')}
              clearable
              style={{ minWidth: 150 }}
            />
            <Select
              placeholder="Filter by category"
              data={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((c) => ({ value: c, label: c.charAt(0) + c.slice(1).toLowerCase() })),
              ]}
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v || 'all')}
              clearable
              style={{ minWidth: 150 }}
            />
            <Select
              placeholder="Filter by priority"
              data={[
                { value: 'all', label: 'All Priorities' },
                ...priorities.map((p) => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() })),
              ]}
              value={priorityFilter}
              onChange={(v) => setPriorityFilter(v || 'all')}
              clearable
              style={{ minWidth: 150 }}
            />
          </Group>

          {/* Bulk actions */}
          {selectedReminders.size > 0 && (
            <Group mt="sm" gap="sm">
              <Text size="sm" c="dimmed">
                {selectedReminders.size} selected
              </Text>
              <Button
                size="xs"
                variant="light"
                color="green"
                leftSection={<IconCheck size={14} />}
                onClick={() => handleBulkAction('complete')}
              >
                Complete All
              </Button>
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconClock size={14} />}
                onClick={() => handleBulkAction('dismiss')}
              >
                Dismiss All
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconX size={14} />}
                onClick={() => handleBulkAction('delete')}
              >
                Delete All
              </Button>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setSelectedReminders(new Set())}
              >
                Clear Selection
              </Button>
            </Group>
          )}
        </Card>

        {/* Reminders List */}
        <Card padding="md" radius="md" withBorder>
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
          <Stack gap="sm">
            {filteredReminders.length === 0 ? (
              <Box py="xl" ta="center">
                <ThemeIcon size={64} radius="md" variant="light" color="gray" mb="md">
                  <IconBell size={32} />
                </ThemeIcon>
                <Text size="lg" fw={500} mb="xs">
                  No reminders found
                </Text>
                <Text size="sm" c="dimmed">
                  {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first reminder to get started'}
                </Text>
                {!searchQuery && statusFilter === 'all' && categoryFilter === 'all' && priorityFilter === 'all' && (
                  <Button mt="md" leftSection={<IconPlus size={16} />} onClick={() => setShowCreateModal(true)}>
                    Create Reminder
                  </Button>
                )}
              </Box>
            ) : (
              <ScrollArea.Autosize mah={600}>
                <Stack gap="sm">
                  {filteredReminders.map((reminder) => (
                    <Card
                      key={reminder.id}
                      padding="sm"
                      radius="md"
                      withBorder
                      styles={{
                        root: {
                          borderColor: isOverdue(reminder.remindAt, reminder.status) ? 'var(--mantine-color-red-5)' : undefined,
                          borderWidth: isOverdue(reminder.remindAt, reminder.status) ? '2px' : '1px',
                        },
                      }}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Group wrap="nowrap" gap="sm" style={{ flex: 1 }}>
                          <Checkbox
                            checked={selectedReminders.has(reminder.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedReminders);
                              if (e.currentTarget.checked) {
                                newSet.add(reminder.id);
                              } else {
                                newSet.delete(reminder.id);
                              }
                              setSelectedReminders(newSet);
                            }}
                          />

                          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" wrap="wrap">
                              <Text fw={500} lineClamp={1}>
                                {reminder.title}
                              </Text>
                              <Badge size="xs" color={getPriorityColor(reminder.priority)}>
                                {reminder.priority}
                              </Badge>
                              <Badge size="xs" color={getCategoryColor(reminder.category)}>
                                {reminder.category.replace('_', ' ')}
                              </Badge>
                              {isOverdue(reminder.remindAt, reminder.status) && (
                                <Badge size="xs" color="red" variant="filled">
                                  Overdue
                                </Badge>
                              )}
                              {reminder.status === 'SNOOZED' && (
                                <Badge size="xs" color="blue" variant="filled">
                                  Snoozed
                                </Badge>
                              )}
                              {reminder.isRecurring && (
                                <Badge size="xs" color="grape" variant="light">
                                  Recurring
                                </Badge>
                              )}
                            </Group>

                            {reminder.description && (
                              <Text size="sm" c="dimmed" lineClamp={2}>
                                {reminder.description}
                              </Text>
                            )}

                            <Group gap="xs" mt="xs">
                              <Group gap={4} c="dimmed">
                                <IconCalendar size={14} />
                                <Text size="xs">
                                  {new Date(reminder.remindAt).toLocaleDateString()} at{' '}
                                  {new Date(reminder.remindAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                              </Group>
                              {reminder.client?.id && (
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => navigate(`/clients/${reminder.client!.id}`)}
                                >
                                  {reminder.client?.name || 'Client'}
                                </Button>
                              )}
                              {reminder.snoozeCount > 0 && (
                                <Text size="xs" c="dimmed">
                                  Snoozed {reminder.snoozeCount}x
                                </Text>
                              )}
                            </Group>
                          </Stack>
                        </Group>

                        <Menu position="bottom-end" shadow="md">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                              <IconDots size={18} />
                            </ActionIcon>
                          </Menu.Target>

                          <Menu.Dropdown>
                            {reminder.status !== 'COMPLETED' && reminder.status !== 'DISMISSED' && (
                              <>
                                <Menu.Item
                                  leftSection={<IconCheck size={16} color="green" />}
                                  onClick={() => handleComplete(reminder.id)}
                                >
                                  Complete
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconClock size={16} color="blue" />}
                                  onClick={() => handleSnooze(reminder.id, 15)}
                                >
                                  Snooze 15 min
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconClock size={16} color="blue" />}
                                  onClick={() => handleSnooze(reminder.id, 60)}
                                >
                                  Snooze 1 hour
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconClock size={16} color="blue" />}
                                  onClick={() => handleSnooze(reminder.id, 1440)}
                                >
                                  Snooze 1 day
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconX size={16} color="gray" />}
                                  onClick={() => handleDismiss(reminder.id)}
                                >
                                  Dismiss
                                </Menu.Item>
                                <Menu.Item
                                  onClick={() => setEditingReminder(reminder)}
                                >
                                  Edit
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={16} />}
                                  onClick={() => handleDelete(reminder.id)}
                                >
                                  Delete
                                </Menu.Item>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Stack>
        </Card>
      </Stack>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingReminder) && (
        <ReminderForm
          opened={showCreateModal || !!editingReminder}
          onClose={() => {
            setShowCreateModal(false);
            setEditingReminder(null);
          }}
          onSuccess={() => {
            refreshAll();
            setShowCreateModal(false);
            setEditingReminder(null);
          }}
          reminder={editingReminder}
        />
      )}
    </Container>
  );
};

export default RemindersDashboard;
