import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Group,
  Stack,
  Text,
  SimpleGrid,
  Card,
  ThemeIcon,
  Badge,
  Loader,
  Center,
  Progress,
  Table,
  Tooltip,
  Select,
} from '@mantine/core';
import {
  IconChartBar,
  IconUsers,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconArrowRight,
  IconCalendar,
  IconRobot,
  IconCheck,
  IconX,
  IconClock,
  IconMail,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import { PIPELINE_STAGES as SHARED_PIPELINE_STAGES } from '../utils/constants';

// Analytics uses hex colors from the shared stages
const PIPELINE_STAGES = SHARED_PIPELINE_STAGES.map(s => ({ ...s, color: s.hex }));

interface PipelineData {
  stage: string;
  label: string;
  count: number;
  color: string;
  percentage: number;
}

interface AnalyticsData {
  totalClients: number;
  pipelineData: PipelineData[];
  conversionRate: number;
  avgTimeInPipeline: number;
}

interface WorkflowAnalyticsData {
  overview: {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    runningExecutions: number;
    pendingExecutions: number;
    successRate: number;
    avgExecutionTime: number;
  };
  mostTriggeredWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    triggerType: string;
    isActive: boolean;
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
  }>;
  timeSeries: Array<{ date: string; count: number }>;
}

interface CommunicationsAnalyticsData {
  overview: {
    totalCommunications: number;
    totalAllTime: number;
    sentCommunications: number;
    draftCommunications: number;
    readyCommunications: number;
    failedCommunications: number;
    sendRate: number;
  };
  countsByType: {
    EMAIL: number;
    SMS: number;
    LETTER: number;
  };
  countsByStatus: {
    DRAFT: number;
    READY: number;
    SENT: number;
    FAILED: number;
  };
  timeSeries: Array<{ date: string; count: number; sent: number }>;
}

// Date range options
const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
];

export default function Analytics() {
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');

  const { data: analyticsBundle, isLoading: loading } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const days = dateRange === 'all' ? '365' : dateRange;
      const clientStatsPath = dateRange === 'all'
        ? '/clients/statistics'
        : `/clients/statistics?days=${dateRange}`;

      const [clientStatsRes, workflowRes, commsRes] = await Promise.allSettled([
        api.get(clientStatsPath),
        api.get(`/analytics/workflows?days=${days}`),
        api.get(`/analytics/communications?days=${days}&group_by=day`),
      ]);

      // Process clients analytics
      let data: AnalyticsData | null = null;
      if (clientStatsRes.status === 'fulfilled' && clientStatsRes.value.ok) {
        const clientStatsPayload = await clientStatsRes.value.json();
        const clientsByStatus = (
          clientStatsPayload?.byStatus && typeof clientStatsPayload.byStatus === 'object'
            ? clientStatsPayload.byStatus
            : {}
        ) as Record<string, number>;
        const totalClients = Number(clientStatsPayload?.totalClients ?? 0);

        const pipelineData: PipelineData[] = PIPELINE_STAGES.map((stage) => ({
          stage: stage.key, label: stage.label, count: clientsByStatus[stage.key] || 0, color: stage.color,
          percentage: totalClients > 0 ? ((clientsByStatus[stage.key] || 0) / totalClients) * 100 : 0,
        }));
        const closedCount = clientsByStatus['CLOSED'] || 0;
        const deniedCount = clientsByStatus['DENIED'] || 0;
        const totalNonDenied = totalClients - deniedCount;
        const conversionRate = totalNonDenied > 0 ? (closedCount / totalNonDenied) * 100 : 0;
        data = { totalClients, pipelineData, conversionRate, avgTimeInPipeline: 0 };
      }

      let workflowData: WorkflowAnalyticsData | null = null;
      if (workflowRes.status === 'fulfilled' && workflowRes.value.ok) {
        workflowData = await workflowRes.value.json();
      }

      let communicationsData: CommunicationsAnalyticsData | null = null;
      if (commsRes.status === 'fulfilled' && commsRes.value.ok) {
        communicationsData = await commsRes.value.json();
      }

      return { data, workflowData, communicationsData };
    },
    enabled: !!accessToken,
  });

  const data = analyticsBundle?.data ?? null;
  const workflowData = analyticsBundle?.workflowData ?? null;
  const communicationsData = analyticsBundle?.communicationsData ?? null;

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (!data) {
    return (
      <Center h={400}>
        <Text c="dimmed">Failed to load analytics data</Text>
      </Center>
    );
  }

  // Find max count for chart scaling
  const maxCount = Math.max(...data.pipelineData.map((d) => d.count), 1);

  return (
    <Container size="xl" py="md">
      <Group mb="lg" justify="space-between">
        <Group>
          <ThemeIcon size="xl" variant="light" color="blue">
            <IconChartBar size={24} aria-hidden="true" />
          </ThemeIcon>
          <Title order={2}>Analytics</Title>
        </Group>
        <Select
          value={dateRange}
          onChange={(value) => setDateRange(value || 'all')}
          data={DATE_RANGE_OPTIONS}
          leftSection={<IconCalendar size={16} aria-hidden="true" />}
          style={{ width: 160 }}
          aria-label="Date range filter"
        />
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        <Card padding="lg" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Clients
              </Text>
              <Text size="xl" fw={700}>
                {data.totalClients}
              </Text>
            </div>
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconUsers size={20} aria-hidden="true" />
            </ThemeIcon>
          </Group>
        </Card>

        <Card padding="lg" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Active Pipeline
              </Text>
              <Text size="xl" fw={700}>
                {data.pipelineData
                  .filter((d) => !['CLOSED', 'DENIED'].includes(d.stage))
                  .reduce((sum, d) => sum + d.count, 0)}
              </Text>
            </div>
            <ThemeIcon size="lg" variant="light" color="green">
              <IconTrendingUp size={20} aria-hidden="true" />
            </ThemeIcon>
          </Group>
        </Card>

        <Card padding="lg" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Closed Deals
              </Text>
              <Text size="xl" fw={700}>
                {data.pipelineData.find((d) => d.stage === 'CLOSED')?.count || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" variant="light" color="teal">
              <IconTrendingUp size={20} aria-hidden="true" />
            </ThemeIcon>
          </Group>
        </Card>

        <Card padding="lg" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Conversion Rate
              </Text>
              <Text size="xl" fw={700}>
                {data.conversionRate.toFixed(1)}%
              </Text>
            </div>
            <ThemeIcon
              size="lg"
              variant="light"
              color={data.conversionRate >= 50 ? 'green' : data.conversionRate >= 25 ? 'yellow' : 'red'}
            >
              {data.conversionRate >= 50 ? (
                <IconTrendingUp size={20} aria-hidden="true" />
              ) : data.conversionRate >= 25 ? (
                <IconMinus size={20} aria-hidden="true" />
              ) : (
                <IconTrendingDown size={20} aria-hidden="true" />
              )}
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Pipeline Chart */}
      <Paper shadow="xs" p="lg" withBorder mb="xl">
        <Title order={4} mb="md">
          Pipeline Overview
        </Title>
        <Text size="sm" c="dimmed" mb="lg">
          Distribution of clients across pipeline stages
        </Text>

        {/* Bar Chart — click any row to drill into that pipeline stage */}
        <Stack gap="xs" mb="xl">
          {data.pipelineData.map((stage) => (
            <Group
              key={stage.stage}
              gap="md"
              style={{ cursor: stage.count > 0 ? 'pointer' : 'default' }}
              onMouseEnter={() => setHoveredStage(stage.stage)}
              onMouseLeave={() => setHoveredStage(null)}
              onClick={() => stage.count > 0 && navigate(`/clients?status=${stage.stage}`)}
              aria-label={stage.count > 0 ? `View ${stage.count} ${stage.label} clients` : undefined}
            >
              <Text size="sm" w={120} ta="right" fw={hoveredStage === stage.stage ? 600 : 400}>
                {stage.label}
              </Text>
              <Tooltip
                label={`${stage.count} clients (${stage.percentage.toFixed(1)}%)`}
                position="right"
                withArrow
                opened={hoveredStage === stage.stage}
              >
                <div style={{ flex: 1, position: 'relative' }}>
                  <Progress.Root size={28}>
                    <Progress.Section
                      value={(stage.count / maxCount) * 100}
                      color={stage.color}
                      style={{
                        transition: 'all 0.2s ease',
                        transform: hoveredStage === stage.stage ? 'scaleY(1.1)' : 'scaleY(1)',
                      }}
                    >
                      <Progress.Label>
                        {stage.count > 0 ? stage.count : ''}
                      </Progress.Label>
                    </Progress.Section>
                  </Progress.Root>
                </div>
              </Tooltip>
              <Text size="sm" w={50} c="dimmed">
                {stage.percentage.toFixed(0)}%
              </Text>
            </Group>
          ))}
        </Stack>

        {/* Pipeline Flow Visualization */}
        <Paper p="md" bg="gray.0" radius="md">
          <Text size="sm" fw={600} mb="sm">
            Pipeline Flow
          </Text>
          <Group gap="xs" wrap="nowrap" style={{ overflowX: 'auto' }}>
            {data.pipelineData
              .filter((d) => !['DENIED'].includes(d.stage))
              .map((stage, index, arr) => (
                <Group key={stage.stage} gap="xs" wrap="nowrap">
                  <Badge
                    size="lg"
                    color={stage.color}
                    variant={hoveredStage === stage.stage ? 'filled' : 'light'}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={() => setHoveredStage(stage.stage)}
                    onMouseLeave={() => setHoveredStage(null)}
                  >
                    {stage.label}: {stage.count}
                  </Badge>
                  {index < arr.length - 1 && (
                    <IconArrowRight size={16} color="gray" aria-hidden="true" />
                  )}
                </Group>
              ))}
          </Group>
        </Paper>
      </Paper>

      {/* Detailed Breakdown Table */}
      <Paper shadow="xs" p="lg" withBorder>
        <Title order={4} mb="md">
          Stage Breakdown
        </Title>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Stage</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Count</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Percentage</Table.Th>
              <Table.Th>Distribution</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.pipelineData.map((stage) => (
              <Table.Tr
                key={stage.stage}
                style={{
                  backgroundColor:
                    hoveredStage === stage.stage ? 'var(--mantine-color-blue-0)' : undefined,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredStage(stage.stage)}
                onMouseLeave={() => setHoveredStage(null)}
              >
                <Table.Td>
                  <Group gap="xs">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        backgroundColor: stage.color,
                      }}
                    />
                    <Text fw={500}>{stage.label}</Text>
                  </Group>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={600}>{stage.count}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text c="dimmed">{stage.percentage.toFixed(1)}%</Text>
                </Table.Td>
                <Table.Td>
                  <Progress
                    value={stage.percentage}
                    color={stage.color}
                    size="sm"
                    style={{ minWidth: 100 }}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Workflow Analytics Section */}
      <Paper shadow="xs" p="lg" withBorder mt="xl">
        <Title order={3} mb="md">
          <Group gap="xs">
            <IconRobot size={24} aria-hidden="true" />
            Workflow Analytics
          </Group>
        </Title>

        {workflowData ? (
          <Stack gap="lg">
            {/* Workflow Summary Cards */}
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Total Executions
                    </Text>
                    <Text size="xl" fw={700}>
                      {workflowData.overview.totalExecutions}
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconRobot size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>

              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Success Rate
                    </Text>
                    <Text size="xl" fw={700} c="green">
                      {workflowData.overview.successRate.toFixed(1)}%
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="green">
                    <IconCheck size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>

              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Failed
                    </Text>
                    <Text size="xl" fw={700} c="red">
                      {workflowData.overview.failedExecutions}
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="red">
                    <IconX size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>

              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Avg Duration
                    </Text>
                    <Text size="xl" fw={700}>
                      {workflowData.overview.avgExecutionTime > 0
                        ? `${(workflowData.overview.avgExecutionTime / 1000).toFixed(1)}s`
                        : 'N/A'}
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="orange">
                    <IconClock size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>
            </SimpleGrid>

            {/* Most Triggered Workflows Table */}
            {workflowData.mostTriggeredWorkflows.length > 0 && (
              <Card withBorder>
                <Title order={4} mb="sm">
                  Most Triggered Workflows
                </Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Workflow</Table.Th>
                      <Table.Th ta="right">Executions</Table.Th>
                      <Table.Th ta="right">Completed</Table.Th>
                      <Table.Th ta="right">Failed</Table.Th>
                      <Table.Th ta="right">Avg Time</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {workflowData.mostTriggeredWorkflows.map((workflow) => (
                      <Table.Tr key={workflow.workflowId}>
                        <Table.Td>
                          <Stack gap={0}>
                            <Text fw={500}>{workflow.workflowName}</Text>
                            <Text size="xs" c="dimmed">
                              {workflow.triggerType}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600}>{workflow.totalExecutions}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text c="green">{workflow.completedExecutions}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text c="red">{workflow.failedExecutions}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">
                            {workflow.avgExecutionTime > 0
                              ? `${(workflow.avgExecutionTime / 1000).toFixed(1)}s`
                              : 'N/A'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            )}

            {/* Empty state for no workflow data */}
            {workflowData.mostTriggeredWorkflows.length === 0 && (
              <Card withBorder>
                <Stack align="center" gap="sm" py="xl">
                  <ThemeIcon size={64} radius="xl" color="blue" variant="light">
                    <IconRobot size={32} aria-hidden="true" />
                  </ThemeIcon>
                  <Text size="lg" fw={600} c="dimmed">
                    No workflow executions yet
                  </Text>
                  <Text size="sm" c="dimmed">
                    Workflow analytics will appear here once workflows are executed
                  </Text>
                </Stack>
              </Card>
            )}
          </Stack>
        ) : (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        )}
      </Paper>

      {/* Communications Analytics Section */}
      <Paper shadow="xs" p="lg" withBorder mt="xl">
        <Title order={3} mb="md">
          <Group gap="xs">
            <IconMail size={24} aria-hidden="true" />
            Communications Analytics
          </Group>
        </Title>

        {communicationsData ? (
          <Stack gap="lg">
            {/* Communications Summary Cards */}
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Total Communications
                    </Text>
                    <Text size="xl" fw={700}>
                      {communicationsData.overview.totalCommunications}
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconMail size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>

              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Sent
                    </Text>
                    <Text size="xl" fw={700} c="green">
                      {communicationsData.overview.sentCommunications}
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="green">
                    <IconCheck size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>

              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Draft
                    </Text>
                    <Text size="xl" fw={700} c="gray">
                      {communicationsData.overview.draftCommunications}
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="gray">
                    <IconClock size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>

              <Card padding="lg" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Send Rate
                    </Text>
                    <Text size="xl" fw={700} c="blue">
                      {communicationsData.overview.sendRate.toFixed(1)}%
                    </Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconTrendingUp size={20} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Card>
            </SimpleGrid>

            {/* By Type and Status */}
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Card withBorder>
                <Title order={5} mb="sm">
                  By Type
                </Title>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm">Email</Text>
                    <Badge color="blue">{communicationsData.countsByType.EMAIL}</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">SMS</Text>
                    <Badge color="cyan">{communicationsData.countsByType.SMS}</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Letter</Text>
                    <Badge color="grape">{communicationsData.countsByType.LETTER}</Badge>
                  </Group>
                </Stack>
              </Card>

              <Card withBorder>
                <Title order={5} mb="sm">
                  By Status
                </Title>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm">Sent</Text>
                    <Badge color="green">{communicationsData.countsByStatus.SENT}</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Ready</Text>
                    <Badge color="cyan">{communicationsData.countsByStatus.READY}</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Draft</Text>
                    <Badge color="gray">{communicationsData.countsByStatus.DRAFT}</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Failed</Text>
                    <Badge color="red">{communicationsData.countsByStatus.FAILED}</Badge>
                  </Group>
                </Stack>
              </Card>
            </SimpleGrid>

            {/* Empty state for no communications data */}
            {communicationsData.overview.totalCommunications === 0 && (
              <Card withBorder>
                <Stack align="center" gap="sm" py="xl">
                  <ThemeIcon size={64} radius="xl" color="blue" variant="light">
                    <IconMail size={32} aria-hidden="true" />
                  </ThemeIcon>
                  <Text size="lg" fw={600} c="dimmed">
                    No communications yet
                  </Text>
                  <Text size="sm" c="dimmed">
                    Communication analytics will appear here once you send messages
                  </Text>
                </Stack>
              </Card>
            )}
          </Stack>
        ) : (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        )}
      </Paper>
    </Container>
  );
}
