import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, TextInput, Textarea, Select, Group, Button } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { Task } from '../../../types';

interface AddTaskModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
}

export function AddTaskModal({ opened, onClose, clientId }: AddTaskModalProps) {
  const queryClient = useQueryClient();

  const [taskForm, setTaskForm] = useState({
    text: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    dueDate: null as Date | null,
    assignedToId: '' as string | undefined,
  });
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch team members for assignment
  const { data: teamMembers = [], isLoading: loadingTeamMembers } = useQuery({
    queryKey: ['client-team-members'],
    queryFn: async () => {
      const response = await api.get('/users/team');
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json() as Promise<{ id: string; name: string; role: string }[]>;
    },
  });

  const { data: taskTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const response = await api.get('/tasks/templates');
      if (!response.ok) throw new Error('Failed to fetch task templates');
      return response.json() as Promise<Array<{
        id: string;
        name: string;
        text: string;
        description?: string | null;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        dueDays?: number | null;
      }>>;
    },
    enabled: opened,
  });

  const handleClose = () => {
    setTaskForm({ text: '', description: '', priority: 'MEDIUM', dueDate: null, assignedToId: '' });
    setSelectedTemplate(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!taskForm.text.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Task text is required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/tasks', {
        clientId,
        text: taskForm.text,
        description: taskForm.description || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate ? taskForm.dueDate.toISOString() : undefined,
        assignedToId: taskForm.assignedToId || undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const createdTask = await response.json();
      queryClient.setQueryData(['client-tasks', clientId], (old: Task[] = []) => [createdTask, ...old]);
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      handleClose();

      notifications.show({
        title: 'Success',
        message: 'Task created successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating task:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create task',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!taskForm.text.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Task text is required to save a template',
        color: 'red',
      });
      return;
    }

    const name = window.prompt('Template name');
    if (!name || !name.trim()) {
      return;
    }

    setSavingTemplate(true);
    try {
      const dueDays = taskForm.dueDate
        ? Math.max(0, Math.ceil((taskForm.dueDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000)))
        : null;
      const response = await api.post('/tasks/templates', {
        name: name.trim(),
        text: taskForm.text.trim(),
        description: taskForm.description || undefined,
        priority: taskForm.priority,
        dueDays,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save task template');
      }

      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      notifications.show({
        title: 'Template Saved',
        message: 'Task template saved successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save task template',
        color: 'red',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add Task"
    >
      <Stack>
        <Select
          label="Use Template (optional)"
          placeholder={loadingTemplates ? 'Loading templates...' : 'Select a template'}
          data={taskTemplates.map((template) => ({ value: template.id, label: template.name }))}
          value={selectedTemplate}
          onChange={(value) => {
            setSelectedTemplate(value);
            const template = taskTemplates.find((item) => item.id === value);
            if (!template) return;
            const dueDate = template.dueDays != null
              ? new Date(Date.now() + (template.dueDays * 24 * 60 * 60 * 1000))
              : null;

            setTaskForm((current) => ({
              ...current,
              text: template.text || current.text,
              description: template.description || '',
              priority: template.priority || 'MEDIUM',
              dueDate,
            }));
          }}
          clearable
          disabled={loadingTemplates}
        />
        <TextInput
          label="Task"
          placeholder="Enter task description..."
          required
          value={taskForm.text}
          onChange={(e) => setTaskForm({ ...taskForm, text: e.target.value })}
        />
        <Textarea
          label="Description (optional)"
          placeholder="Add more details..."
          minRows={2}
          value={taskForm.description}
          onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
        />
        <Select
          label="Priority"
          data={[
            { value: 'LOW', label: 'Low' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'HIGH', label: 'High' },
            { value: 'URGENT', label: 'Urgent' },
          ]}
          value={taskForm.priority}
          onChange={(value) => setTaskForm({ ...taskForm, priority: (value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || 'MEDIUM' })}
        />
        <Select
          label="Assign To (optional)"
          placeholder="Select team member"
          clearable
          disabled={loadingTeamMembers}
          data={teamMembers.map(member => ({
            value: member.id,
            label: `${member.name} (${member.role})`,
          }))}
          value={taskForm.assignedToId}
          onChange={(value) => setTaskForm({ ...taskForm, assignedToId: value as string || '' })}
        />
        <DateInput
          label="Due Date (optional)"
          placeholder="Select due date"
          value={taskForm.dueDate}
          onChange={(date) => setTaskForm({ ...taskForm, dueDate: date })}
          clearable
          minDate={new Date()}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleSaveTemplate} loading={savingTemplate}>
            Save as Template
          </Button>
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
