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
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    dueDate: null as Date | null,
    assignedToId: '' as string | undefined,
  });
  const [saving, setSaving] = useState(false);

  // Fetch team members for assignment
  const { data: teamMembers = [], isLoading: loadingTeamMembers } = useQuery({
    queryKey: ['client-team-members'],
    queryFn: async () => {
      const response = await api.get('/users/team');
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json() as Promise<{ id: string; name: string; role: string }[]>;
    },
  });

  const handleClose = () => {
    setTaskForm({ text: '', description: '', priority: 'MEDIUM', dueDate: null, assignedToId: '' });
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

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add Task"
    >
      <Stack>
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
          ]}
          value={taskForm.priority}
          onChange={(value) => setTaskForm({ ...taskForm, priority: (value as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM' })}
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
