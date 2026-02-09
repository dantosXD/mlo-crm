import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Switch,
  TagsInput,
  NumberInput,
  Input,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import api from '../../utils/api';
import { getClients } from '../../utils/api';

interface ReminderFormProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reminder?: any;
}

const ReminderForm: React.FC<ReminderFormProps> = ({
  opened,
  onClose,
  onSuccess,
  reminder,
}) => {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [remindAtDate, setRemindAtDate] = useState<Date | null>(null);
  const [remindAtTime, setRemindAtTime] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  // Recurring fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<string | null>('DAILY');
  const [recurringInterval, setRecurringInterval] = useState<number>(1);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (opened) {
      fetchClients();
      if (reminder) {
        // Edit mode - populate fields
        setTitle(reminder.title);
        setDescription(reminder.description || '');
        setCategory(reminder.category);
        setPriority(reminder.priority);
        const remindAt = new Date(reminder.remindAt);
        setRemindAtDate(remindAt);
        setRemindAtTime(remindAt.toTimeString().slice(0, 5));
        setDueDate(reminder.dueDate ? new Date(reminder.dueDate) : null);
        setClientId(reminder.clientId || null);
        setTags(reminder.tags ? JSON.parse(reminder.tags) : []);
        setIsRecurring(reminder.isRecurring);
        setRecurringPattern(reminder.recurringPattern || 'DAILY');
        setRecurringInterval(reminder.recurringInterval || 1);
        setRecurringEndDate(reminder.recurringEndDate ? new Date(reminder.recurringEndDate) : null);
      } else {
        // Create mode - reset fields
        resetForm();
      }
    }
  }, [opened, reminder]);

  const fetchClients = async () => {
    try {
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('GENERAL');
    setPriority('MEDIUM');
    setRemindAtDate(null);
    setRemindAtTime(null);
    setDueDate(null);
    setClientId(null);
    setTags([]);
    setIsRecurring(false);
    setRecurringPattern('DAILY');
    setRecurringInterval(1);
    setRecurringEndDate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) {
      notifications.show({
        title: 'Error',
        message: 'Title is required',
        color: 'red',
      });
      return;
    }

    if (!remindAtDate) {
      notifications.show({
        title: 'Error',
        message: 'Reminder date is required',
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);

      // Combine date and time
      const remindAt = new Date(remindAtDate);
      if (remindAtTime) {
        const [hours, minutes] = remindAtTime.split(':');
        remindAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      const payload: any = {
        title,
        description,
        category,
        priority,
        remindAt: remindAt.toISOString(),
        dueDate: dueDate ? dueDate.toISOString() : null,
        clientId,
        tags: tags.length > 0 ? tags : null,
        isRecurring,
        recurringPattern: isRecurring ? recurringPattern : null,
        recurringInterval: isRecurring ? recurringInterval : null,
        recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate.toISOString() : null,
      };

      if (reminder) {
        const response = await api.put(`/reminders/${reminder.id}`, payload);
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Failed to update reminder');
        }
        notifications.show({
          title: 'Success',
          message: 'Reminder updated successfully',
          color: 'green',
        });
      } else {
        const response = await api.post('/reminders', payload);
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Failed to create reminder');
        }
        notifications.show({
          title: 'Success',
          message: 'Reminder created successfully',
          color: 'green',
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving reminder:', error);
      notifications.show({
        title: 'Error',
        message: error?.message || 'Failed to save reminder',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'GENERAL', label: 'General' },
    { value: 'CLIENT', label: 'Client' },
    { value: 'COMPLIANCE', label: 'Compliance' },
    { value: 'CLOSING', label: 'Closing' },
    { value: 'FOLLOW_UP', label: 'Follow-up' },
  ];

  const priorities = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
  ];

  const recurringPatterns = [
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'CUSTOM', label: 'Custom (days)' },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={reminder ? 'Edit Reminder' : 'Create Reminder'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Enter reminder title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            autoFocus
          />

          <Textarea
            label="Description"
            placeholder="Enter description (optional)"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
          />

          <Group grow>
            <Select
              label="Category"
              data={categories}
              value={category}
              onChange={(v) => setCategory(v || 'GENERAL')}
            />

            <Select
              label="Priority"
              data={priorities}
              value={priority}
              onChange={(v) => setPriority(v || 'MEDIUM')}
            />
          </Group>

          <DateInput
            label="Remind me on"
            placeholder="Pick date"
            value={remindAtDate}
            onChange={setRemindAtDate}
            required
          />

          <Input.Wrapper label="At time">
            <Input
              type="time"
              value={remindAtTime || ''}
              onChange={(e) => setRemindAtTime(e.currentTarget.value)}
            />
          </Input.Wrapper>

          <DateInput
            label="Due date (optional)"
            placeholder="Pick due date"
            value={dueDate}
            onChange={setDueDate}
            clearable
          />

          <Select
            label="Associate with client (optional)"
            placeholder="Select client"
            data={clients.map((c) => ({
              value: String(c.id),
              label: String(c.name ?? c.nameEncrypted ?? c.nameHash ?? 'Unknown Client'),
            }))}
            value={clientId}
            onChange={setClientId}
            clearable
            searchable
          />

          <TagsInput
            label="Tags"
            placeholder="Add tag"
            value={tags}
            onChange={setTags}
            clearable
          />

          <Switch
            label="Recurring reminder"
            description="This reminder will repeat automatically"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.currentTarget.checked)}
          />

          {isRecurring && (
            <Stack gap="sm" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Select
                label="Pattern"
                data={recurringPatterns}
                value={recurringPattern}
                onChange={(v) => setRecurringPattern(v || 'DAILY')}
              />

              <NumberInput
                label="Interval"
                description={recurringPattern === 'DAILY' ? 'Repeat every N days' :
                          recurringPattern === 'WEEKLY' ? 'Repeat every N weeks' :
                          recurringPattern === 'MONTHLY' ? 'Repeat every N months' :
                          'Repeat every N days (custom)'}
                value={recurringInterval}
                onChange={(v) => setRecurringInterval(v as number || 1)}
                min={1}
                max={365}
              />

              <DateInput
                label="End date (optional)"
                placeholder="No end date"
                value={recurringEndDate}
                onChange={setRecurringEndDate}
                clearable
              />
            </Stack>
          )}

          <Group mt="md">
            <Button type="submit" loading={loading} flex={1}>
              {reminder ? 'Update Reminder' : 'Create Reminder'}
            </Button>
            <Button type="button" variant="light" onClick={onClose}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ReminderForm;
