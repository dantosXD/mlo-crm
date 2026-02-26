import React, { useState } from 'react';
import {
  Container,
  Title,
  Stack,
  Paper,
  Grid,
  Text,
  Badge,
  Card,
  Group,
  Button,
  ThemeIcon,
  ActionIcon,
  ScrollArea,
  Loader,
  Alert,
} from '@mantine/core';
import {
  IconCalendar,
  IconCheckbox,
  IconBell,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconRefresh,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import api, { apiRequest } from '../utils/api';

interface TodayData {
  tasks: Array<{
    id: string;
    text: string;
    description?: string;
    priority: string;
    dueDate: string;
    status: string;
    client?: { id: string; nameEncrypted: string; name?: string };
  }>;
  events: Array<{
    id: string;
    title: string;
    description?: string;
    eventType: string;
    startTime: string;
    endTime?: string;
    allDay: boolean;
    location?: string;
    client?: { id: string; nameEncrypted: string; name?: string };
  }>;
  reminders: Array<{
    id: string;
    title: string;
    description?: string;
    priority: string;
    remindAt: string;
    category: string;
    client?: { id: string; nameEncrypted: string; name?: string };
  }>;
  statistics: {
    totalTasks: number;
    overdueTasks: number;
    completedTasksToday: number;
    tasksDueToday: number;
    eventsToday: number;
    remindersToday: number;
  };
  limits?: {
    tasks?: {
      requested: number;
      returned: number;
      total: number;
      truncated: boolean;
    };
    events?: {
      requested: number;
      returned: number;
      total: number;
      truncated: boolean;
    };
    reminders?: {
      requested: number;
      returned: number;
      total: number;
      truncated: boolean;
    };
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

const Today: React.FC = () => {
  const navigate = useNavigate();
  const [tasksLimit, setTasksLimit] = useState(50);
  const [eventsLimit, setEventsLimit] = useState(50);
  const [remindersLimit, setRemindersLimit] = useState(50);

  const { data: todayData, isLoading, isFetching, error, refetch } = useQuery<TodayData>({
    queryKey: ['today-view', tasksLimit, eventsLimit, remindersLimit],
    queryFn: async () => {
      const response = await api.get(`/integration/today?tasksLimit=${tasksLimit}&eventsLimit=${eventsLimit}&remindersLimit=${remindersLimit}`);
      if (!response.ok) {
        throw new Error('Failed to load today view');
      }
      return response.json();
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'gray';
      default: return 'blue';
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'MEETING': return 'blue';
      case 'APPOINTMENT': return 'green';
      case 'CLOSING': return 'orange';
      case 'FOLLOW_UP': return 'yellow';
      default: return 'gray';
    }
  };

  const formatTime = (dateString: string) => {
    return dayjs(dateString).format('h:mm A');
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await apiRequest(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETE' }),
      });

      if (!response.ok) throw new Error('Failed to complete task');

      notifications.show({
        title: 'Success',
        message: 'Task marked as complete',
        color: 'green',
      });
      refetch();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to complete task',
        color: 'red',
      });
    }
  };

  const handleCompleteReminder = async (reminderId: string) => {
    try {
      const response = await apiRequest(`/reminders/${reminderId}/complete`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to complete reminder');

      notifications.show({
        title: 'Success',
        message: 'Reminder marked as complete',
        color: 'green',
      });
      refetch();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to complete reminder',
        color: 'red',
      });
    }
  };

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <Stack gap="md">
          <Group justify="center">
            <Loader size="md" />
            <Text>Loading today's view...</Text>
          </Group>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="md">
        <Alert color="red" title="Error">
          Failed to load today's view. Please try refreshing the page.
        </Alert>
      </Container>
    );
  }

  const uniqueTasks = dedupeById(todayData?.tasks || []);
  const uniqueEvents = dedupeById(todayData?.events || []);
  const uniqueReminders = dedupeById(todayData?.reminders || []);

  if (!todayData) {
    return null;
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header */}
        <Paper p="md" withBorder>
          <Group justify="space-between" align="center">
            <Group>
              <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                <IconCalendar size={24} />
              </ThemeIcon>
              <div>
                <Title order={2}>Today</Title>
                <Text size="sm" c="dimmed">
                  {dayjs().format('dddd, MMMM D, YYYY')}
                </Text>
              </div>
            </Group>
            <Group>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => refetch()}
              >
                Refresh
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* Summary Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
            <Card padding="md" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Pending
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {todayData.statistics.tasksDueToday + todayData.statistics.remindersToday}
                  </Text>
                </div>
                <ThemeIcon color="blue" size={36} radius="md">
                  <IconCheckbox size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
            <Card padding="md" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Tasks Due
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {todayData.statistics.tasksDueToday}
                  </Text>
                </div>
                <ThemeIcon color="grape" size={36} radius="md">
                  <IconCheckbox size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
            <Card padding="md" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Events
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {todayData.statistics.eventsToday}
                  </Text>
                </div>
                <ThemeIcon color="green" size={36} radius="md">
                  <IconCalendar size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
            <Card padding="md" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Reminders
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {todayData.statistics.remindersToday}
                  </Text>
                </div>
                <ThemeIcon color="red" size={36} radius="md">
                  <IconBell size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
            <Card padding="md" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Overdue
                  </Text>
                  <Text size="xl" fw={700} mt="xs" c="red">
                    {todayData.statistics.overdueTasks}
                  </Text>
                </div>
                <ThemeIcon color="red" size={36} radius="md">
                  <IconAlertTriangle size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        <Grid gutter="md">
          {/* Tasks */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon color="grape" variant="light">
                    <IconCheckbox size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Tasks Due Today</Text>
                  <Badge size="sm">{uniqueTasks.length}</Badge>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => navigate('/tasks?filter=today')}
                >
                  View All
                </Button>
              </Group>
              {todayData.limits?.tasks?.truncated && (
                <Group justify="space-between" mb="sm">
                  <Text size="xs" c="dimmed">
                    Showing first {todayData.limits.tasks.returned} of {todayData.limits.tasks.total} tasks due today.
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => setTasksLimit((current) => current + 50)}
                    loading={isFetching}
                  >
                    Load 50 more
                  </Button>
                </Group>
              )}
              <ScrollArea.Autosize mah={400}>
                <Stack gap="sm">
                  {uniqueTasks.length === 0 ? (
                    <Stack align="center" py="md" gap="xs">
                      <Text size="sm" c="dimmed" ta="center">
                        No tasks due today
                      </Text>
                      <Button size="xs" variant="light" color="grape" onClick={() => navigate('/tasks')}>
                        + Create Task
                      </Button>
                    </Stack>
                  ) : (
                    uniqueTasks.map((task) => (
                      <Card key={task.id} padding="sm" radius="md" withBorder>
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Stack gap={0} style={{ flex: 1 }}>
                            <Group gap="xs" wrap="wrap">
                              <Text size="sm" fw={500}>{task.text}</Text>
                              <Badge size="xs" color={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                            </Group>
                            {task.client && (
                              <Text size="xs" c="blue">
                                {task.client.name || task.client.nameEncrypted}
                              </Text>
                            )}
                          </Stack>
                          <ActionIcon
                            size="sm"
                            color="green"
                            variant="light"
                            onClick={() => handleCompleteTask(task.id)}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Paper>
          </Grid.Col>

          {/* Events */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon color="green" variant="light">
                    <IconCalendar size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Events Today</Text>
                  <Badge size="sm">{uniqueEvents.length}</Badge>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => navigate('/calendar')}
                >
                  View Calendar
                </Button>
              </Group>
              {todayData.limits?.events?.truncated && (
                <Group justify="space-between" mb="sm">
                  <Text size="xs" c="dimmed">
                    Showing first {todayData.limits.events.returned} of {todayData.limits.events.total} events.
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => setEventsLimit((current) => current + 50)}
                    loading={isFetching}
                  >
                    Load 50 more
                  </Button>
                </Group>
              )}
              <ScrollArea.Autosize mah={400}>
                <Stack gap="sm">
                  {uniqueEvents.length === 0 ? (
                    <Stack align="center" py="md" gap="xs">
                      <Text size="sm" c="dimmed" ta="center">
                        No events today
                      </Text>
                      <Button size="xs" variant="light" color="green" onClick={() => navigate('/calendar')}>
                        + Add Event
                      </Button>
                    </Stack>
                  ) : (
                    uniqueEvents.map((event) => (
                      <Card key={event.id} padding="sm" radius="md" withBorder>
                        <Stack gap="xs">
                          <Group gap="xs" wrap="wrap">
                            <Text size="sm" fw={500}>{event.title}</Text>
                            <Badge size="xs" color={getEventTypeColor(event.eventType)}>
                              {event.eventType}
                            </Badge>
                          </Group>
                          <Group gap="md" c="dimmed">
                            <Group gap={4}>
                              <IconClock size={14} />
                              <Text size="xs">
                                {event.allDay ? 'All Day' : formatTime(event.startTime)}
                              </Text>
                            </Group>
                            {event.location && (
                              <Text size="xs">📍 {event.location}</Text>
                            )}
                          </Group>
                          {event.client && (
                            <Text size="xs" c="blue">
                              {event.client.name || event.client.nameEncrypted}
                            </Text>
                          )}
                        </Stack>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Paper>
          </Grid.Col>

          {/* Reminders */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon color="red" variant="light">
                    <IconBell size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Reminders</Text>
                  <Badge size="sm">{uniqueReminders.length}</Badge>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => navigate('/reminders')}
                >
                  View All
                </Button>
              </Group>
              {todayData.limits?.reminders?.truncated && (
                <Group justify="space-between" mb="sm">
                  <Text size="xs" c="dimmed">
                    Showing first {todayData.limits.reminders.returned} of {todayData.limits.reminders.total} reminders.
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => setRemindersLimit((current) => current + 50)}
                    loading={isFetching}
                  >
                    Load 50 more
                  </Button>
                </Group>
              )}
              <ScrollArea.Autosize mah={400}>
                <Stack gap="sm">
                  {uniqueReminders.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No reminders today
                    </Text>
                  ) : (
                    uniqueReminders.map((reminder) => (
                      <Card key={reminder.id} padding="sm" radius="md" withBorder>
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Stack gap={0} style={{ flex: 1 }}>
                            <Group gap="xs" wrap="wrap">
                              <Text size="sm" fw={500}>{reminder.title}</Text>
                              <Badge size="xs" color={getPriorityColor(reminder.priority)}>
                                {reminder.priority}
                              </Badge>
                              <Badge size="xs" color="blue" variant="light">
                                {reminder.category.replace('_', ' ')}
                              </Badge>
                            </Group>
                            {reminder.client && (
                              <Text size="xs" c="blue">
                                {reminder.client.name || reminder.client.nameEncrypted}
                              </Text>
                            )}
                          </Stack>
                          <ActionIcon
                            size="sm"
                            color="green"
                            variant="light"
                            onClick={() => handleCompleteReminder(reminder.id)}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Paper>
          </Grid.Col>

          {/* Overdue */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p="md" withBorder h="100%" style={{ borderColor: todayData.statistics.overdueTasks > 0 ? '#fa5252' : undefined }}>
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon color="red" variant="light">
                    <IconAlertTriangle size={18} />
                  </ThemeIcon>
                  <Text fw={600} c="red">Overdue</Text>
                  <Badge color="red" size="sm">
                    {todayData.statistics.overdueTasks}
                  </Badge>
                </Group>
                {todayData.statistics.overdueTasks > 0 && (
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => navigate('/tasks?filter=overdue')}
                  >
                    View All
                  </Button>
                )}
              </Group>
              <ScrollArea.Autosize mah={400}>
                <Stack gap="sm">
                  {todayData.statistics.overdueTasks === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No overdue items 🎉
                    </Text>
                  ) : (
                    <Text size="sm" c="red" ta="center" py="md">
                      You have {todayData.statistics.overdueTasks} overdue task{todayData.statistics.overdueTasks !== 1 ? 's' : ''}. View the Tasks page for details.
                    </Text>
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
};

export default Today;
