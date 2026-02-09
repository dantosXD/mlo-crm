import { useState, useCallback } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import { StatsCardsWidget } from '../widgets/StatsCardsWidget';
import { PipelineOverviewWidget } from '../widgets/PipelineOverviewWidget';
import { PendingTasksWidget } from '../widgets/PendingTasksWidget';
import { RecentClientsWidget } from '../widgets/RecentClientsWidget';
import { WorkflowStatusWidget } from '../widgets/WorkflowStatusWidget';
import 'react-grid-layout/css/styles.css';
import type { Task, DashboardStats } from '../types';

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

// Fetch all dashboard stats in parallel
async function fetchDashboardData(): Promise<DashboardStats> {
  const [
    clientsResult,
    docsResult,
    tasksResult,
    scenariosResult,
    runningResult,
    completedResult,
    failedResult,
    workflowsResult,
  ] = await Promise.allSettled([
    api.get('/clients'),
    api.get('/documents'),
    api.get('/tasks'),
    api.get('/loan-scenarios'),
    api.get('/workflow-executions?status=RUNNING&limit=5'),
    api.get('/workflow-executions?status=COMPLETED&limit=100'),
    api.get('/workflow-executions?status=FAILED&limit=100'),
    api.get('/workflows'),
  ]);

  // Process clients
  let clients: any[] = [];
  if (clientsResult.status === 'fulfilled' && clientsResult.value.ok) {
    const clientsPayload = await clientsResult.value.json();
    clients = Array.isArray(clientsPayload) ? clientsPayload : clientsPayload.data || [];
  }
  const clientsByStatus: Record<string, number> = {};
  clients.forEach((client: { status: string }) => {
    clientsByStatus[client.status] = (clientsByStatus[client.status] || 0) + 1;
  });
  const recentClients = [...clients]
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

  // Process documents
  let totalDocuments = 0;
  if (docsResult.status === 'fulfilled' && docsResult.value.ok) {
    totalDocuments = (await docsResult.value.json()).length;
  }

  // Process tasks
  let totalTasks = 0;
  let pendingTasks = 0;
  let pendingTasksList: Task[] = [];
  if (tasksResult.status === 'fulfilled' && tasksResult.value.ok) {
    const tasks = await tasksResult.value.json();
    totalTasks = tasks.length;
    const pending = tasks.filter((t: { status: string }) => t.status !== 'COMPLETE');
    pendingTasks = pending.length;
    pendingTasksList = pending.slice(0, 5).map((t: Task & { client?: { id: string; name: string } | null }) => ({
      id: t.id,
      text: t.text,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      clientId: t.clientId,
      clientName: t.client?.name ?? undefined,
    }));
  }

  // Process loan scenarios
  let totalLoanScenarios = 0;
  if (scenariosResult.status === 'fulfilled' && scenariosResult.value.ok) {
    totalLoanScenarios = (await scenariosResult.value.json()).length;
  }

  // Process workflow stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const workflowStats = {
    activeWorkflows: 0,
    completedToday: 0,
    failedToday: 0,
    runningExecutions: [] as any[],
  };
  if (runningResult.status === 'fulfilled' && runningResult.value.ok) {
    workflowStats.runningExecutions = await runningResult.value.json();
  }
  if (completedResult.status === 'fulfilled' && completedResult.value.ok) {
    const completedData = await completedResult.value.json();
    workflowStats.completedToday = completedData.filter((e: { completedAt: string }) =>
      new Date(e.completedAt) >= today
    ).length;
  }
  if (failedResult.status === 'fulfilled' && failedResult.value.ok) {
    const failedData = await failedResult.value.json();
    workflowStats.failedToday = failedData.filter((e: { completedAt: string }) =>
      new Date(e.completedAt) >= today
    ).length;
  }
  if (workflowsResult.status === 'fulfilled' && workflowsResult.value.ok) {
    const activeWorkflows = await workflowsResult.value.json();
    workflowStats.activeWorkflows = activeWorkflows.filter((w: { isActive: boolean }) => w.isActive).length;
  }

  return {
    totalClients: clients.length,
    totalDocuments,
    totalTasks,
    totalLoanScenarios,
    clientsByStatus,
    recentClients,
    pendingTasks,
    pendingTasksList,
    workflowStats,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [layouts, setLayouts] = useState<LayoutItem[]>(DEFAULT_LAYOUTS.lg);
  const [savingLayout, setSavingLayout] = useState(false);

  // Fetch dashboard stats
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardData,
    enabled: !!accessToken,
    staleTime: 30_000, // 30 seconds
  });

  // Fetch user preferences
  useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const res = await api.get('/users/preferences');
      if (res.ok) {
        const prefs: UserPreferences = await res.json();
        if (prefs.dashboardLayout && prefs.dashboardLayout.length > 0) {
          setLayouts(prefs.dashboardLayout);
        }
        return prefs;
      }
      return null;
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  });

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

  const handleTaskComplete = async (taskId: string) => {
    try {
      const res = await api.put(`/tasks/${taskId}`, { status: 'COMPLETE' });

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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
