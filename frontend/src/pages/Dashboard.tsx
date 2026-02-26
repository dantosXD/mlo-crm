import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Container,
  Title,
  Text,
  Loader,
  Center,
  Button,
  Group,
  Tooltip,
  Stack,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconRefresh } from '@tabler/icons-react';
import ReactGridLayout, { WidthProvider } from 'react-grid-layout';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { api, isTransientRequestError } from '../utils/api';
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

function serializeLayout(layout: LayoutItem[]): string {
  return JSON.stringify(
    layout.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      maxW: item.maxW,
      minH: item.minH,
      maxH: item.maxH,
    }))
  );
}

// Fetch all dashboard stats in parallel
async function fetchDashboardData(): Promise<DashboardStats> {
  const [
    clientStatsResult,
    recentClientsResult,
    docsResult,
    tasksResult,
    scenariosResult,
    executionsResult,
    workflowsResult,
  ] = await Promise.allSettled([
    api.get('/clients/statistics'),
    api.get('/clients?page=1&limit=5'),
    api.get('/documents?limit=1'),
    api.get('/tasks/statistics'),
    api.get('/loan-scenarios?limit=1'),
    api.get('/workflow-executions?limit=50'),
    api.get('/workflows?limit=100'),
  ]);

  // Process client statistics and recent clients.
  let totalClients = 0;
  let clientsByStatus: Record<string, number> = {};
  if (clientStatsResult.status === 'fulfilled' && clientStatsResult.value.ok) {
    const clientStatsPayload = await clientStatsResult.value.json();
    totalClients = Number(clientStatsPayload?.totalClients ?? 0);
    clientsByStatus = (
      clientStatsPayload?.byStatus && typeof clientStatsPayload.byStatus === 'object'
        ? clientStatsPayload.byStatus
        : {}
    ) as Record<string, number>;
  }

  let recentClients: Array<{ id: string; name: string; status: string; createdAt: string }> = [];
  if (recentClientsResult.status === 'fulfilled' && recentClientsResult.value.ok) {
    const recentClientsPayload = await recentClientsResult.value.json();
    const clientsData = Array.isArray(recentClientsPayload)
      ? recentClientsPayload
      : recentClientsPayload.data || [];

    if (totalClients === 0 && clientsData.length > 0) {
      totalClients = clientsData.length;
    }

    recentClients = clientsData
      .slice(0, 5)
      .map((client: { id: string; name: string; status: string; createdAt: string }) => ({
        id: client.id,
        name: client.name,
        status: client.status,
        createdAt: client.createdAt,
      }));
  }

  // Process documents — use pagination.total when available
  let totalDocuments = 0;
  if (docsResult.status === 'fulfilled' && docsResult.value.ok) {
    const docsPayload = await docsResult.value.json();
    totalDocuments = docsPayload.pagination?.total ?? (Array.isArray(docsPayload) ? docsPayload.length : (docsPayload.data?.length ?? 0));
  }

  // Process tasks — use /tasks/statistics for accurate counts
  let totalTasks = 0;
  let pendingTasks = 0;
  let pendingTasksList: Task[] = [];
  if (tasksResult.status === 'fulfilled' && tasksResult.value.ok) {
    const statsPayload = await tasksResult.value.json();
    // Statistics endpoint returns { total, completed, pending, overdue, ... }
    totalTasks = (statsPayload.total ?? 0) + (statsPayload.completed ?? 0);
    pendingTasks = statsPayload.total ?? 0; // total = non-COMPLETE tasks
    // Fetch a small sample for the widget list (overdue + upcoming, non-complete)
    try {
      const sampleRes = await api.get('/tasks?limit=5&sort_by=dueDate&sort_order=asc');
      if (sampleRes.ok) {
        const samplePayload = await sampleRes.json();
        const sampleTasks = Array.isArray(samplePayload) ? samplePayload : samplePayload.tasks || [];
        pendingTasksList = sampleTasks
          .filter((t: { status: string }) => t.status !== 'COMPLETE')
          .slice(0, 5)
          .map((t: Task & { client?: { id: string; name: string } | null }) => ({
            id: t.id,
            text: t.text,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            clientId: t.clientId,
            clientName: t.client?.name ?? undefined,
          }));
      }
    } catch {
      // widget list is best-effort
    }
  }

  // Process loan scenarios — use pagination.total when available
  let totalLoanScenarios = 0;
  if (scenariosResult.status === 'fulfilled' && scenariosResult.value.ok) {
    const scenariosPayload = await scenariosResult.value.json();
    totalLoanScenarios = scenariosPayload.pagination?.total ?? (Array.isArray(scenariosPayload) ? scenariosPayload.length : (scenariosPayload.data?.length ?? 0));
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
  // Workflow execution endpoint returns { executions: [...], pagination: {...} }
  if (executionsResult.status === 'fulfilled' && executionsResult.value.ok) {
    const executionsPayload = await executionsResult.value.json();
    const executionData: any[] = Array.isArray(executionsPayload)
      ? executionsPayload
      : executionsPayload.executions || [];

    const normalized = executionData.map((e: any) => ({
      ...e,
      workflow: e.workflow ?? { id: e.workflowId, name: e.workflowName ?? 'Unknown Workflow' },
      client: e.client ?? (e.clientId ? { id: e.clientId, name: e.clientName ?? 'Unknown Client' } : null),
    }));

    workflowStats.runningExecutions = normalized
      .filter((e: any) => e.status === 'RUNNING')
      .slice(0, 5);
    workflowStats.completedToday = normalized.filter((e: any) => (
      e.status === 'COMPLETED' &&
      e.completedAt &&
      new Date(e.completedAt) >= today
    )).length;
    workflowStats.failedToday = normalized.filter((e: any) => (
      e.status === 'FAILED' &&
      e.completedAt &&
      new Date(e.completedAt) >= today
    )).length;
  }
  if (workflowsResult.status === 'fulfilled' && workflowsResult.value.ok) {
    const workflowsPayload = await workflowsResult.value.json();
    const activeWorkflows = Array.isArray(workflowsPayload) ? workflowsPayload : workflowsPayload.workflows || [];
    workflowStats.activeWorkflows = activeWorkflows.filter((w: { isActive: boolean }) => w.isActive).length;
  }

  return {
    totalClients,
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
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [layouts, setLayouts] = useState<LayoutItem[]>(DEFAULT_LAYOUTS.lg);
  const [savingLayout, setSavingLayout] = useState(false);
  const layoutSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedPreferencesRef = useRef(false);
  const isUserLayoutInteractionRef = useRef(false);
  const lastPersistedLayoutRef = useRef<string>(serializeLayout(DEFAULT_LAYOUTS.lg));

  // Invalidate dashboard data whenever the access token changes (login / refresh)
  const prevTokenRef = useRef(accessToken);
  useEffect(() => {
    if (prevTokenRef.current !== accessToken && accessToken) {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
    prevTokenRef.current = accessToken;
  }, [accessToken, queryClient]);

  // Fetch dashboard stats
  // Include a token fingerprint in the key so a new login/refresh busts the cache
  const tokenKey = accessToken ? accessToken.slice(-8) : '';
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats', tokenKey],
    queryFn: fetchDashboardData,
    enabled: !!accessToken,
    staleTime: 30_000, // 30 seconds
  });

  // Fetch user preferences
  useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      try {
        const res = await api.get('/users/preferences');
        if (res.ok) {
          const prefs: UserPreferences = await res.json();
          if (prefs.dashboardLayout && prefs.dashboardLayout.length > 0) {
            setLayouts(prefs.dashboardLayout);
            lastPersistedLayoutRef.current = serializeLayout(prefs.dashboardLayout);
          }
          return prefs;
        }
      } catch (error) {
        if (!isTransientRequestError(error)) {
          notifications.show({
            title: 'Warning',
            message: 'Failed to load dashboard preferences',
            color: 'yellow',
          });
        }
      } finally {
        hasLoadedPreferencesRef.current = true;
      }
      return null;
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const saveUserPreferences = async (newLayouts: LayoutItem[]) => {
    if (!accessToken) return;

    const serializedLayout = serializeLayout(newLayouts);
    if (serializedLayout === lastPersistedLayoutRef.current) {
      return;
    }

    try {
      setSavingLayout(true);
      const response = await api.put('/users/preferences', {
        preferences: {
          dashboardLayout: newLayouts,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to save dashboard layout (${response.status})`);
      }

      lastPersistedLayoutRef.current = serializedLayout;
    } catch (error) {
      if (isTransientRequestError(error)) {
        return;
      }
      notifications.show({
        title: 'Warning',
        message: 'Failed to save dashboard layout',
        color: 'yellow',
      });
    } finally {
      setSavingLayout(false);
    }
  };

  const scheduleLayoutSave = useCallback((newLayout: LayoutItem[]) => {
    if (!hasLoadedPreferencesRef.current) {
      return;
    }

    if (layoutSaveTimeoutRef.current) {
      clearTimeout(layoutSaveTimeoutRef.current);
    }

    layoutSaveTimeoutRef.current = setTimeout(() => {
      void saveUserPreferences(newLayout);
      layoutSaveTimeoutRef.current = null;
    }, 750);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTaskComplete = async (taskId: string) => {
    try {
      const res = await api.patch(`/tasks/${taskId}/status`, { status: 'COMPLETE' });

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        notifications.show({
          title: 'Task completed',
          message: 'Task has been marked as complete',
          color: 'green',
        });
      } else {
        const body = await res.text().catch(() => '');
        throw new Error(`Failed to update task: ${res.status} ${body}`);
      }
    } catch (error) {
      console.error('Error completing task:', error instanceof Error ? error.message : error);
      notifications.show({
        title: 'Error',
        message: 'Failed to complete task',
        color: 'red',
      });
    }
  };

  const handleLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayouts(newLayout);
    if (isUserLayoutInteractionRef.current) {
      scheduleLayoutSave(newLayout);
    }
  }, [scheduleLayoutSave]);

  const handleLayoutInteractionStart = useCallback(() => {
    isUserLayoutInteractionRef.current = true;
  }, []);

  const handleLayoutInteractionStop = useCallback((newLayout: LayoutItem[]) => {
    isUserLayoutInteractionRef.current = false;
    scheduleLayoutSave(newLayout);
  }, [scheduleLayoutSave]);

  const handleResetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS.lg);
    void saveUserPreferences(DEFAULT_LAYOUTS.lg);
    notifications.show({
      title: 'Layout reset',
      message: 'Dashboard layout has been reset to default',
      color: 'blue',
    });
  };

  useEffect(() => {
    return () => {
      if (layoutSaveTimeoutRef.current) {
        clearTimeout(layoutSaveTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="lg" />
      </Center>
    );
  }

  const widgetContent = {
    stats: <StatsCardsWidget stats={stats || {}} />,
    pipeline: <PipelineOverviewWidget clientsByStatus={stats?.clientsByStatus || {}} />,
    tasks: (
      <PendingTasksWidget
        pendingTasksList={stats?.pendingTasksList || []}
        onTaskComplete={handleTaskComplete}
      />
    ),
    recent: <RecentClientsWidget recentClients={stats?.recentClients || []} />,
    workflows: (
      <WorkflowStatusWidget
        activeWorkflows={stats?.workflowStats?.activeWorkflows || 0}
        completedToday={stats?.workflowStats?.completedToday || 0}
        failedToday={stats?.workflowStats?.failedToday || 0}
        runningExecutions={stats?.workflowStats?.runningExecutions || []}
      />
    ),
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed">Your mortgage loan origination command center</Text>
        </div>
        {!isMobile && (
          <Tooltip label="Reset dashboard widgets to default layout" withArrow position="left">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={handleResetLayout}
              loading={savingLayout}
            >
              Reset Layout
            </Button>
          </Tooltip>
        )}
      </Group>

      {isMobile ? (
        /* Mobile: simple stacked layout — no drag/resize */
        <Stack gap="md">
          {(['stats', 'pipeline', 'tasks', 'recent', 'workflows'] as const).map((key) => (
            <div key={key}>{widgetContent[key]}</div>
          ))}
        </Stack>
      ) : (
        /* Desktop: full draggable/resizable grid */
        <ResponsiveGridLayout
          className="layout"
          layout={layouts}
          cols={4}
          rowHeight={120}
          onLayoutChange={handleLayoutChange}
          onDragStart={handleLayoutInteractionStart}
          onResizeStart={handleLayoutInteractionStart}
          onDragStop={handleLayoutInteractionStop}
          onResizeStop={handleLayoutInteractionStop}
          isDraggable={true}
          isResizable={true}
          draggableHandle=".drag-handle"
          useCSSTransforms={true}
        >
          <div key="stats">
            <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
              <Text size="sm" fw={500}>📊 Stats Cards</Text>
            </div>
            <div style={{ padding: '8px' }}>{widgetContent.stats}</div>
          </div>

          <div key="pipeline">
            <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
              <Text size="sm" fw={500}>📈 Pipeline Overview</Text>
            </div>
            <div style={{ padding: '8px' }}>{widgetContent.pipeline}</div>
          </div>

          <div key="tasks">
            <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
              <Text size="sm" fw={500}>✓ Pending Tasks</Text>
            </div>
            <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '480px' }}>{widgetContent.tasks}</div>
          </div>

          <div key="recent">
            <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
              <Text size="sm" fw={500}>🕐 Recent Clients</Text>
            </div>
            <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '480px' }}>{widgetContent.recent}</div>
          </div>

          <div key="workflows">
            <div className="drag-handle" style={{ cursor: 'move', padding: '8px', borderBottom: '1px solid #e9ecef' }}>
              <Text size="sm" fw={500}>🤖 Workflow Activity</Text>
            </div>
            <div style={{ padding: '8px' }}>{widgetContent.workflows}</div>
          </div>
        </ResponsiveGridLayout>
      )}
    </Container>
  );
}
