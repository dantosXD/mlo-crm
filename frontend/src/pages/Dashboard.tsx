import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Loader,
  Center,
  Button,
  Group,
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import ReactGridLayout from 'react-grid-layout';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../stores/authStore';
import { StatsCardsWidget } from '../widgets/StatsCardsWidget';
import { PipelineOverviewWidget } from '../widgets/PipelineOverviewWidget';
import { PendingTasksWidget } from '../widgets/PendingTasksWidget';
import { RecentClientsWidget } from '../widgets/RecentClientsWidget';
import 'react-grid-layout/css/styles.css';

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

interface UserPreferences {
  dashboardLayout?: Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
  }>;
}

// Default layout configuration
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'stats', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'pipeline', x: 0, y: 2, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'tasks', x: 0, y: 4, w: 2, h: 4, minW: 2, minH: 3 },
    { i: 'recent', x: 2, y: 4, w: 2, h: 4, minW: 2, minH: 3 },
  ],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS.lg);
  const [savingLayout, setSavingLayout] = useState(false);

  // Fetch user preferences on mount
  useEffect(() => {
    fetchUserPreferences();
    fetchDashboardStats();
  }, [accessToken]);

  const fetchUserPreferences = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/users/preferences', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const prefs: UserPreferences = await res.json();
        if (prefs.dashboardLayout && prefs.dashboardLayout.length > 0) {
          setLayouts(prefs.dashboardLayout);
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const saveUserPreferences = async (newLayouts: typeof DEFAULT_LAYOUTS.lg) => {
    try {
      setSavingLayout(true);
      await fetch('http://localhost:3000/api/users/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          preferences: {
            dashboardLayout: newLayouts,
          },
        }),
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      notifications.show({
        title: 'Warning',
        message: 'Failed to save dashboard layout',
        color: 'yellow',
      });
    } finally {
      setSavingLayout(false);
    }
  };

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

  const handleLayoutChange = useCallback((newLayout: any) => {
    setLayouts(newLayout);
    // Debounce save to avoid too many API calls
    const timeoutId = setTimeout(() => {
      saveUserPreferences(newLayout);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [accessToken]);

  const handleResetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS.lg);
    saveUserPreferences(DEFAULT_LAYOUTS.lg);
    notifications.show({
      title: 'Layout reset',
      message: 'Dashboard layout has been reset to default',
      color: 'blue',
    });
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
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed">Your mortgage loan origination command center</Text>
        </div>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={handleResetLayout}
          loading={savingLayout}
        >
          Reset Layout
        </Button>
      </Group>

      <ReactGridLayout
        className="layout"
        layouts={{ lg: layouts }}
        cols={4}
        rowHeight={120}
        onLayoutChange={handleLayoutChange}
        isDraggable={true}
        isResizable={true}
        draggableHandle=".drag-handle"
        useCSSTransforms={true}
      >
        <div key="stats">
          <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
            <Text size="sm" fw={500}>📊 Stats Cards</Text>
          </div>
          <div style={{ padding: '8px' }}>
            <StatsCardsWidget stats={stats || {}} />
          </div>
        </div>

        <div key="pipeline">
          <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
            <Text size="sm" fw={500}>📈 Pipeline Overview</Text>
          </div>
          <div style={{ padding: '8px' }}>
            <PipelineOverviewWidget clientsByStatus={stats?.clientsByStatus || {}} />
          </div>
        </div>

        <div key="tasks">
          <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
            <Text size="sm" fw={500}>✓ Pending Tasks</Text>
          </div>
          <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '480px' }}>
            <PendingTasksWidget
              pendingTasksList={stats?.pendingTasksList || []}
              onTaskComplete={handleTaskComplete}
            />
          </div>
        </div>

        <div key="recent">
          <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
            <Text size="sm" fw={500}>🕐 Recent Clients</Text>
          </div>
          <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '480px' }}>
            <RecentClientsWidget recentClients={stats?.recentClients || []} />
          </div>
        </div>
      </ReactGridLayout>
    </Container>
  );
}
