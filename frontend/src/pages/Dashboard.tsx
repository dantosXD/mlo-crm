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
import ReactGridLayout, { WidthProvider } from 'react-grid-layout';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../utils/apiBase';
import { api } from '../utils/api';
import { decryptData } from '../utils/encryption';
import { StatsCardsWidget } from '../widgets/StatsCardsWidget';
import { PipelineOverviewWidget } from '../widgets/PipelineOverviewWidget';
import { PendingTasksWidget } from '../widgets/PendingTasksWidget';
import { RecentClientsWidget } from '../widgets/RecentClientsWidget';
import { WorkflowStatusWidget } from '../widgets/WorkflowStatusWidget';
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
  workflowStats?: {
    activeWorkflows: number;
    completedToday: number;
    failedToday: number;
    runningExecutions: Array<{
      id: string;
      status: string;
      startedAt: string;
      completedAt: string | null;
      workflow: {
        id: string;
        name: string;
      };
      client?: {
        id: string;
        name: string;
      } | null;
    }>;
  };
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

interface UserPreferences {
  dashboardLayout?: LayoutItem[];
}

const ResponsiveGridLayout = WidthProvider(ReactGridLayout);

// Default layout configuration
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'stats', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'pipeline', x: 0, y: 2, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'tasks', x: 0, y: 4, w: 2, h: 4, minW: 2, minH: 3 },
    { i: 'recent', x: 2, y: 4, w: 2, h: 4, minW: 2, minH: 3 },
    { i: 'workflows', x: 0, y: 8, w: 2, h: 3, minW: 2, minH: 2 },
  ],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<LayoutItem[]>(DEFAULT_LAYOUTS.lg);
  const [savingLayout, setSavingLayout] = useState(false);

  // Fetch user preferences on mount
  useEffect(() => {
    if (accessToken) {
      fetchUserPreferences();
      fetchDashboardStats();
    }
  }, [accessToken]);

  const fetchUserPreferences = async () => {
    if (!accessToken) return;
    try {
      const res = await api.get('/users/preferences');

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
    if (!accessToken) return;
    try {
      setSavingLayout(true);
      await api.put('/users/preferences', {
        preferences: {
          dashboardLayout: newLayouts,
        },
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
      const clientsRes = await fetch(`${API_URL}/clients`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!clientsRes.ok) throw new Error('Failed to fetch clients');
      const clientsPayload = await clientsRes.json();
      const clients = Array.isArray(clientsPayload)
        ? clientsPayload
        : clientsPayload.data || [];
      const decryptedClients = clients.map((client: { name: string }) => ({
        ...client,
        name: decryptData(client.name),
      }));

      // Initialize workflow stats with default values
      let workflowStats = {
        activeWorkflows: 0,
        completedToday: 0,
        failedToday: 0,
        runningExecutions: [],
      };

      // Calculate clients by status
      const clientsByStatus: Record<string, number> = {};
      decryptedClients.forEach((client: { status: string }) => {
        clientsByStatus[client.status] = (clientsByStatus[client.status] || 0) + 1;
      });

      // Get recent clients (last 5)
      const recentClients = decryptedClients
        .sort((a: { createdAt: string }, b: { createdAt: string }) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5)
        .map((client: { id: string; name: string; status: string; createdAt: string }) => ({
          id: client.id,
          name: decryptData(client.name),
          status: client.status,
          createdAt: client.createdAt,
        }));

      // Fetch documents count
      let totalDocuments = 0;
      try {
        const docsRes = await fetch(`${API_URL}/documents`, {
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
        const tasksRes = await fetch(`${API_URL}/tasks`, {
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
            clientName: t.client?.name ? decryptData(t.client.name) : undefined,
          }));
        }
      } catch {
        // Tasks API may not exist yet
      }

      // Fetch loan scenarios count
      let totalLoanScenarios = 0;
      try {
        const scenariosRes = await fetch(`${API_URL}/loan-scenarios`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (scenariosRes.ok) {
          const scenarios = await scenariosRes.json();
          totalLoanScenarios = scenarios.length;
        }
      } catch {
        // Loan scenarios API may not exist yet
      }

      // Fetch workflow stats
      try {
        // Get today's start for filtering completed/failed today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch running executions
        const runningRes = await fetch(`${API_URL}/workflow-executions?status=RUNNING&limit=5`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (runningRes.ok) {
          const runningData = await runningRes.json();
          workflowStats.runningExecutions = runningData;
        }

        // Fetch completed executions from today
        const completedRes = await fetch(`${API_URL}/workflow-executions?status=COMPLETED&limit=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (completedRes.ok) {
          const completedData = await runningRes.ok ? await completedRes.json() : [];
          workflowStats.completedToday = completedData.filter((e: { completedAt: string }) =>
            new Date(e.completedAt) >= today
          ).length;
        }

        // Fetch failed executions from today
        const failedRes = await fetch(`${API_URL}/workflow-executions?status=FAILED&limit=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (failedRes.ok) {
          const failedData = await failedRes.json();
          workflowStats.failedToday = failedData.filter((e: { completedAt: string }) =>
            new Date(e.completedAt) >= today
          ).length;
        }

        // Count active workflows (excluding completed/failed)
        const activeRes = await fetch(`${API_URL}/workflows`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (activeRes.ok) {
          const activeWorkflows = await activeRes.json();
          workflowStats.activeWorkflows = activeWorkflows.filter((w: { isActive: boolean }) => w.isActive).length;
        }
      } catch {
        // Workflow APIs may not exist yet
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
        workflowStats,
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
      const res = await api.put(`/tasks/${taskId}`, { status: 'COMPLETE' });

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

      <ResponsiveGridLayout
        className="layout"
        layout={layouts}
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

        <div key="workflows">
          <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
            <Text size="sm" fw={500}>🤖 Workflow Activity</Text>
          </div>
          <div style={{ padding: '8px' }}>
            <WorkflowStatusWidget
              activeWorkflows={stats?.workflowStats?.activeWorkflows || 0}
              completedToday={stats?.workflowStats?.completedToday || 0}
              failedToday={stats?.workflowStats?.failedToday || 0}
              runningExecutions={stats?.workflowStats?.runningExecutions || []}
            />
          </div>
        </div>
      </ResponsiveGridLayout>
    </Container>
  );
}
