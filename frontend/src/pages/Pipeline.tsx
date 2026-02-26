import { useEffect, useState } from 'react';
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
  Button,
  Table,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUser, IconMail, IconPhone, IconLayoutKanban, IconTable, IconClock } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';
import { api } from '../utils/api';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { PIPELINE_STAGES } from '../utils/constants';
import type { Client, LoanScenario } from '../types';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
}

// Draggable client card component
function DraggableClientCard({ client, daysInStage, onClick }: { client: Client; daysInStage: number; onClick: () => void }) {
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
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <IconUser size={14} aria-hidden="true" />
              <Text fw={500} size="sm" lineClamp={1}>
                {client.name}
              </Text>
            </Group>
            <Badge
              size="xs"
              variant="light"
              color={daysInStage > 30 ? 'red' : daysInStage > 14 ? 'orange' : 'gray'}
              leftSection={<IconClock size={9} />}
              style={{ flexShrink: 0 }}
            >
              {daysInStage}d
            </Badge>
          </Group>
          <Group gap="xs">
            <IconMail size={12} color="gray" aria-hidden="true" />
            <Text size="xs" c="dimmed" lineClamp={1}>
              {maskEmail(client.email)}
            </Text>
          </Group>
          {client.phone && (
            <Group gap="xs">
              <IconPhone size={12} color="gray" aria-hidden="true" />
              <Text size="xs" c="dimmed">
                {maskPhone(client.phone)}
              </Text>
            </Group>
          )}
        </Stack>
      </Card>
    </div>
  );
}

// Pipeline column component
function getDaysInPipeline(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.ceil(Math.abs(now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

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
    data: {
      type: 'stage',
      status: stage.key,
    },
  });

  return (
    <div
      style={{
        minWidth: 280,
        maxWidth: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Paper
        ref={setNodeRef}
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
                  daysInStage={getDaysInPipeline(client.createdAt)}
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
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => {
    const saved = localStorage.getItem('pipelineViewMode');
    return saved === 'table' ? 'table' : 'kanban';
  });
  const [_activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('pipelineViewMode', viewMode);
  }, [viewMode]);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  const { data: pipelineData, isLoading: loading } = useQuery({
    queryKey: ['pipeline-data'],
    queryFn: async () => {
      const [clientsResponse, scenariosResponse] = await Promise.all([
        api.get('/clients'),
        api.get('/loan-scenarios'),
      ]);
      if (!clientsResponse.ok) throw new Error('Failed to fetch clients');
      const clientsPayload = await clientsResponse.json();
      const clients = (Array.isArray(clientsPayload) ? clientsPayload : clientsPayload.data || []) as Client[];
      const loanScenarios = scenariosResponse.ok ? ((await scenariosResponse.json()) as LoanScenario[]) : [];
      return { clients, loanScenarios };
    },
    enabled: !!accessToken,
  });

  const clients = pipelineData?.clients ?? [];
  const loanScenarios = pipelineData?.loanScenarios ?? [];

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
    const stageFromDropData = over.data.current?.status as string | undefined;

    if (stageFromDropData && PIPELINE_STAGES.some((s) => s.key === stageFromDropData)) {
      if (stageFromDropData !== client.status) {
        await updateClientStatus(clientId, stageFromDropData);
      }
      return;
    }

    // Check if we dropped on a valid stage (column)
    const isValidStage = PIPELINE_STAGES.some(s => s.key === dropTargetId);

    if (!isValidStage) {
      // If we dropped on a card instead, find which column that card is in
      const droppedOnClient = clients.find((c) => c.id === dropTargetId);
      if (droppedOnClient) {
        const newStatus = droppedOnClient.status;
        if (newStatus === client.status) {
          return;
        }

        // Update the client status to match the column we dropped into
        await updateClientStatus(clientId, newStatus);
      }
      return;
    }

    // Check if status actually changed
    if (dropTargetId === client.status) {
      return;
    }

    // Update the client status
    await updateClientStatus(clientId, dropTargetId);
  };

  // Helper function to update client status
  const updateClientStatus = async (clientId: string, newStatus: string) => {
    try {
      const response = await api.put(`/clients/${clientId}`, { status: newStatus });

      if (!response.ok) throw new Error('Failed to update client status');

      // Optimistic update in query cache
      queryClient.setQueryData(['pipeline-data'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          clients: old.clients.map((c: Client) =>
            c.id === clientId ? { ...c, status: newStatus } : c
          ),
        };
      });

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
          <Button.Group aria-label="Pipeline view mode toggle">
            <Button
              variant={viewMode === 'kanban' ? 'filled' : 'light'}
              leftSection={<IconLayoutKanban size={16} aria-hidden="true" />}
              onClick={() => setViewMode('kanban')}
              aria-pressed={viewMode === 'kanban'}
              data-testid="pipeline-view-board-toggle"
            >
              Board
            </Button>
            <Button
              variant={viewMode === 'table' ? 'filled' : 'light'}
              leftSection={<IconTable size={16} aria-hidden="true" />}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              data-testid="pipeline-view-table-toggle"
            >
              Table
            </Button>
          </Button.Group>
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
          <Box style={{ height: 'calc(100vh - 200px)', position: 'relative' }} data-testid="pipeline-view-board">
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
            {/* Right-edge fade to hint at horizontal scrollability */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 48,
                height: '100%',
                background: 'linear-gradient(to right, transparent, rgba(248,249,250,0.85))',
                pointerEvents: 'none',
              }}
            />
          </Box>
        </DndContext>
      ) : (
        <Paper shadow="xs" withBorder data-testid="pipeline-view-table">
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
