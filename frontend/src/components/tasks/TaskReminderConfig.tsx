import { useState } from 'react';
import {
  Paper,
  Title,
  Text,
  Switch,
  Checkbox,
  TextInput,
  Group,
  Stack,
  Button,
  Alert,
  Loader,
} from '@mantine/core';
import { IconBell, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface TaskReminderConfigProps {
  taskId: string;
  initialEnabled: boolean;
  initialTimes: string[];
  initialMessage?: string;
  onUpdate?: () => void;
}

const REMINDER_OPTIONS = [
  { value: 'AT_TIME', label: 'At due time', description: 'Remind when task is due' },
  { value: '15MIN', label: '15 minutes before', description: 'Remind 15 minutes before due' },
  { value: '1HR', label: '1 hour before', description: 'Remind 1 hour before due' },
  { value: '1DAY', label: '1 day before', description: 'Remind 1 day before due' },
  { value: '1WEEK', label: '1 week before', description: 'Remind 1 week before due' },
];

export function TaskReminderConfig({
  taskId,
  initialEnabled,
  initialTimes,
  initialMessage = '',
  onUpdate,
}: TaskReminderConfigProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(initialTimes);
  const [customMessage, setCustomMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggleEnabled = async (checked: boolean) => {
    setEnabled(checked);
    setHasChanges(true);

    if (!checked) {
      // If disabling, also clear selected times
      setSelectedTimes([]);
    }

    await saveSettings({ reminderEnabled: checked, reminderTimes: checked ? selectedTimes : [] });
  };

  const handleToggleReminderTime = async (value: string, checked: boolean) => {
    const newTimes = checked
      ? [...selectedTimes, value]
      : selectedTimes.filter((t) => t !== value);

    setSelectedTimes(newTimes);
    setHasChanges(true);

    // Auto-enable if times are selected
    if (newTimes.length > 0 && !enabled) {
      setEnabled(true);
      await saveSettings({ reminderEnabled: true, reminderTimes: newTimes });
    } else if (newTimes.length > 0) {
      await saveSettings({ reminderTimes: newTimes });
    } else {
      // If no times selected, disable reminders
      setEnabled(false);
      await saveSettings({ reminderEnabled: false, reminderTimes: [] });
    }
  };

  const handleSaveMessage = async () => {
    await saveSettings({ reminderMessage: customMessage });
  };

  const saveSettings = async (settings: {
    reminderEnabled?: boolean;
    reminderTimes?: string[];
    reminderMessage?: string;
  }) => {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/reminders`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update reminder settings');
      }

      notifications.show({
        title: 'Success',
        message: 'Reminder settings updated',
        color: 'green',
      });
      setHasChanges(false);
      onUpdate?.();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update reminder settings',
        color: 'red',
      });
      // Revert state on error
      setEnabled(initialEnabled);
      setSelectedTimes(initialTimes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <IconBell size={20} />
            <Title order={4}>Task Reminders</Title>
          </Group>
          <Switch
            checked={enabled}
            onChange={(event) => handleToggleEnabled(event.currentTarget.checked)}
            label={enabled ? 'Enabled' : 'Disabled'}
          />
        </Group>

        {!enabled ? (
          <Text c="dimmed" size="sm">
            Enable reminders to receive notifications before this task is due.
          </Text>
        ) : (
          <>
            <Text size="sm" fw={500}>
              When would you like to be reminded?
            </Text>

            <Stack gap="xs">
              {REMINDER_OPTIONS.map((option) => (
                <Checkbox
                  key={option.value}
                  value={option.value}
                  checked={selectedTimes.includes(option.value)}
                  onChange={(event) =>
                    handleToggleReminderTime(option.value, event.currentTarget.checked)
                  }
                  label={option.label}
                  description={option.description}
                  disabled={loading}
                />
              ))}
            </Stack>

            {selectedTimes.length === 0 && (
              <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
                Select at least one reminder time above.
              </Alert>
            )}

            <TextInput
              label="Custom reminder message (optional)"
              placeholder="e.g., Don't forget to call the client!"
              value={customMessage}
              onChange={(event) => {
                setCustomMessage(event.currentTarget.value);
                setHasChanges(true);
              }}
              onBlur={handleSaveMessage}
              disabled={loading || !enabled}
            />

            <Text size="xs" c="dimmed">
              Reminders will be sent as in-app notifications. You can snooze reminders
              from the task details page.
            </Text>
          </>
        )}
      </Stack>
    </Paper>
  );
}
