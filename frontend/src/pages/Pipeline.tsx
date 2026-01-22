import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Group,
  Paper,
  Text,
  Badge,
  Card,
  Stack,
  LoadingOverlay,
  ScrollArea,
  Box,
  SegmentedControl,
  Table,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUser, IconMail, IconPhone, IconLayoutKanban, IconTable } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface LoanScenario {
  id: string;
  clientId: string;
  name: string;
  amount: number;
  isPreferred: boolean;
}

// Pipeline stages in order
const PIPELINE_STAGES = [
  { key: 'LEAD', label: 'Lead', color: 'gray' },
  { key: 'PRE_QUALIFIED', label: 'Pre-Qualified', color: 'blue' },
  { key: 'ACTIVE', label: 'Active', color: 'green' },
  { key: 'PROCESSING', label: 'Processing', color: 'yellow' },
  { key: 'UNDERWRITING', label: 'Underwriting', color: 'orange' },
  { key: 'CLEAR_TO_CLOSE', label: 'Clear to Close', color: 'lime' },
  { key: 'CLOSED', label: 'Closed', color: 'green.9' },
];

const API_URL = 'http://localhost:3000/api';

// Client card component
function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  return (
    <Card
      shadow="sm"
      padding="sm"
      radius="md"
      withBorder
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      className="pipeline-card"
    >
      <Stack gap="xs">
        <Group gap="xs">
          <IconUser size={14} />
          <Text fw={500} size="sm" lineClamp={1}>
            {client.name}
          </Text>
        </Group>
        <Group gap="xs">
          <IconMail size={12} color="gray" />
          <Text size="xs" c="dimmed" lineClamp={1}>
            {client.email}
          </Text>
        </Group>
        {client.phone && (
          <Group gap="xs">
            <IconPhone size={12} color="gray" />
            <Text size="xs" c="dimmed">
              {client.phone}
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

// Pipeline column component
function PipelineColumn({
  stage,
  clients,
  onClientClick,
}: {
  stage: typeof PIPELINE_STAGES[0];
  clients: Client[];
  onClientClick: (client: Client) => void;
}) {
  return (
    <Paper
      shadow="xs"
      p="md"
      withBorder
      style={{
        minWidth: 280,
        maxWidth: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Group justify="space-between" mb="md">
        <Badge color={stage.color} size="lg" variant="light">
          {stage.label}
        </Badge>
        <Text size="sm" c="dimmed">
          {clients.length}
        </Text>
      </Group>
      <ScrollArea style={{ flex: 1 }}>
        <Stack gap="sm">
          {clients.length === 0 ? (
            <EmptyState
              iconType="clients"
              title={`No ${stage.label.toLowerCase()} clients`}
              description="Clients will appear here as they progress through the pipeline"
            />
          ) : (
            clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onClick={() => onClientClick(client)}
              />
            ))
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loanScenarios, setLoanScenarios] = useState<LoanScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  useEffect(() => {
    fetchData();
  }, [accessToken]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientsResponse, scenariosResponse] = await Promise.all([
        fetch(`${API_URL}/clients`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${API_URL}/loan-scenarios`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (!clientsResponse.ok) throw new Error('Failed to fetch clients');
      setClients(await clientsResponse.json());

      if (scenariosResponse.ok) {
        setLoanScenarios(await scenariosResponse.json());
      }
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      notifications.show({ title: 'Error', message: 'Failed to load pipeline data', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleClientClick = (client: Client) => {
    navigate(`/clients/${client.id}`);
  };

  // Group clients by status
  const clientsByStatus = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = clients.filter((c) => c.status === stage.key);
    return acc;
  }, {} as Record<string, Client[]>);

  // Calculate days in pipeline
  const getDaysInPipeline = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const stage = PIPELINE_STAGES.find(s => s.key === status);
    return stage?.color || 'gray';
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    const stage = PIPELINE_STAGES.find(s => s.key === status);
    return stage?.label || status.replace(/_/g, ' ');
  };

  const getClientLoanAmount = (clientId: string): number | null => {
    const clientScenarios = loanScenarios.filter(s => s.clientId === clientId);
    if (clientScenarios.length === 0) return null;
    const preferred = clientScenarios.find(s => s.isPreferred);
    return preferred ? preferred.amount : clientScenarios[0].amount;
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Container size="xl" py="md" style={{ height: '100%' }}>
      <LoadingOverlay visible={loading} />

      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>Pipeline</Title>
          <SegmentedControl
            value={viewMode}
            onChange={(value) => setViewMode(value as 'kanban' | 'table')}
            data={[
              {
                value: 'kanban',
                label: (
                  <Group gap={4}>
                    <IconLayoutKanban size={16} />
                    <span>Board</span>
                  </Group>
                ),
              },
              {
                value: 'table',
                label: (
                  <Group gap={4}>
                    <IconTable size={16} />
                    <span>Table</span>
                  </Group>
                ),
              },
            ]}
          />
        </Group>
        <Text c="dimmed">
          {clients.length} total clients
        </Text>
      </Group>

      {viewMode === 'kanban' ? (
        <Box style={{ height: 'calc(100vh - 200px)' }}>
          <ScrollArea type="auto" style={{ width: '100%', height: '100%' }}>
            <Group gap="md" align="stretch" wrap="nowrap" style={{ minHeight: '100%' }}>
              {PIPELINE_STAGES.map((stage) => (
                <PipelineColumn
                  key={stage.key}
                  stage={stage}
                  clients={clientsByStatus[stage.key] || []}
                  onClientClick={handleClientClick}
                />
              ))}
            </Group>
          </ScrollArea>
        </Box>
      ) : (
        <Paper shadow="xs" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Days in Pipeline</Table.Th>
                <Table.Th>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clients.map((client) => (
                <Table.Tr
                  key={client.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleClientClick(client)}
                  aria-label={`View details for ${client.name}`}
                >
                  <Table.Td>
                    <Text fw={500}>{client.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(client.status)} variant="light">
                      {getStatusLabel(client.status)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{getDaysInPipeline(client.createdAt)} days</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={getClientLoanAmount(client.id) ? 500 : undefined} c={getClientLoanAmount(client.id) ? undefined : 'dimmed'}>
                      {formatCurrency(getClientLoanAmount(client.id))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <style>{`
        .pipeline-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
        }
      `}</style>
    </Container>
  );
}
