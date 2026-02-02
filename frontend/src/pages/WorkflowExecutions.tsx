import React, { useState, useEffect } from 'react';
import {
  Title,
  Stack,
  Paper,
  Table,
  Button,
  Group,
  Badge,
  Text,
  LoadingOverlay,
  TextInput,
  Select,
  Container,
  Pagination,
  Box,
  Drawer,
  ScrollArea,
  Timeline,
  Alert,
  JsonInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconRefresh,
  IconEye,
  IconX,
  IconClock,
  IconCheck,
  IconCircleX,
  IconLoader,
  IconBan,
  IconCircle,
  IconPlayerPause,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowTriggerType: string;
  clientId: string | null;
  clientName: string | null;
  status: string;
  triggerData: any;
  currentStep: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ExecutionLog {
  stepIndex: number;
  actionType: string;
  status: string;
  inputData: any;
  outputData: any;
  errorMessage: string | null;
  executedAt: string;
}

interface ExecutionDetail {
  id: string;
  workflowId: string;
  workflow: {
    id: string;
    name: string;
    description: string;
    triggerType: string;
    actions: any[];
  };
  clientId: string | null;
  client: {
    id: string;
    name: string;
    status: string;
  } | null;
  status: string;
  triggerData: any;
  currentStep: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  logs: any[];
  createdAt: string;
}

interface ExecutionsResponse {
  executions: WorkflowExecution[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'blue',
  RUNNING: 'cyan',
  COMPLETED: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
  SKIPPED: 'yellow',
};

// Status icons
const STATUS_ICONS: Record<string, any> = {
  PENDING: IconClock,
  RUNNING: IconLoader,
  PAUSED: IconPlayerPause,
  COMPLETED: IconCheck,
  FAILED: IconCircleX,
  CANCELLED: IconBan,
  SKIPPED: IconX,
};

// Helper to render status icon
const renderStatusIcon = (status: string) => {
  const IconComponent = STATUS_ICONS[status] || IconCircle;
  return <IconComponent size={14} />;
};

export function WorkflowExecutions() {
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Detail drawer
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pausing, setPausing] = useState<string | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);

  // Read URL query params on mount
  useEffect(() => {
    const workflowIdParam = searchParams.get('workflow_id');
    if (workflowIdParam) {
      setWorkflowFilter(workflowIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchExecutions();
  }, [pagination.page, statusFilter, workflowFilter, clientFilter]);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (workflowFilter !== 'all') {
        params.append('workflow_id', workflowFilter);
      }

      if (clientFilter) {
        params.append('client_id', clientFilter);
      }

      const response = await fetch(`${API_URL}/workflow-executions?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch executions');
      }

      const data: ExecutionsResponse = await response.json();
      setExecutions(data.executions);
      setPagination({
        page: data.pagination.page,
        limit: data.pagination.limit,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      });
    } catch (error) {
      console.error('Error fetching executions:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load workflow executions',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const viewExecutionDetails = async (executionId: string) => {
    setLoadingDetail(true);
    setDrawerOpened(true);

    try {
      const response = await fetch(`${API_URL}/workflow-executions/${executionId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch execution details');
      }

      const data: ExecutionDetail = await response.json();
      setSelectedExecution(data);
    } catch (error) {
      console.error('Error fetching execution details:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load execution details',
        color: 'red',
      });
      setDrawerOpened(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const cancelExecution = async (executionId: string) => {
    if (!confirm('Are you sure you want to cancel this execution?')) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch(`${API_URL}/workflow-executions/${executionId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel execution');
      }

      notifications.show({
        title: 'Success',
        message: 'Execution cancelled successfully',
        color: 'green',
      });

      // Refresh executions and detail
      fetchExecutions();
      if (selectedExecution && selectedExecution.id === executionId) {
        viewExecutionDetails(executionId);
      }
    } catch (error) {
      console.error('Error cancelling execution:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to cancel execution',
        color: 'red',
      });
    } finally {
      setCancelling(false);
    }
  };

  const pauseExecution = async (executionId: string) => {
    setPausing(executionId);
    try {
      const response = await fetch(`${API_URL}/workflows/executions/${executionId}/pause`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to pause execution');
      }

      notifications.show({
        title: 'Success',
        message: 'Execution paused successfully',
        color: 'green',
      });

      // Refresh executions and detail
      fetchExecutions();
      if (selectedExecution && selectedExecution.id === executionId) {
        viewExecutionDetails(executionId);
      }
    } catch (error) {
      console.error('Error pausing execution:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to pause execution',
        color: 'red',
      });
    } finally {
      setPausing(null);
    }
  };

  const resumeExecution = async (executionId: string) => {
    setResuming(executionId);
    try {
      const response = await fetch(`${API_URL}/workflows/executions/${executionId}/resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to resume execution');
      }

      notifications.show({
        title: 'Success',
        message: 'Execution resumed successfully',
        color: 'green',
      });

      // Refresh executions and detail
      fetchExecutions();
      if (selectedExecution && selectedExecution.id === executionId) {
        viewExecutionDetails(executionId);
      }
    } catch (error) {
      console.error('Error resuming execution:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to resume execution',
        color: 'red',
      });
    } finally {
      setResuming(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return 'Running...';
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs % 60}s`;
    }
    return `${diffSecs}s`;
  };

  const filteredExecutions = executions.filter(
    (execution) =>
      execution.workflowName.toLowerCase().includes(search.toLowerCase()) ||
      execution.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      execution.id.toLowerCase().includes(search.toLowerCase())
  );

  const rows = filteredExecutions.map((execution) => (
    <Table.Tr key={execution.id}>
      <Table.Td>{execution.workflowName}</Table.Td>
      <Table.Td>
        {execution.clientName ? (
          <Text
            size="sm"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/clients/${execution.clientId}`);
            }}
          >
            {execution.clientName}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            No client
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge
          leftSection={renderStatusIcon(execution.status)}
          color={STATUS_COLORS[execution.status] || 'gray'}
        >
          {execution.status}
        </Badge>
      </Table.Td>
      <Table.Td>{formatDate(execution.startedAt)}</Table.Td>
      <Table.Td>{formatDuration(execution.startedAt, execution.completedAt)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEye size={14} />}
            onClick={() => viewExecutionDetails(execution.id)}
          >
            View
          </Button>
          {execution.status === 'RUNNING' && (
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconPlayerPause size={14} />}
              loading={pausing === execution.id}
              onClick={() => pauseExecution(execution.id)}
            >
              Pause
            </Button>
          )}
          {execution.status === 'PAUSED' && (
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconPlayerPlay size={14} />}
              loading={resuming === execution.id}
              onClick={() => resumeExecution(execution.id)}
            >
              Resume
            </Button>
          )}
          {(execution.status === 'RUNNING' || execution.status === 'PENDING') && (
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconBan size={14} />}
              loading={cancelling}
              onClick={() => cancelExecution(execution.id)}
            >
              Cancel
            </Button>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>Workflow Executions</Title>
          <Button
            leftSection={<IconRefresh size={14} />}
            onClick={fetchExecutions}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>

        <Paper p="md" withBorder>
          <Group mb="md">
            <TextInput
              placeholder="Search by workflow, client, or ID..."
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'RUNNING', label: 'Running' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'FAILED', label: 'Failed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || 'all')}
              width={200}
            />
          </Group>

          <Box pos="relative">
            <LoadingOverlay visible={loading} />
            <Table.ScrollContainer minWidth={800}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Workflow</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Started</Table.Th>
                    <Table.Th>Duration</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Box>

          {filteredExecutions.length === 0 && !loading && (
            <Text c="dimmed" ta="center" py="xl">
              No executions found
            </Text>
          )}

          {pagination.totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={pagination.totalPages}
                value={pagination.page}
                onChange={(page) => setPagination({ ...pagination, page })}
              />
            </Group>
          )}
        </Paper>

        {/* Detail Drawer */}
        <Drawer
          opened={drawerOpened}
          onClose={() => setDrawerOpened(false)}
          title="Execution Details"
          position="right"
          size="xl"
        >
          <ScrollArea.Autosize mah="calc(100vh - 100px)">
            {loadingDetail ? (
              <LoadingOverlay visible />
            ) : selectedExecution ? (
              <Stack gap="md">
                {/* Header */}
                <Paper p="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="lg" fw={500}>
                        {selectedExecution.workflow.name}
                      </Text>
                      <Badge
                        color={STATUS_COLORS[selectedExecution.status] || 'gray'}
                        leftSection={renderStatusIcon(selectedExecution.status)}
                      >
                        {selectedExecution.status}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {selectedExecution.workflow.description}
                    </Text>
                  </Stack>
                </Paper>

                {/* Info */}
                <Paper p="md" withBorder>
                  <Stack gap="xs">
                    <Text size="sm">
                      <Text span fw={500}>
                        Client:
                      </Text>{' '}
                      {selectedExecution.client ? (
                        <Text
                          span
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/clients/${selectedExecution.clientId}`)}
                          c="blue"
                        >
                          {selectedExecution.client.name}
                        </Text>
                      ) : (
                        'None'
                      )}
                    </Text>
                    <Text size="sm">
                      <Text span fw={500}>
                        Started:
                      </Text>{' '}
                      {formatDate(selectedExecution.startedAt)}
                    </Text>
                    <Text size="sm">
                      <Text span fw={500}>
                        Completed:
                      </Text>{' '}
                      {formatDate(selectedExecution.completedAt)}
                    </Text>
                    <Text size="sm">
                      <Text span fw={500}>
                        Duration:
                      </Text>{' '}
                      {formatDuration(selectedExecution.startedAt, selectedExecution.completedAt)}
                    </Text>
                    <Text size="sm">
                      <Text span fw={500}>
                        Current Step:
                      </Text>{' '}
                      {selectedExecution.currentStep}
                    </Text>
                  </Stack>

                  {selectedExecution.errorMessage && (
                    <Alert color="red" title="Error" icon={<IconXcircle size={16} />}>
                      {selectedExecution.errorMessage}
                    </Alert>
                  )}

                  {selectedExecution.status === 'RUNNING' && (
                    <Button
                      color="orange"
                      leftSection={<IconPlayerPause size={14} />}
                      loading={pausing === selectedExecution.id}
                      onClick={() => pauseExecution(selectedExecution.id)}
                    >
                      Pause Execution
                    </Button>
                  )}
                  {selectedExecution.status === 'PAUSED' && (
                    <Button
                      color="green"
                      leftSection={<IconPlayerPlay size={14} />}
                      loading={resuming === selectedExecution.id}
                      onClick={() => resumeExecution(selectedExecution.id)}
                    >
                      Resume Execution
                    </Button>
                  )}
                  {(selectedExecution.status === 'RUNNING' || selectedExecution.status === 'PENDING') && (
                    <Button
                      color="red"
                      leftSection={<IconBan size={14} />}
                      loading={cancelling}
                      onClick={() => cancelExecution(selectedExecution.id)}
                    >
                      Cancel Execution
                    </Button>
                  )}
                </Paper>

                {/* Trigger Data */}
                {selectedExecution.triggerData && (
                  <Paper p="md" withBorder>
                    <Text fw={500} mb="xs">
                      Trigger Data
                    </Text>
                    <JsonInput
                      value={JSON.stringify(selectedExecution.triggerData, null, 2)}
                      readOnly
                      formatOnBlur
                      autosize
                      minRows={2}
                    />
                  </Paper>
                )}

                {/* Execution Logs */}
                <Paper p="md" withBorder>
                  <Text fw={500} mb="md">
                    Execution Logs
                  </Text>
                  {selectedExecution.logs && selectedExecution.logs.length > 0 ? (
                    <Timeline bulletSize={24}>
                      {selectedExecution.logs.map((log: any, index: number) => (
                        <Timeline.Item
                          key={index}
                          bullet={
                            log.status === 'SUCCESS' ? (
                              <IconCheck size={12} />
                            ) : (
                              <IconX size={12} />
                            )
                          }
                          color={log.status === 'SUCCESS' ? 'green' : 'red'}
                        >
                          <Stack gap="xs">
                            <Group gap="xs">
                              <Badge size="xs">{log.actionType}</Badge>
                              <Text size="xs" c="dimmed">
                                {formatDate(log.executedAt || log.timestamp)}
                              </Text>
                            </Group>
                            {log.errorMessage && (
                              <Text size="sm" c="red">
                                {log.errorMessage}
                              </Text>
                            )}
                          </Stack>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  ) : (
                    <Text c="dimmed" size="sm">
                      No logs available
                    </Text>
                  )}
                </Paper>
              </Stack>
            ) : (
              <Text c="dimmed">No execution selected</Text>
            )}
          </ScrollArea.Autosize>
        </Drawer>
      </Stack>
    </Container>
  );
}
