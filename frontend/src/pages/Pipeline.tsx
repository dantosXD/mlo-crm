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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUser, IconMail, IconPhone } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';

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

// Pipeline stages in order
const PIPELINE_STAGES = [
  { key: 'LEAD', label: 'Lead', color: 'gray' },
  { key: 'PRE_QUALIFIED', label: 'Pre-Qualified', color: 'blue' },
  { key: 'ACTIVE', label: 'Active', color: 'green' },
  { key: 'PROCESSING', label: 'Processing', color: 'yellow' },
  { key: 'UNDERWRITING', label: 'Underwriting', color: 'orange' },
  { key: 'CLEAR_TO_CLOSE', label: 'Clear to Close', color: 'lime' },
  { key: 'CLOSED', label: 'Closed', color: 'teal' },
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
            <Text size="sm" c="dimmed" ta="center" py="md">
              No clients
            </Text>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, [accessToken]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/clients`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load pipeline data',
        color: 'red',
      });
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

  return (
    <Container size="xl" py="md" style={{ height: '100%' }}>
      <LoadingOverlay visible={loading} />

      <Group justify="space-between" mb="lg">
        <Title order={2}>Pipeline</Title>
        <Text c="dimmed">
          {clients.length} total clients
        </Text>
      </Group>

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
