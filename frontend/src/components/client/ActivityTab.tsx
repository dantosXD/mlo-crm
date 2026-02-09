import { Stack, Paper, Group, Text, Badge, Title, Divider, Button } from '@mantine/core';
import { EmptyState } from '../EmptyState';
import { formatRelativeTime } from '../../utils/dateUtils';
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from '../../utils/constants';
import type { Activity } from '../../types';

interface ActivityTabProps {
  activities: Activity[];
  loadingActivities: boolean;
  workflowExecutions: any[];
  loadingWorkflowExecutions: boolean;
}

export function ActivityTab({
  activities,
  loadingActivities,
  workflowExecutions,
  loadingWorkflowExecutions,
}: ActivityTabProps) {
  return (
    <>
      <Title order={4} mb="md">Activity Timeline</Title>
      {loadingActivities ? (
        <Text c="dimmed">Loading activities...</Text>
      ) : activities.length === 0 ? (
        <EmptyState
          iconType="activity"
          title="No activity recorded yet"
          description="Activity will appear here as you work with this client's records."
        />
      ) : (
        <Stack gap="md">
          {activities.map((activity) => (
            <Paper key={activity.id} p="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <Badge color={ACTIVITY_TYPE_COLORS[activity.type] || 'gray'} variant="light">
                    {ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
                  </Badge>
                  <Text size="sm">{activity.description}</Text>
                </Group>
              </Group>
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">
                  By {activity.user?.name || 'Unknown'}
                </Text>
                <Text size="xs" c="dimmed" title={new Date(activity.createdAt).toLocaleString()}>
                  {formatRelativeTime(activity.createdAt)}
                </Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider my="xl" />

      {/* Workflow Executions Section */}
      <Title order={4} mb="md">Workflow Executions</Title>
      {loadingWorkflowExecutions ? (
        <Text c="dimmed">Loading workflow executions...</Text>
      ) : workflowExecutions.length === 0 ? (
        <Text c="dimmed">No workflow executions for this client.</Text>
      ) : (
        <Stack gap="md">
          {workflowExecutions.map((execution) => (
            <Paper key={execution.id} p="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <Stack gap={0}>
                  <Group gap="sm">
                    <Text fw={500}>{execution.workflowName}</Text>
                    <Badge
                      color={
                        execution.status === 'COMPLETED' ? 'green' :
                        execution.status === 'RUNNING' ? 'blue' :
                        execution.status === 'PAUSED' ? 'orange' :
                        execution.status === 'FAILED' ? 'red' :
                        'gray'
                      }
                      variant="light"
                    >
                      {execution.status}
                    </Badge>
                  </Group>
                  {execution.errorMessage && (
                    <Text size="sm" c="red">{execution.errorMessage}</Text>
                  )}
                  <Group gap="xs" mt="xs">
                    <Text size="xs" c="dimmed">
                      Started: {new Date(execution.startedAt || execution.createdAt).toLocaleString()}
                    </Text>
                    {execution.completedAt && (
                      <Text size="xs" c="dimmed">
                        • Completed: {new Date(execution.completedAt).toLocaleString()}
                      </Text>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Step: {execution.currentStep}
                  </Text>
                </Stack>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => window.open(`/workflows/executions?execution_id=${execution.id}`, '_blank')}
                >
                  View Details
                </Button>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </>
  );
}
