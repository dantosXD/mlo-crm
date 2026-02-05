import { useState } from 'react';
import { Menu, Button, Group, Text } from '@mantine/core';
import {
  IconClock,
  IconZzz,
  IconChevronDown,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface TaskSnoozeButtonProps {
  taskId: string;
  onSnooze?: () => void;
}

const SNOOZE_OPTIONS = [
  { value: '15MIN', label: '15 minutes', icon: IconClock },
  { value: '1HR', label: '1 hour', icon: IconClock },
  { value: 'TOMORROW', label: 'Until tomorrow (9 AM)', icon: IconZzz },
  { value: 'NEXT_WEEK', label: 'Until next week (9 AM)', icon: IconZzz },
];

export function TaskSnoozeButton({ taskId, onSnooze }: TaskSnoozeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSnooze = async (duration: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ duration }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to snooze task');
      }

      const data = await response.json();
      notifications.show({
        title: 'Task Snoozed',
        message: `Reminders paused until ${new Date(data.snoozedUntil).toLocaleString()}`,
        color: 'blue',
      });
      onSnooze?.();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to snooze task',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconZzz size={14} />}
          rightSection={<IconChevronDown size={14} />}
          loading={loading}
        >
          Snooze
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" c="dimmed">
            Pause reminders for...
          </Text>
        </Menu.Label>
        {SNOOZE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Menu.Item
              key={option.value}
              leftSection={<Icon size={16} />}
              onClick={() => handleSnooze(option.value)}
              disabled={loading}
            >
              {option.label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
