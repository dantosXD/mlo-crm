import { Paper, Title, Group, Stack, Text, Badge, Button, Progress, ThemeIcon } from '@mantine/core';
import { IconRobot, IconCheck, IconX, IconLoader, IconClock, IconArrowRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

interface WorkflowExecution {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  workflow: {
    id: string;
    name: string;
  };
  client?: {
    id: string;
    name: string;
  } | null;
}

interface WorkflowStatusWidgetProps {
  activeWorkflows: number;
  completedToday: number;
  failedToday: number;
  runningExecutions: WorkflowExecution[];
  loading?: boolean;
}

export function WorkflowStatusWidget({
  activeWorkflows,
  completedToday,
  failedToday,
  runningExecutions,
  loading = false,
}: WorkflowStatusWidgetProps) {
  const navigate = useNavigate();

  const totalExecutions = completedToday + failedToday;
  const successRate = totalExecutions > 0 ? (completedToday / totalExecutions) * 100 : 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <IconCheck size={14} />;
      case 'FAILED':
        return <IconX size={14} />;
      case 'RUNNING':
        return <IconLoader size={14} className="spin-animation" />;
      case 'PENDING':
        return <IconClock size={14} />;
      default:
        return <IconClock size={14} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'FAILED':
        return 'red';
      case 'RUNNING':
        return 'blue';
      case 'PENDING':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
    return `${Math.floor(diffMs / 60000)}m`;
  };

  return (
    <Paper shadow="sm" p="md" radius="md" withBorder h="100%">
      <Title order={4} mb="md">
        <Group justify="space-between">
          <Group gap="xs">
            <IconRobot size={20} aria-hidden="true" />
            Workflow Activity
          </Group>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconArrowRight size={14} />}
            onClick={() => navigate('/workflows/executions')}
          >
            View All
          </Button>
        </Group>
      </Title>

      {loading ? (
        <Group justify="center" p="xl">
          <IconRobot size={32} className="spin-animation" />
        </Group>
      ) : (
        <Stack gap="sm">
          {/* Stats Overview */}
          <Group grow>
            <div>
              <Text size="xs" c="dimmed">Active</Text>
              <Text size="lg" fw={700} c="blue">
                {activeWorkflows}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Completed Today</Text>
              <Text size="lg" fw={700} c="green">
                {completedToday}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Failed Today</Text>
              <Text size="lg" fw={700} c="red">
                {failedToday}
              </Text>
            </div>
          </Group>

          {/* Success Rate */}
          {totalExecutions > 0 && (
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">Success Rate</Text>
                <Text size="xs" fw={500}>{successRate.toFixed(0)}%</Text>
              </Group>
              <Progress
                value={successRate}
                color={successRate >= 80 ? 'green' : successRate >= 50 ? 'yellow' : 'red'}
                size="sm"
                radius="xl"
              />
            </div>
          )}

          {/* Currently Running */}
          {runningExecutions.length > 0 && (
            <Stack gap="xs" mt="xs">
              <Text size="xs" c="dimmed" fw={500}>Currently Running</Text>
              {runningExecutions.slice(0, 3).map((execution) => (
                <Group key={execution.id} justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon size={20} radius="xl" color={getStatusColor(execution.status)} variant="light">
                      {getStatusIcon(execution.status)}
                    </ThemeIcon>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={500} truncate>
                        {execution.workflow.name}
                      </Text>
                      {execution.client && (
                        <Text size="xs" c="dimmed" truncate>
                          {execution.client.name}
                        </Text>
                      )}
                    </div>
                  </Group>
                  <Text size="xs" c="dimmed" miw="40px" ta="right">
                    {formatDuration(execution.startedAt, execution.completedAt)}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}

          {/* Empty State */}
          {activeWorkflows === 0 && totalExecutions === 0 && (
            <EmptyState
              iconType="workflows"
              title="No workflow activity"
              description="Automated workflows will appear here"
            />
          )}
        </Stack>
      )}
    </Paper>
  );
}
