import React, { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Text,
  Badge,
  Group,
  Button,
  ActionIcon,
  ThemeIcon,
  Tooltip,
  ScrollArea,
  Box,
  Loader,
} from '@mantine/core';
import {
  IconBell,
  IconBellRinging,
  IconCheck,
  IconX,
  IconClock,
  IconCalendar,
  IconDots,
  IconChevronRight,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import api from '../../utils/api';

interface ReminderWidgetProps {
  limit?: number;
}

const ReminderWidget: React.FC<ReminderWidgetProps> = ({ limit = 5 }) => {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/reminders?status=PENDING&status=SNOOZED&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reminders');
      }
      setReminders(await response.json());
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
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
      fetchReminders();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to complete reminder',
        color: 'red',
      });
    }
  };

  const handleSnooze = async (reminderId: string) => {
    try {
      const response = await api.post(`/reminders/${reminderId}/snooze`, { minutes: 15 });
      if (!response.ok) {
        throw new Error('Failed to snooze reminder');
      }
      notifications.show({
        title: 'Success',
        message: 'Reminder snoozed for 15 minutes',
        color: 'blue',
      });
      fetchReminders();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to snooze reminder',
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

  const isOverdue = (remindAt: string) => {
    return new Date(remindAt) < new Date();
  };

  const formatDueTime = (remindAt: string) => {
    const date = new Date(remindAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 0) {
      return 'Overdue';
    } else if (diffMins < 60) {
      return `In ${diffMins} min`;
    } else if (diffHours < 24) {
      return `In ${diffHours}h`;
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays < 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <Card padding="md" radius="md" withBorder h={300}>
        <Stack align="center" justify="center" h="100%">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading reminders...</Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card padding="md" radius="md" withBorder>
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="sm">
            {reminders.length > 0 && reminders.some((r) => isOverdue(r.remindAt)) ? (
              <ThemeIcon color="red" size="sm" radius="md">
                <IconBellRinging size={14} />
              </ThemeIcon>
            ) : (
              <ThemeIcon color="blue" size="sm" radius="md">
                <IconBell size={14} />
              </ThemeIcon>
            )}
            <Text fw={500} size="sm">
              Upcoming Reminders
            </Text>
          </Group>
          <Tooltip label="View all reminders">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => navigate('/reminders')}
            >
              <IconChevronRight size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Reminders List */}
        <Box>
          {reminders.length === 0 ? (
            <Stack align="center" gap="xs" py="md">
              <IconBell size={32} color="var(--mantine-color-dimmed)" style={{ opacity: 0.5 }} />
              <Text size="sm" c="dimmed">
                No upcoming reminders
              </Text>
            </Stack>
          ) : (
            <ScrollArea.Autosize mah={250}>
              <Stack gap="xs">
                {reminders.slice(0, limit).map((reminder) => (
                  <Box
                    key={reminder.id}
                    p="xs"
                    style={{
                      border: '1px solid var(--mantine-color-gray-3)',
                      borderRadius: 'var(--mantine-radius-sm)',
                      backgroundColor: isOverdue(reminder.remindAt)
                        ? 'var(--mantine-color-red-0)'
                        : undefined,
                    }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="xs" wrap="wrap">
                          <Text size="sm" fw={500} lineClamp={1}>
                            {reminder.title}
                          </Text>
                          <Badge
                            size="xs"
                            color={getPriorityColor(reminder.priority)}
                            variant="filled"
                          >
                            {reminder.priority}
                          </Badge>
                          {isOverdue(reminder.remindAt) && (
                            <Badge size="xs" color="red" variant="filled">
                              Overdue
                            </Badge>
                          )}
                        </Group>

                        <Group gap={4} c="dimmed">
                          <IconCalendar size={12} />
                          <Text size="xs">
                            {formatDueTime(reminder.remindAt)}
                          </Text>
                          {reminder.client && (
                            <>
                              <Text size="xs">•</Text>
                              <Text size="xs" fw={500}>
                                {reminder.client?.name}
                              </Text>
                            </>
                          )}
                        </Group>
                      </Stack>

                      <Group gap={2}>
                        <Tooltip label="Complete">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="green"
                            onClick={() => handleComplete(reminder.id)}
                          >
                            <IconCheck size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Snooze 15 min">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => handleSnooze(reminder.id)}
                          >
                            <IconClock size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Box>

        {/* View All Button */}
        {reminders.length > 0 && (
          <Button
            variant="light"
            size="sm"
            fullWidth
            rightSection={<IconChevronRight size={14} />}
            onClick={() => navigate('/reminders')}
          >
            View All Reminders
          </Button>
        )}
      </Stack>
    </Card>
  );
};

export default ReminderWidget;
