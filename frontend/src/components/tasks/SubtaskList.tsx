import React, { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Checkbox,
  TextInput,
  ActionIcon,
  Menu,
  Progress,
  Badge,
  Tooltip,
  Box,
} from '@mantine/core';
import {
  IconCheckbox,
  IconTrash,
  IconDots,
  IconGripVertical,
  IconCalendar,
  IconCheck,
} from '@tabler/icons-react';
import { useListState } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import api from '../../utils/api';

interface Subtask {
  id: string;
  text: string;
  isCompleted: boolean;
  order: number;
  dueDate?: string;
}

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  onSubtasksChange: (subtasks: Subtask[]) => void;
  readonly?: boolean;
}

export function SubtaskList({ taskId, subtasks, onSubtasksChange, readonly = false }: SubtaskListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Calculate completion percentage
  const completedCount = subtasks.filter((s) => s.isCompleted).length;
  const totalCount = subtasks.length;
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleCreateSubtask = async () => {
    if (!newSubtaskText.trim()) return;

    setAddingSubtask(true);
    try {
      const response = await api.post(`/tasks/${taskId}/subtasks`, {
        text: newSubtaskText.trim(),
      });

      if (!response.ok) throw new Error('Failed to create subtask');

      const newSubtask = await response.json();
      onSubtasksChange([...subtasks, newSubtask]);
      setNewSubtaskText('');

      notifications.show({
        title: 'Success',
        message: 'Subtask added',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating subtask:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to add subtask',
        color: 'red',
      });
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    try {
      const response = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`);

      if (!response.ok) throw new Error('Failed to toggle subtask');

      const updatedSubtask = await response.json();
      onSubtasksChange(
        subtasks.map((s) => (s.id === subtaskId ? { ...s, isCompleted: updatedSubtask.isCompleted } : s))
      );
    } catch (error) {
      console.error('Error toggling subtask:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update subtask',
        color: 'red',
      });
    }
  };

  const handleUpdateSubtask = async (subtaskId: string, text: string) => {
    try {
      const response = await api.put(`/tasks/${taskId}/subtasks/${subtaskId}`, {
        text,
      });

      if (!response.ok) throw new Error('Failed to update subtask');

      onSubtasksChange(subtasks.map((s) => (s.id === subtaskId ? { ...s, text } : s)));
      setEditingId(null);
      setEditText('');
    } catch (error) {
      console.error('Error updating subtask:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update subtask',
        color: 'red',
      });
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    modals.openConfirmModal({
      title: 'Delete subtask',
      children: <Text size="sm">Are you sure you want to delete this subtask?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);

          if (!response.ok) throw new Error('Failed to delete subtask');

          onSubtasksChange(subtasks.filter((s) => s.id !== subtaskId));

          notifications.show({
            title: 'Success',
            message: 'Subtask deleted',
            color: 'green',
          });
        } catch (error) {
          console.error('Error deleting subtask:', error);
          notifications.show({
            title: 'Error',
            message: 'Failed to delete subtask',
            color: 'red',
          });
        }
      },
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId) {
        handleUpdateSubtask(editingId, editText);
      } else if (newSubtaskText.trim()) {
        handleCreateSubtask();
      }
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditText('');
    }
  };

  const startEditing = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditText(subtask.text);
  };

  return (
    <Stack gap="sm">
      {/* Progress bar */}
      {totalCount > 0 && (
        <Box>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              Progress
            </Text>
            <Text size="sm" c="dimmed">
              {completedCount} of {totalCount} completed
            </Text>
          </Group>
          <Progress
            value={completionPercentage}
            color={completionPercentage === 100 ? 'green' : 'blue'}
            size="sm"
            animated={completionPercentage < 100 && completionPercentage > 0}
          />
        </Box>
      )}

      {/* Subtask list */}
      <Stack gap="xs">
        {subtasks.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" py="md">
            No subtasks yet. Add one to get started!
          </Text>
        ) : (
          subtasks.map((subtask) => (
            <Group key={subtask.id} gap="xs" wrap="nowrap">
              <IconGripVertical size={16} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'grab' }} />
              <Checkbox
                checked={subtask.isCompleted}
                onChange={() => handleToggleSubtask(subtask.id)}
                disabled={readonly}
                aria-label={`Toggle subtask: ${subtask.text}`}
              />

              {editingId === subtask.id ? (
                <TextInput
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onBlur={() => handleUpdateSubtask(subtask.id, editText)}
                  autoFocus
                  size="sm"
                  style={{ flex: 1 }}
                />
              ) : (
                <Text
                  size="sm"
                  style={{
                    flex: 1,
                    textDecoration: subtask.isCompleted ? 'line-through' : 'none',
                    color: subtask.isCompleted ? 'var(--mantine-color-dimmed)' : 'inherit',
                    cursor: readonly ? 'default' : 'pointer',
                  }}
                  onClick={!readonly ? () => startEditing(subtask) : undefined}
                >
                  {subtask.text}
                </Text>
              )}

              {subtask.dueDate && (
                <Tooltip label={`Due: ${new Date(subtask.dueDate).toLocaleDateString()}`}>
                  <Badge size="xs" leftSection={<IconCalendar size={12} />}>
                    {new Date(subtask.dueDate).toLocaleDateString()}
                  </Badge>
                </Tooltip>
              )}

              {!readonly && (
                <Menu position="bottom-end">
                  <Menu.Target>
                    <ActionIcon size="sm" variant="subtle">
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconTrash size={16} />}
                      color="red"
                      onClick={() => handleDeleteSubtask(subtask.id)}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          ))
        )}
      </Stack>

      {/* Add new subtask */}
      {!readonly && (
        <Group gap="xs" mt="sm">
          <IconCheckbox size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <TextInput
            placeholder="Add a subtask..."
            value={newSubtaskText}
            onChange={(e) => setNewSubtaskText(e.target.value)}
            onKeyDown={handleKeyPress}
            size="sm"
            disabled={addingSubtask}
            style={{ flex: 1 }}
          />
          <ActionIcon
            onClick={handleCreateSubtask}
            disabled={!newSubtaskText.trim() || addingSubtask}
            loading={addingSubtask}
            color="blue"
          >
            <IconCheck size={16} />
          </ActionIcon>
        </Group>
      )}
    </Stack>
  );
}
