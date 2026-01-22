import { Paper, Title, Group, Card, Text, Badge, Checkbox, Stack } from '@mantine/core';
import { IconChecklist } from '@tabler/icons-react';
import { EmptyState } from '../components/EmptyState';

interface Task {
  id: string;
  text: string;
  status: string;
  priority: string;
  dueDate: string | null;
  clientId: string | null;
  clientName?: string;
}

interface PendingTasksWidgetProps {
  pendingTasksList: Task[];
  onTaskComplete: (taskId: string) => void;
}

export function PendingTasksWidget({ pendingTasksList, onTaskComplete }: PendingTasksWidgetProps) {
  return (
    <Paper shadow="sm" p="md" radius="md" withBorder h="100%">
      <Title order={4} mb="md">
        <Group gap="xs">
          <IconChecklist size={20} aria-hidden="true" />
          Pending Tasks
        </Group>
      </Title>
      {pendingTasksList && pendingTasksList.length > 0 ? (
        <Stack gap="xs">
          {pendingTasksList.map((task) => (
            <Card key={task.id} p="sm" withBorder>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                  <Checkbox
                    aria-label={`Complete task: ${task.text}`}
                    onChange={() => onTaskComplete(task.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={500} truncate>{task.text}</Text>
                    {task.clientName && (
                      <Text size="xs" c="dimmed" truncate>
                        Client: {task.clientName}
                      </Text>
                    )}
                  </div>
                </Group>
                <Badge
                  size="sm"
                  color={
                    task.priority === 'HIGH' ? 'red' :
                    task.priority === 'MEDIUM' ? 'yellow' : 'blue'
                  }
                >
                  {task.priority}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <EmptyState
          iconType="tasks"
          title="No pending tasks"
          description="Great job! You're all caught up."
        />
      )}
    </Paper>
  );
}
