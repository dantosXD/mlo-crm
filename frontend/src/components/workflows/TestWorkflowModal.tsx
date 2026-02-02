import React, { useState } from 'react';
import {
  Modal,
  Stack,
  Title,
  Text,
  Select,
  Button,
  Alert,
  Group,
  Badge,
  Paper,
  Code,
  Timeline,
  Loader,
  Accordion,
  Card,
  Progress,
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
import { API_URL } from '../../utils/apiBase';

interface TestWorkflowModalProps {
  opened: boolean;
  onClose: () => void;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  actions: any[];
}

export default function TestWorkflowModal({
  opened,
  onClose,
  workflowId,
  workflowName,
  triggerType,
  actions,
}: TestWorkflowModalProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch clients for selection
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/clients?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      return data.clients || [];
    },
    enabled: opened,
  });

  // Test the workflow
  const handleTest = async () => {
    if (!selectedClientId) {
      setError('Please select a client to test with');
      return;
    }

    setIsTesting(true);
    setError('');
    setTestResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/workflows/${workflowId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          dryRun: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to test workflow');
      }

      const result = await response.json();
      setTestResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to test workflow');
    } finally {
      setIsTesting(false);
    }
  };

  const resetTest = () => {
    setTestResult(null);
    setError('');
  };

  const handleClose = () => {
    resetTest();
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} size="xl" title={<Title order={3}>Test Workflow</Title>}>
      <Stack gap="md">
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
              <Badge color="blue">{triggerType}</Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Actions: {actions.length}
            </Text>
          </Stack>
        </Paper>

        {/* Client Selection */}
        {!testResult && (
          <Stack gap="sm">
            <Text fw={600}>Select Test Client</Text>
            <Select
              label="Client"
              placeholder="Select a client to test the workflow with"
              data={clients?.map((client: any) => ({
                value: client.id,
                label: `${client.name} (${client.status})`,
              })) || []}
              value={selectedClientId}
              onChange={(value) => setSelectedClientId(value || '')}
              disabled={clientsLoading || isTesting}
              searchable
              required
            />
            <Text size="xs" c="dimmed">
              The workflow will be tested in dry-run mode with this client's data.
              No actual changes will be made.
            </Text>

            {error && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                {error}
              </Alert>
            )}

            <Group justify="flex-end">
              <Button variant="light" onClick={handleClose} disabled={isTesting}>
                Cancel
              </Button>
              <Button
                leftSection={<IconPlayerPlay size={16} />}
                onClick={handleTest}
                loading={isTesting}
                disabled={!selectedClientId}
              >
                Run Test
              </Button>
            </Group>
          </Stack>
        )}

        {/* Test Results */}
        {testResult && (
          <Stack gap="md">
            {/* Overall Result */}
            <Alert
              color={testResult.wouldExecute ? 'green' : 'yellow'}
              icon={testResult.wouldExecute ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
            >
              <Text fw={600}>
                {testResult.wouldExecute ? 'Workflow Would Execute' : 'Workflow Would NOT Execute'}
              </Text>
              <Text size="sm">{testResult.message}</Text>
            </Alert>

            {/* Condition Results */}
            {testResult.executionPlan?.conditionResults && (
              <Card withBorder shadow="sm">
                <Group gap="sm" mb="sm">
                  <IconSettings size={20} color="var(--mantine-color-blue-6)" />
                  <Text fw={600}>Condition Evaluation</Text>
                </Group>
                <Stack gap="xs">
                  <Group>
                    <Badge
                      color={testResult.executionPlan.conditionResults.matched ? 'green' : 'red'}
                      variant="light"
                    >
                      {testResult.executionPlan.conditionResults.matched ? 'MET' : 'NOT MET'}
                    </Badge>
                    <Text size="sm">
                      {testResult.executionPlan.conditionResults.message}
                    </Text>
                  </Group>
                  {testResult.executionPlan.conditionResults.results && (
                    <Accordion>
                      <Accordion.Item value="details">
                        <Accordion.Control>View Details</Accordion.Control>
                        <Accordion.Panel>
                          <Code block>{JSON.stringify(testResult.executionPlan.conditionResults.results, null, 2)}</Code>
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  )}
                </Stack>
              </Card>
            )}

            {/* Execution Plan */}
            {testResult.executionPlan?.actions && (
              <Card withBorder shadow="sm">
                <Group gap="sm" mb="sm">
                  <IconBolt size={20} color="var(--mantine-color-yellow-6)" />
                  <Text fw={600}>Actions That Would Execute</Text>
                </Group>
                {testResult.executionPlan.actions.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No actions would execute
                  </Text>
                ) : (
                  <Timeline bulletSize={24}>
                    {testResult.executionPlan.actions.map((action: any, index: number) => (
                      <Timeline.Item
                        key={index}
                        bullet={<IconBolt size={12} />}
                        label={`Step ${index + 1}`}
                      >
                        <Paper withBorder p="sm" bg="gray.0">
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Badge color="cyan">{action.type}</Badge>
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
                                <Accordion.Item value="config">
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
            {testResult.executionTime && (
              <Group>
                <IconClock size={16} color="var(--mantine-color-gray-6)" />
                <Text size="sm" c="dimmed">
                  Test completed in {testResult.executionTime}ms
                </Text>
              </Group>
            )}

            {/* Action Buttons */}
            <Group justify="flex-end">
              <Button variant="light" onClick={resetTest}>
                Test Again
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
