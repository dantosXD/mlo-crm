import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Select,
  Button,
  Alert,
  Group,
  Badge,
  Paper,
  Code,
  Timeline,
  Accordion,
  Card,
  JsonInput,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconPlayerPlay,
  IconClock,
  IconSettings,
  IconBolt,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';

type WorkflowActionMode = 'test' | 'run';

interface TestWorkflowModalProps {
  opened: boolean;
  onClose: () => void;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  actions?: any[];
  mode?: WorkflowActionMode;
  isActive?: boolean;
  onExecutionCreated?: (executionId: string) => void;
}

export default function TestWorkflowModal({
  opened,
  onClose,
  workflowId,
  workflowName,
  triggerType,
  actions = [],
  mode = 'test',
  isActive = true,
  onExecutionCreated,
}: TestWorkflowModalProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [triggerDataInput, setTriggerDataInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const isRunMode = mode === 'run';

  useEffect(() => {
    if (!opened) return;
    setSelectedClientId('');
    setTriggerDataInput('');
    setResult(null);
    setError('');
  }, [opened, workflowId, mode]);

  // Fetch clients for selection
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['workflow-modal-clients', workflowId],
    queryFn: async () => {
      const response = await api.get('/clients?limit=200');
      if (!response.ok) throw new Error('Failed to fetch clients');
      const payload = await response.json();

      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.clients)) return payload.clients;

      return [];
    },
    enabled: opened,
    staleTime: 30_000,
  });

  const selectedClient = useMemo(
    () => clients?.find((client: any) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const parseTriggerData = () => {
    const trimmed = triggerDataInput.trim();
    if (!trimmed) return undefined;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Trigger data must be valid JSON');
    }

    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Trigger data must be a JSON object');
    }

    return parsed as Record<string, unknown>;
  };

  // Execute or test the workflow
  const handleSubmit = async () => {
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }

    let triggerData: Record<string, unknown> | undefined;
    try {
      triggerData = parseTriggerData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid trigger data');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setResult(null);

    try {
      const endpoint = isRunMode ? `/workflows/${workflowId}/execute` : `/workflows/${workflowId}/test`;
      const response = await api.post(endpoint, {
        clientId: selectedClientId,
        ...(triggerData ? { triggerData } : {}),
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData.message || (isRunMode ? 'Failed to run workflow' : 'Failed to test workflow'));
      }

      setResult(responseData);
    } catch (err: any) {
      setError(err.message || (isRunMode ? 'Failed to run workflow' : 'Failed to test workflow'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetResult = () => {
    setResult(null);
    setError('');
  };

  const handleClose = () => {
    resetResult();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="xl"
      title={
        <Group gap="xs">
          {isRunMode
            ? <IconPlayerPlay size={18} color="var(--mantine-color-green-6)" />
            : <IconSettings size={18} color="var(--mantine-color-blue-6)" />}
          <Text fw={700} c={isRunMode ? 'green.7' : 'blue.7'}>
            {isRunMode ? 'Run Workflow With Context' : 'Test Workflow With Context'}
          </Text>
        </Group>
      }
      styles={{
        header: {
          backgroundColor: isRunMode ? 'var(--mantine-color-green-0)' : 'var(--mantine-color-blue-0)',
          borderBottom: `2px solid ${isRunMode ? 'var(--mantine-color-green-3)' : 'var(--mantine-color-blue-3)'}`,
        },
      }}
    >
      <Stack gap="md">
        {/* Run mode live-data warning */}
        {isRunMode && (
          <Alert color="orange" icon={<IconAlertTriangle size={16} />} variant="light">
            <Text size="sm" fw={500}>Live execution — real changes will be made to the client record.</Text>
          </Alert>
        )}

        {/* Workflow Info */}
        <Paper withBorder p="md" bg="gray.0">
          <Stack gap="xs">
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed">
                  Workflow
                </Text>
                <Text fw={600}>{workflowName}</Text>
              </div>
              <Group gap="xs">
                <Badge color={isRunMode ? 'green' : 'blue'}>{isRunMode ? 'Run' : 'Dry Run'}</Badge>
                <Badge color="blue">{triggerType}</Badge>
              </Group>
            </Group>
            {actions.length > 0 && (
              <Text size="xs" c="dimmed">
                Actions: {actions.length}
              </Text>
            )}
          </Stack>
        </Paper>

        {/* Client Selection */}
        {!result && (
          <Stack gap="sm">
            <Text fw={600}>{isRunMode ? 'Select Run Context' : 'Select Test Context'}</Text>

            {isRunMode && !isActive && (
              <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
                This workflow is <strong>inactive</strong>. Enable it before running to avoid errors.
              </Alert>
            )}
            <Select
              label="Client"
              placeholder="Select a client"
              data={clients?.map((client: any) => ({
                value: client.id,
                label: `${client.name} (${client.status})`,
              })) || []}
              value={selectedClientId}
              onChange={(value) => setSelectedClientId(value || '')}
              disabled={clientsLoading || isSubmitting}
              searchable
              required
            />

            <JsonInput
              label="Trigger Data (optional)"
              description="Provide JSON payload to simulate trigger context."
              placeholder='{"source":"manual","reason":"qa"}'
              value={triggerDataInput}
              onChange={setTriggerDataInput}
              autosize
              minRows={3}
              maxRows={8}
              readOnly={isSubmitting}
            />

            <Text size="xs" c="dimmed">
              {isRunMode
                ? 'This executes the workflow against the selected client.'
                : 'This tests the workflow in dry-run mode. No data will be changed.'}
            </Text>

            {!clientsLoading && (clients?.length ?? 0) === 0 && (
              <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
                No clients are available. Create at least one client to run this workflow.
              </Alert>
            )}

            {error && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                {error}
              </Alert>
            )}

            <Group justify="flex-end">
              <Button variant="light" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                leftSection={<IconPlayerPlay size={16} />}
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={!selectedClientId || (isRunMode && !isActive)}
              >
                {isRunMode ? 'Run Workflow' : 'Run Test'}
              </Button>
            </Group>
          </Stack>
        )}

        {/* Test Results */}
        {result && (
          <Stack gap="md">
            {isRunMode ? (
              <Alert
                color={result.success ? 'green' : 'red'}
                icon={result.success ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              >
                <Text fw={600}>{result.success ? 'Workflow Executed' : 'Workflow Execution Failed'}</Text>
                <Text size="sm">{result.message}</Text>
              </Alert>
            ) : (
              <Alert
                color={result.wouldExecute ? 'green' : 'yellow'}
                icon={result.wouldExecute ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              >
                <Text fw={600}>
                  {result.wouldExecute ? 'Workflow Would Execute' : 'Workflow Would NOT Execute'}
                </Text>
                <Text size="sm">{result.message}</Text>
              </Alert>
            )}

            <Card withBorder shadow="sm">
              <Stack gap="xs">
                <Text fw={600}>Context</Text>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Client
                  </Text>
                  <Text size="sm">{selectedClient?.name || 'Unknown'}</Text>
                </Group>
                {result.executionId && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Execution ID
                    </Text>
                    <Code>{result.executionId}</Code>
                  </Group>
                )}
                {result.status && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Status
                    </Text>
                    <Badge color="blue" variant="light">
                      {result.status}
                    </Badge>
                  </Group>
                )}
              </Stack>
            </Card>

            {/* Condition Results */}
            {!isRunMode && result.executionPlan?.conditionResults && (
              <Card withBorder shadow="sm">
                <Group gap="sm" mb="sm">
                  <IconSettings size={20} color="var(--mantine-color-blue-6)" />
                  <Text fw={600}>Condition Evaluation</Text>
                </Group>
                <Stack gap="xs">
                  <Group>
                    <Badge
                      color={result.executionPlan.conditionResults.matched ? 'green' : 'red'}
                      variant="light"
                    >
                      {result.executionPlan.conditionResults.matched ? 'MET' : 'NOT MET'}
                    </Badge>
                    <Text size="sm">
                      {result.executionPlan.conditionResults.message}
                    </Text>
                  </Group>
                  {result.executionPlan.conditionResults.results && (
                    <Accordion>
                      <Accordion.Item value="details">
                        <Accordion.Control>View Details</Accordion.Control>
                        <Accordion.Panel>
                          <Code block>{JSON.stringify(result.executionPlan.conditionResults.results, null, 2)}</Code>
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  )}
                </Stack>
              </Card>
            )}

            {/* Execution Plan */}
            {!isRunMode && result.executionPlan?.actions && (
              <Card withBorder shadow="sm">
                <Group gap="sm" mb="sm">
                  <IconBolt size={20} color="var(--mantine-color-yellow-6)" />
                  <Text fw={600}>Actions That Would Execute</Text>
                </Group>
                {result.executionPlan.actions.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No actions would execute
                  </Text>
                ) : (
                  <Timeline bulletSize={24}>
                    {result.executionPlan.actions.map((action: any, index: number) => (
                      <Timeline.Item
                        key={index}
                        bullet={<IconBolt size={12} />}
                      >
                        <Paper withBorder p="sm" bg="gray.0">
                          <Stack gap="xs">
                            <Text size="xs" c="dimmed">{`Step ${index + 1}`}</Text>
                            <Group justify="space-between">
                              <Badge color="cyan">{action.actionType || action.type}</Badge>
                              {action.wouldExecute ? (
                                <Badge color="green" variant="light" leftSection={<IconCheck size={10} />}>
                                  Would Execute
                                </Badge>
                              ) : (
                                <Badge color="gray" variant="light" leftSection={<IconX size={10} />}>
                                  Skipped
                                </Badge>
                              )}
                            </Group>
                            <Text size="sm">{action.description}</Text>
                            {action.config && (
                              <Accordion>
                                <Accordion.Item value={`config-${index}`}>
                                  <Accordion.Control>View Configuration</Accordion.Control>
                                  <Accordion.Panel>
                                    <Code block>{JSON.stringify(action.config, null, 2)}</Code>
                                  </Accordion.Panel>
                                </Accordion.Item>
                              </Accordion>
                            )}
                            {!action.wouldExecute && action.reason && (
                              <Text size="xs" c="dimmed">
                                Reason: {action.reason}
                              </Text>
                            )}
                          </Stack>
                        </Paper>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                )}
              </Card>
            )}

            {/* Execution Time */}
            {result.executionTime && (
              <Group>
                <IconClock size={16} color="var(--mantine-color-gray-6)" />
                <Text size="sm" c="dimmed">
                  Test completed in {result.executionTime}ms
                </Text>
              </Group>
            )}

            <Card withBorder shadow="sm">
              <Stack gap="xs">
                <Text fw={600}>Output</Text>
                <JsonInput
                  value={JSON.stringify(result, null, 2)}
                  readOnly
                  formatOnBlur
                  autosize
                  minRows={4}
                />
              </Stack>
            </Card>

            {/* Action Buttons */}
            <Group justify="flex-end">
              {isRunMode && result.executionId && onExecutionCreated && (
                <Button
                  variant="light"
                  onClick={() => onExecutionCreated(result.executionId)}
                >
                  Open Execution Logs
                </Button>
              )}
              <Button variant="light" onClick={resetResult}>
                {isRunMode ? 'Run Again' : 'Test Again'}
              </Button>
              <Button onClick={handleClose}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
