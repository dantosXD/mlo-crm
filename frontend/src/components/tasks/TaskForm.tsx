import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  MultiSelect,
  TagsInput,
  Checkbox,
  Paper,
  Title,
  Text,
  Divider,
  Alert,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTag, IconRepeat, IconBell, IconClock, IconCalendarEvent } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api, { apiRequest } from '../../utils/api';

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
  const [loading, setLoading] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
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

      const response = await apiRequest(editTask ? `/tasks/${editTask.id}` : '/tasks', {
        method: editTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save task');
      }

      const savedTask = await response.json();

      notifications.show({
        title: 'Success',
        message: editTask ? 'Task updated successfully' : 'Task created successfully',
        color: 'green',
      });

      // For new tasks, show integration options
      if (!editTask) {
        setCreatedTaskId(savedTask.id);
      } else {
        onSuccess();
        handleClose();
      }
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
    setCreatedTaskId(null);
    onClose();
  };

  const handleConvertToEvent = async () => {
    if (!createdTaskId) return;

    try {
      const response = await api.post('/integration/task-to-event', {
        taskId: createdTaskId,
        eventData: {
          allDay: true,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to convert task to event');
      }

      notifications.show({
        title: 'Success',
        message: 'Task converted to calendar event',
        color: 'green',
      });

      onSuccess();
      handleClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to convert task to event',
        color: 'red',
      });
    }
  };

  const handleCreateReminder = async () => {
    if (!createdTaskId) return;

    try {
      const response = await api.post('/integration/task-to-reminder', {
        taskId: createdTaskId,
      });
      if (!response.ok) {
        throw new Error('Failed to create reminder');
      }

      notifications.show({
        title: 'Success',
        message: 'Reminder created from task',
        color: 'green',
      });

      onSuccess();
      handleClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create reminder',
        color: 'red',
      });
    }
  };

  const handleSkipIntegration = () => {
    onSuccess();
    handleClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={editTask ? 'Edit Task' : 'Create New Task'}
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
        <DateInput
          label="Due Date"
          placeholder="Select due date"
          value={dueDate}
          onChange={setDueDate}
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

              <DateInput
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

        {/* Integration Options (shown after creating a new task) */}
        {createdTaskId && !editTask && (
          <>
            <Divider label="Quick Actions" labelPosition="center" my="md" />
            <Alert color="blue" title="Task Created!" mb="md">
              Would you like to create a calendar event or reminder for this task?
            </Alert>

            <Group justify="center">
              <Button
                variant="light"
                leftSection={<IconCalendarEvent size={16} />}
                onClick={handleConvertToEvent}
              >
                Add to Calendar
              </Button>
              <Button
                variant="light"
                leftSection={<IconBell size={16} />}
                onClick={handleCreateReminder}
              >
                Set Reminder
              </Button>
              <Button
                variant="subtle"
                onClick={handleSkipIntegration}
              >
                Skip
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
