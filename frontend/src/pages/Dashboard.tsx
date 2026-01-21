import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  SimpleGrid,
  Stack,
  Card,
  ThemeIcon,
  Badge,
  Loader,
  Center,
  Checkbox,
} from '@mantine/core';
import {
  IconUsers,
  IconFileText,
  IconChecklist,
  IconCoin,
  IconTrendingUp,
  IconClock,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../stores/authStore';

interface Task {
  id: string;
  text: string;
  status: string;
  priority: string;
  dueDate: string | null;
  clientId: string | null;
  clientName?: string;
}

interface DashboardStats {
  totalClients: number;
  totalDocuments: number;
  totalTasks: number;
  totalLoanScenarios: number;
  clientsByStatus: Record<string, number>;
  recentClients: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  pendingTasks: number;
  pendingTasksList: Task[];
}

const statusColors: Record<string, string> = {
  LEAD: 'gray',
  PRE_QUALIFIED: 'blue',
  ACTIVE: 'green',
  PROCESSING: 'yellow',
  UNDERWRITING: 'orange',
  CLEAR_TO_CLOSE: 'lime',
  CLOSED: 'green.9',
  DENIED: 'red',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, [accessToken]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch clients count
      const clientsRes = await fetch('http://localhost:3000/api/clients', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!clientsRes.ok) throw new Error('Failed to fetch clients');
      const clients = await clientsRes.json();

      // Calculate clients by status
      const clientsByStatus: Record<string, number> = {};
      clients.forEach((client: { status: string }) => {
        clientsByStatus[client.status] = (clientsByStatus[client.status] || 0) + 1;
      });

      // Get recent clients (last 5)
      const recentClients = clients
        .sort((a: { createdAt: string }, b: { createdAt: string }) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5)
        .map((client: { id: string; name: string; status: string; createdAt: string }) => ({
          id: client.id,
          name: client.name,
          status: client.status,
          createdAt: client.createdAt,
        }));

      // Fetch documents count
      let totalDocuments = 0;
      try {
        const docsRes = await fetch('http://localhost:3000/api/documents', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (docsRes.ok) {
          const docs = await docsRes.json();
          totalDocuments = docs.length;
        }
      } catch {
        // Documents API may not exist yet
      }

      // Fetch tasks count and pending tasks list
      let totalTasks = 0;
      let pendingTasks = 0;
      let pendingTasksList: Task[] = [];
      try {
        const tasksRes = await fetch('http://localhost:3000/api/tasks', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          totalTasks = tasks.length;
          const pending = tasks.filter((t: { status: string }) => t.status !== 'COMPLETE');
          pendingTasks = pending.length;
          // Get up to 5 pending tasks for the widget
          pendingTasksList = pending.slice(0, 5).map((t: Task & { client?: { id: string; name: string } | null }) => ({
            id: t.id,
            text: t.text,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            clientId: t.clientId,
            clientName: t.client?.name || undefined,
          }));
        }
      } catch {
        // Tasks API may not exist yet
      }

      // Fetch loan scenarios count
      let totalLoanScenarios = 0;
      try {
        const scenariosRes = await fetch('http://localhost:3000/api/loan-scenarios', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (scenariosRes.ok) {
          const scenarios = await scenariosRes.json();
          totalLoanScenarios = scenarios.length;
        }
      } catch {
        // Loan scenarios API may not exist yet
      }

      setStats({
        totalClients: clients.length,
        totalDocuments,
        totalTasks,
        totalLoanScenarios,
        clientsByStatus,
        recentClients,
        pendingTasks,
        pendingTasksList,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load dashboard statistics',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: 'COMPLETE' }),
      });

      if (res.ok) {
        // Update local state to remove completed task
        setStats(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            pendingTasks: prev.pendingTasks - 1,
            pendingTasksList: prev.pendingTasksList.filter(t => t.id !== taskId),
          };
        });
        notifications.show({
          title: 'Task completed',
          message: 'Task has been marked as complete',
          color: 'green',
        });
      } else {
        throw new Error('Failed to update task');
      }
    } catch (error) {
      console.error('Error completing task:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to complete task',
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed">Your mortgage loan origination command center</Text>
        </div>

        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Clients
                </Text>
                <Text size="xl" fw={700}>
                  {stats?.totalClients || 0}
                </Text>
              </div>
              <ThemeIcon size={48} radius="md" color="blue" variant="light">
                <IconUsers size={28} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Documents
                </Text>
                <Text size="xl" fw={700}>
                  {stats?.totalDocuments || 0}
                </Text>
              </div>
              <ThemeIcon size={48} radius="md" color="green" variant="light">
                <IconFileText size={28} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Pending Tasks
                </Text>
                <Text size="xl" fw={700}>
                  {stats?.pendingTasks || 0}
                </Text>
              </div>
              <ThemeIcon size={48} radius="md" color="orange" variant="light">
                <IconChecklist size={28} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Loan Scenarios
                </Text>
                <Text size="xl" fw={700}>
                  {stats?.totalLoanScenarios || 0}
                </Text>
              </div>
              <ThemeIcon size={48} radius="md" color="violet" variant="light">
                <IconCoin size={28} />
              </ThemeIcon>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Pipeline Overview */}
        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={4} mb="md">
            <Group gap="xs">
              <IconTrendingUp size={20} />
              Pipeline Overview
            </Group>
          </Title>
          <Group gap="md" wrap="wrap">
            {Object.entries(stats?.clientsByStatus || {}).map(([status, count]) => (
              <Badge
                key={status}
                size="lg"
                color={statusColors[status] || 'gray'}
                variant="light"
                leftSection={count}
              >
                {status.replace(/_/g, ' ')}
              </Badge>
            ))}
            {Object.keys(stats?.clientsByStatus || {}).length === 0 && (
              <Text c="dimmed" size="sm">No clients in pipeline yet</Text>
            )}
          </Group>
        </Paper>

        {/* Pending Tasks */}
        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={4} mb="md">
            <Group gap="xs">
              <IconChecklist size={20} />
              Pending Tasks
            </Group>
          </Title>
          {stats?.pendingTasksList && stats.pendingTasksList.length > 0 ? (
            <Stack gap="xs">
              {stats.pendingTasksList.map((task) => (
                <Card key={task.id} p="sm" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                      <Checkbox
                        aria-label={`Complete task: ${task.text}`}
                        onChange={() => handleTaskComplete(task.id)}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={500} truncate>{task.text}</Text>
                        {task.clientName && (
                          <Text size="xs" c="dimmed" truncate>
                            Client: {task.clientName}
                          </Text>
                        )}
                      </div>
                    </Group>
                    <Badge
                      size="sm"
                      color={
                        task.priority === 'HIGH' ? 'red' :
                        task.priority === 'MEDIUM' ? 'yellow' : 'blue'
                      }
                    >
                      {task.priority}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">No pending tasks. Great job!</Text>
          )}
        </Paper>

        {/* Recent Clients */}
        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={4} mb="md">
            <Group gap="xs">
              <IconClock size={20} />
              Recent Clients
            </Group>
          </Title>
          {stats?.recentClients && stats.recentClients.length > 0 ? (
            <Stack gap="xs">
              {stats.recentClients.map((client) => (
                <Card
                  key={client.id}
                  p="sm"
                  withBorder
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  aria-label={`View details for ${client.name}`}
                >
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>{client.name}</Text>
                      <Text size="xs" c="dimmed">
                        Added {new Date(client.createdAt).toLocaleDateString()}
                      </Text>
                    </div>
                    <Badge color={statusColors[client.status] || 'gray'}>
                      {client.status.replace(/_/g, ' ')}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">No clients yet. Add your first client to get started!</Text>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
