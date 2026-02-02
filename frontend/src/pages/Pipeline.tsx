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
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

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

// Draggable client card component
function DraggableClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: client.id,
    data: {
      type: 'client',
      client,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'transform 200ms ease',
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners}>
      <Card
        shadow="sm"
        padding="sm"
        radius="md"
        withBorder
        onClick={(e) => {
          // Prevent navigation when dragging
          e.stopPropagation();
          if (!isDragging) {
            onClick();
          }
        }}
        className="pipeline-card"
        {...attributes}
      >
        <Stack gap="xs">
          <Group gap="xs">
            <IconUser size={14} aria-hidden="true" />
            <Text fw={500} size="sm" lineClamp={1}>
              {client.name}
            </Text>
          </Group>
          <Group gap="xs">
            <IconMail size={12} color="gray" aria-hidden="true" />
            <Text size="xs" c="dimmed" lineClamp={1}>
              {client.email}
            </Text>
          </Group>
          {client.phone && (
            <Group gap="xs">
              <IconPhone size={12} color="gray" aria-hidden="true" />
              <Text size="xs" c="dimmed">
                {client.phone}
              </Text>
            </Group>
          )}
        </Stack>
      </Card>
    </div>
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
  const { setNodeRef } = useDroppable({
    id: stage.key,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 280,
        maxWidth: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Paper
        shadow="xs"
        p="md"
        withBorder
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        data-stage={stage.key}
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
                <DraggableClientCard
                  key={client.id}
                  client={client}
                  onClick={() => onClientClick(client)}
                />
              ))
            )}
          </Stack>
        </ScrollArea>
      </Paper>
    </div>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loanScenarios, setLoanScenarios] = useState<LoanScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

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

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const clientId = active.id as string;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    // Get the drop target ID
    const dropTargetId = over.id as string;

    console.log('Drag end:', { clientId, dropTargetId, currentStatus: client.status });

    // Check if we dropped on a valid stage (column)
    const isValidStage = PIPELINE_STAGES.some(s => s.key === dropTargetId);

    if (!isValidStage) {
      // If we dropped on a card instead, find which column that card is in
      const droppedOnClient = clients.find((c) => c.id === dropTargetId);
      if (droppedOnClient) {
        const newStatus = droppedOnClient.status;
        console.log('Dropped on client, using status:', newStatus);
        if (newStatus === client.status) {
          console.log('Status unchanged:', newStatus);
          return;
        }

        // Update the client status to match the column we dropped into
        await updateClientStatus(clientId, newStatus);
      }
      return;
    }

    console.log('Dropped on stage:', dropTargetId);

    // Check if status actually changed
    if (dropTargetId === client.status) {
      console.log('Status unchanged:', dropTargetId);
      return;
    }

    // Update the client status
    await updateClientStatus(clientId, dropTargetId);
  };

  // Helper function to update client status
  const updateClientStatus = async (clientId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update client status');

      // Update local state
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
      );

      notifications.show({
        title: 'Status updated',
        message: `Client moved to ${PIPELINE_STAGES.find(s => s.key === newStatus)?.label}`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating client status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update client status',
        color: 'red',
      });
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
                    <IconLayoutKanban size={16} aria-hidden="true" />
                    <span>Board</span>
                  </Group>
                ),
              },
              {
                value: 'table',
                label: (
                  <Group gap={4}>
                    <IconTable size={16} aria-hidden="true" />
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
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
        </DndContext>
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
