import React from 'react';
import {
  Card,
  Text,
  Group,
  Badge,
  Stack,
  ActionIcon,
  Menu,
  Box,
} from '@mantine/core';
import {
  IconCheck,
  IconClock,
  IconX,
  IconBell,
  IconDots,
  IconCalendar,
  IconChevronRight,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface Reminder {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  remindAt: string;
  dueDate?: string;
  status: string;
  client?: { id: string; name: string } | null;
  tags?: string[];
  isRecurring: boolean;
  snoozedUntil?: string;
  snoozeCount: number;
}

interface MobileReminderCardProps {
  reminder: Reminder;
  onComplete: () => void;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

export function MobileReminderCard({
  reminder,
  onComplete,
  onDismiss,
  onSnooze,
}: MobileReminderCardProps) {
  const navigate = useNavigate();

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

  const isOverdue = new Date(reminder.remindAt) < new Date() &&
    reminder.status !== 'COMPLETED' &&
    reminder.status !== 'DISMISSED';

  const isPending = reminder.status === 'PENDING' || reminder.status === 'SNOOZED';

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${timeStr}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${timeStr}`;
    } else {
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`;
    }
  };

  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleCardClick = () => {
    // Navigate to reminder details or open edit modal
    navigate(`/reminders?edit=${reminder.id}`);
  };

  return (
    <Card
      padding="md"
      radius="md"
      withBorder
      shadow="sm"
      style={{
        cursor: 'pointer',
        borderColor: isOverdue ? '#fa5252' : undefined,
        borderWidth: isOverdue ? '2px' : '1px',
        minHeight: '100px',
      }}
      onClick={handleCardClick}
    >
      <Group gap="sm" align="flex-start">
        {/* Icon */}
        <Box
          p="xs"
          style={{
            backgroundColor: isPending ? '#228be615' : '#40c05715',
            borderRadius: '8px',
            minHeight: '48px',
            minWidth: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBell
            size={24}
            color={isPending ? '#228be6' : '#40c057'}
          />
        </Box>

        {/* Reminder content */}
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={600} size="md" lineClamp={1} style={{ flex: 1 }}>
              {reminder.title}
            </Text>
            <Badge size="sm" color={getPriorityColor(reminder.priority)}>
              {reminder.priority}
            </Badge>
            <Badge size="sm" color={getCategoryColor(reminder.category)}>
              {reminder.category.replace('_', ' ')}
            </Badge>
            {isOverdue && (
              <Badge size="sm" color="red" variant="filled">
                Overdue
              </Badge>
            )}
            {reminder.status === 'SNOOZED' && (
              <Badge size="sm" color="blue" variant="filled">
                Snoozed
              </Badge>
            )}
            {reminder.isRecurring && (
              <Badge size="sm" color="grape" variant="light">
                Recurring
              </Badge>
            )}
          </Group>

          {reminder.description && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {reminder.description}
            </Text>
          )}

          <Group gap="xs" mt={4}>
            <Group gap={4} c="dimmed">
              <IconCalendar size={14} />
              <Text size="sm">{formatDateTime(reminder.remindAt)}</Text>
            </Group>

            {reminder.client?.id && (
              <Text
                size="sm"
                c="blue"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/clients/${reminder.client!.id}`);
                }}
                style={{ textDecoration: 'underline' }}
              >
                {reminder.client?.name || 'Client'}
              </Text>
            )}

            {reminder.snoozeCount > 0 && (
              <Text size="sm" c="dimmed">
                Snoozed {reminder.snoozeCount}x
              </Text>
            )}
          </Group>
        </Stack>

        {/* Action menu */}
        {isPending && (
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                style={{ minHeight: '44px', minWidth: '44px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconDots size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconCheck size={16} color="green" />}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback();
                  onComplete();
                }}
              >
                Complete
              </Menu.Item>
              <Menu.Item
                leftSection={<IconClock size={16} color="blue" />}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback();
                  onSnooze(15);
                }}
              >
                Snooze 15 min
              </Menu.Item>
              <Menu.Item
                leftSection={<IconClock size={16} color="blue" />}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback();
                  onSnooze(60);
                }}
              >
                Snooze 1 hour
              </Menu.Item>
              <Menu.Item
                leftSection={<IconClock size={16} color="blue" />}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback();
                  onSnooze(1440);
                }}
              >
                Snooze 1 day
              </Menu.Item>
              <Menu.Item
                leftSection={<IconX size={16} color="gray" />}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback();
                  onDismiss();
                }}
              >
                Dismiss
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}

        <IconChevronRight size={18} color="gray" />
      </Group>
    </Card>
  );
}
