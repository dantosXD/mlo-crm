import { useState } from 'react';
import { Stack, Paper, Group, Text, Title, Button, Badge, Select, Checkbox, ActionIcon, Box, Divider } from '@mantine/core';
import { IconPlus, IconUser, IconTrash } from '@tabler/icons-react';
import { EmptyState } from '../EmptyState';
import { SubtaskList } from '../tasks/SubtaskList';
import { isTaskOverdue, isTaskDueToday } from '../../utils/dateUtils';
import { PRIORITY_COLORS } from '../../utils/constants';
import type { Task } from '../../types';

interface TasksTabProps {
  tasks: Task[];
  loadingTasks: boolean;
  togglingTaskId: string | null;
  onAddTask: () => void;
  onToggleTaskStatus: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onSubtasksChange: (taskId: string, updatedSubtasks: any[]) => void;
}

export function TasksTab({
  tasks,
  loadingTasks,
  togglingTaskId,
  onAddTask,
  onToggleTaskStatus,
  onDeleteTask,
  onSubtasksChange,
}: TasksTabProps) {
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string | null>(null);
  const [taskDateFilter, setTaskDateFilter] = useState<string | null>(null);
  const priorityColors = PRIORITY_COLORS;
  const filteredTasks = tasks.filter((task) => {
    const matchesPriority = !taskPriorityFilter || task.priority === taskPriorityFilter;
    const matchesDate = !taskDateFilter || (taskDateFilter === 'today' && isTaskDueToday(task.dueDate));
    return matchesPriority && matchesDate;
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Tasks</Title>
        <Group>
          <Select
            placeholder="Filter by priority"
            clearable
            data={[
              { value: 'LOW', label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH', label: 'High' },
            ]}
            value={taskPriorityFilter}
            onChange={setTaskPriorityFilter}
            style={{ width: 160 }}
          />
          <Select
            placeholder="Due date"
            clearable
            data={[
              { value: 'today', label: 'Due Today' },
            ]}
            value={taskDateFilter}
            onChange={setTaskDateFilter}
            style={{ width: 140 }}
          />
          <Button
            leftSection={<IconPlus size={16} aria-hidden="true" />}
            onClick={onAddTask}
          >
            Add Task
          </Button>
        </Group>
      </Group>
      {loadingTasks ? (
        <Text c="dimmed">Loading tasks...</Text>
      ) : tasks.length === 0 ? (
        <EmptyState
          iconType="tasks"
          title="No tasks yet"
          description="Create next-step actions with owners and due dates to keep this loan moving."
          ctaLabel="Add First Task"
          onCtaClick={onAddTask}
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          iconType="tasks"
          title="No matching tasks"
          description="No tasks match the selected filters. Try changing the filters or add a new task."
          ctaLabel="Clear Filter"
          onCtaClick={() => { setTaskPriorityFilter(null); setTaskDateFilter(null); }}
        />
      ) : (
        <Stack gap="md">
          {filteredTasks.map((task) => {
            const overdue = isTaskOverdue(task.dueDate, task.status);
            return (
              <Paper
                key={task.id}
                p="md"
                withBorder
                style={{
                  ...(task.status === 'COMPLETE' ? { opacity: 0.7 } : {}),
                  ...(overdue ? { borderColor: 'var(--mantine-color-red-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-red-0)' } : {}),
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm" style={{ flex: 1 }}>
                    <Checkbox
                      checked={task.status === 'COMPLETE'}
                      onChange={() => onToggleTaskStatus(task)}
                      size="md"
                      disabled={togglingTaskId === task.id}
                    />
                    <div style={{ flex: 1 }}>
                      <Text style={{ textDecoration: task.status === 'COMPLETE' ? 'line-through' : 'none' }}>
                        {task.text}
                      </Text>
                      {task.description && (
                        <Text size="sm" c="dimmed" mt="xs">{task.description}</Text>
                      )}
                      {task.assignedTo && (
                        <Group gap="xs" mt="xs">
                          <IconUser size={14} aria-hidden="true" />
                          <Text size="xs" c="blue">
                            Assigned to: {task.assignedTo.name}
                          </Text>
                        </Group>
                      )}
                    </div>
                  </Group>
                  <Group gap="xs">
                    {overdue && (
                      <Badge color="red" size="sm" variant="filled">
                        OVERDUE
                      </Badge>
                    )}
                    <Badge color={priorityColors[task.priority]} size="sm">
                      {task.priority}
                    </Badge>
                    <ActionIcon variant="subtle" color="red" onClick={() => onDeleteTask(task.id)} aria-label={`Delete task: ${task.text}`}>
                      <IconTrash size={16} aria-hidden="true" />
                    </ActionIcon>
                  </Group>
                </Group>
                <Group justify="space-between" mt="sm">
                  <Text size="xs" c={overdue ? 'red' : 'dimmed'} fw={overdue ? 600 : 400}>
                    {task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Created: {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '-'}
                  </Text>
                </Group>

                {/* Subtasks Section */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <Box mt="md">
                    <Divider mb="sm" />
                    <SubtaskList
                      taskId={task.id}
                      subtasks={task.subtasks as any}
                      onSubtasksChange={(updatedSubtasks) => onSubtasksChange(task.id, updatedSubtasks)}
                    />
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </>
  );
}
