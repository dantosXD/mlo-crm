import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  DatePicker,
  Button,
  Group,
  MultiSelect,
  TagsInput,
  Checkbox,
  Paper,
  Title,
  Text,
} from '@mantine/core';
import { IconCalendar, IconTag, IconRepeat } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface TaskFormProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId?: string;
  editTask?: any;
}

const taskTypes = [
  { value: 'GENERAL', label: 'General' },
  { value: 'CLIENT_SPECIFIC', label: 'Client Specific' },
  { value: 'WORKFLOW_RELATED', label: 'Workflow Related' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'COMPLIANCE', label: 'Compliance' },
];

const priorityLevels = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const recurringPatterns = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'CUSTOM', label: 'Custom' },
];

export default function TaskForm({ opened, onClose, onSuccess, clientId, editTask }: TaskFormProps) {
  const { accessToken } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(editTask?.text || '');
  const [description, setDescription] = useState(editTask?.description || '');
  const [type, setType] = useState(editTask?.type || 'GENERAL');
  const [priority, setPriority] = useState(editTask?.priority || 'MEDIUM');
  const [dueDate, setDueDate] = useState<Date | null>(editTask?.dueDate ? new Date(editTask.dueDate) : null);
  const [tags, setTags] = useState<string[]>(editTask?.tags || []);
  const [isRecurring, setIsRecurring] = useState(editTask?.isRecurring || false);
  const [recurringPattern, setRecurringPattern] = useState(editTask?.recurringPattern || 'WEEKLY');
  const [recurringInterval, setRecurringInterval] = useState(editTask?.recurringInterval || 1);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(
    editTask?.recurringEndDate ? new Date(editTask.recurringEndDate) : null
  );

  const handleSubmit = async () => {
    if (!text.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Task text is required',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        text: text.trim(),
        description: description.trim() || null,
        type,
        priority,
        dueDate: dueDate ? dueDate.toISOString() : null,
        tags: JSON.stringify(tags),
        isRecurring,
        ...(isRecurring && {
          recurringPattern,
          recurringInterval,
          recurringEndDate: recurringEndDate ? recurringEndDate.toISOString() : null,
        }),
      };

      if (clientId) {
        payload.clientId = clientId;
      }

      const url = editTask
        ? `${API_URL}/api/tasks/${editTask.id}`
        : `${API_URL}/api/tasks`;

      const response = await fetch(url, {
        method: editTask ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save task');
      }

      notifications.show({
        title: 'Success',
        message: editTask ? 'Task updated successfully' : 'Task created successfully',
        color: 'green',
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error saving task:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save task',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setText('');
    setDescription('');
    setType('GENERAL');
    setPriority('MEDIUM');
    setDueDate(null);
    setTags([]);
    setIsRecurring(false);
    setRecurringPattern('WEEKLY');
    setRecurringInterval(1);
    setRecurringEndDate(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Title order={4}>{editTask ? 'Edit Task' : 'Create New Task'}</Title>}
      size="lg"
    >
      <Stack>
        {/* Task Text */}
        <TextInput
          label="Task *"
          placeholder="Enter task title..."
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          required
          autoFocus
        />

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="Add a description..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={3}
        />

        {/* Task Type */}
        <Select
          label="Task Type"
          data={taskTypes}
          value={type}
          onChange={(value) => setType(value || 'GENERAL')}
          leftSection={<IconTag size={16} />}
        />

        {/* Priority */}
        <Select
          label="Priority"
          data={priorityLevels}
          value={priority}
          onChange={(value) => setPriority(value || 'MEDIUM')}
        />

        {/* Due Date */}
        <DatePicker
          label="Due Date"
          placeholder="Select due date"
          value={dueDate}
          onChange={setDueDate}
          leftSection={<IconCalendar size={16} />}
          clearable
        />

        {/* Tags */}
        <TagsInput
          label="Tags"
          placeholder="Add tags..."
          value={tags}
          onChange={setTags}
          data={[]} // Could load existing tags
          clearable
        />

        {/* Recurring Settings */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500}>Recurring Task</Text>
            <Checkbox
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.currentTarget.checked)}
            />
          </Group>

          {isRecurring && (
            <Stack mt="md">
              <Select
                label="Pattern"
                data={recurringPatterns}
                value={recurringPattern}
                onChange={(value) => setRecurringPattern(value || 'WEEKLY')}
                leftSection={<IconRepeat size={16} />}
              />

              {recurringPattern === 'CUSTOM' && (
                <TextInput
                  label="Interval"
                  type="number"
                  value={recurringInterval.toString()}
                  onChange={(e) => setRecurringInterval(parseInt(e.currentTarget.value) || 1)}
                  min={1}
                  description="Repeat every X days/weeks/months"
                />
              )}

              <DatePicker
                label="End Date (Optional)"
                placeholder="When should recurrence end?"
                value={recurringEndDate}
                onChange={setRecurringEndDate}
                clearable
              />
            </Stack>
          )}
        </Paper>

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {editTask ? 'Update Task' : 'Create Task'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
