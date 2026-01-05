import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Text,
  Paper,
  LoadingOverlay,
  Badge,
  Stack,
  Tabs,
  Card,
  SimpleGrid,
  Center,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconUser,
  IconNotes,
  IconFiles,
  IconChecklist,
  IconCalculator,
  IconTimeline,
  IconAlertCircle,
  IconLock,
} from '@tabler/icons-react';
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
  notes: any[];
  tasks: any[];
  documents: any[];
  loanScenarios: any[];
}

const statusColors: Record<string, string> = {
  LEAD: 'gray',
  PRE_QUALIFIED: 'blue',
  ACTIVE: 'green',
  PROCESSING: 'yellow',
  UNDERWRITING: 'orange',
  CLEAR_TO_CLOSE: 'lime',
  CLOSED: 'teal',
  DENIED: 'red',
  INACTIVE: 'gray',
};

const API_URL = 'http://localhost:3000/api';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (id) {
      fetchClient();
    }
  }, [id]);

  const fetchClient = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (response.status === 404) {
        setError('Client not found');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch client');
      }

      const data = await response.json();
      setClient(data);
    } catch (error) {
      console.error('Error fetching client:', error);
      setError('Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (accessDenied) {
    return (
      <Container size="xl" py="md">
        <Center h={400}>
          <Paper p="xl" withBorder shadow="sm" style={{ textAlign: 'center', maxWidth: 500 }}>
            <IconLock size={64} color="var(--mantine-color-red-6)" style={{ marginBottom: 16 }} />
            <Title order={2} mb="sm">Access Denied</Title>
            <Text c="dimmed" mb="lg">
              You do not have permission to view this client. This client belongs to another user.
            </Text>
            <Button onClick={() => navigate('/clients')}>
              Back to Clients
            </Button>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (error || !client) {
    return (
      <Container size="xl" py="md">
        <Center h={400}>
          <Paper p="xl" withBorder shadow="sm" style={{ textAlign: 'center', maxWidth: 500 }}>
            <IconAlertCircle size={64} color="var(--mantine-color-orange-6)" style={{ marginBottom: 16 }} />
            <Title order={2} mb="sm">Client Not Found</Title>
            <Text c="dimmed" mb="lg">
              {error || 'The requested client could not be found.'}
            </Text>
            <Button onClick={() => navigate('/clients')}>
              Back to Clients
            </Button>
          </Paper>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/clients')}
          >
            Back
          </Button>
          <Title order={2}>{client.name}</Title>
          <Badge color={statusColors[client.status] || 'gray'} size="lg">
            {client.status.replace('_', ' ')}
          </Badge>
        </Group>
      </Group>

      {/* Client Info Card */}
      <Paper shadow="xs" p="md" withBorder mb="lg">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <div>
            <Text size="sm" c="dimmed">Email</Text>
            <Text>{client.email}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Phone</Text>
            <Text>{client.phone || '-'}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Created</Text>
            <Text>{new Date(client.createdAt).toLocaleDateString()}</Text>
          </div>
        </SimpleGrid>
      </Paper>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconUser size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
            Notes ({client.notes?.length || 0})
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFiles size={16} />}>
            Documents ({client.documents?.length || 0})
          </Tabs.Tab>
          <Tabs.Tab value="tasks" leftSection={<IconChecklist size={16} />}>
            Tasks ({client.tasks?.length || 0})
          </Tabs.Tab>
          <Tabs.Tab value="loans" leftSection={<IconCalculator size={16} />}>
            Loan Scenarios ({client.loanScenarios?.length || 0})
          </Tabs.Tab>
          <Tabs.Tab value="activity" leftSection={<IconTimeline size={16} />}>
            Activity
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Card withBorder>
              <Title order={4} mb="sm">Recent Notes</Title>
              {client.notes?.length > 0 ? (
                <Stack gap="xs">
                  {client.notes.map((note: any) => (
                    <Paper key={note.id} p="sm" withBorder>
                      <Text size="sm" lineClamp={2}>{note.text}</Text>
                      <Text size="xs" c="dimmed" mt="xs">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">No notes yet</Text>
              )}
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">Recent Tasks</Title>
              {client.tasks?.length > 0 ? (
                <Stack gap="xs">
                  {client.tasks.map((task: any) => (
                    <Paper key={task.id} p="sm" withBorder>
                      <Group justify="space-between">
                        <Text size="sm">{task.text}</Text>
                        <Badge size="sm" color={task.status === 'COMPLETE' ? 'green' : 'blue'}>
                          {task.status}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">No tasks yet</Text>
              )}
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="notes" pt="md">
          <Text c="dimmed">Notes management coming soon...</Text>
        </Tabs.Panel>

        <Tabs.Panel value="documents" pt="md">
          <Text c="dimmed">Document management coming soon...</Text>
        </Tabs.Panel>

        <Tabs.Panel value="tasks" pt="md">
          <Text c="dimmed">Task management coming soon...</Text>
        </Tabs.Panel>

        <Tabs.Panel value="loans" pt="md">
          <Text c="dimmed">Loan scenario management coming soon...</Text>
        </Tabs.Panel>

        <Tabs.Panel value="activity" pt="md">
          <Text c="dimmed">Activity timeline coming soon...</Text>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
