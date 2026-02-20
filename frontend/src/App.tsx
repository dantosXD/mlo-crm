import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppShell, Text, Center, NavLink, Group, Avatar, Menu, UnstyledButton, Stack, Divider, Badge, Tooltip, ActionIcon, Burger, Notification } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconDashboard,
  IconUsers,
  IconFileText,
  IconCalculator,
  IconChartBar,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconLayoutKanban,
  IconShield,
  IconEye,
  IconChevronLeft,
  IconChevronRight,
  IconNotes,
  IconRobot,
  IconMail,
  IconCheck,
  IconCalendar,
  IconBell,
  IconScale,
  IconTemplate,
} from '@tabler/icons-react';
import { useAuthStore } from './stores/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QuickCapture } from './components/QuickCapture';
import { NotificationCenter } from './components/NotificationCenter';
import { AiChatSidebar } from './components/AiChatSidebar';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';
import AccessDenied from './pages/AccessDenied';
import Clients from './pages/Clients';
import ClientDetails from './pages/ClientDetails';
import NotFound from './pages/NotFound';
import Pipeline from './pages/Pipeline';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import DashboardHub from './pages/DashboardHub';
import Notes from './pages/Notes';
import Calculator from './pages/Calculator';
import Analytics from './pages/Analytics';
import WorkflowBuilder from './pages/WorkflowBuilder';
import WorkflowsHub from './pages/WorkflowsHub';
import { CommunicationTemplateEditor } from './pages/CommunicationTemplateEditor';
import { CommunicationComposer } from './pages/CommunicationComposer';
import CommunicationsHub from './pages/CommunicationsHub';
import TasksDashboard from './pages/TasksDashboard';
import Calendar from './pages/Calendar';
import RemindersDashboard from './pages/RemindersDashboard';
import LoanScenarios from './pages/LoanScenarios';
import LoanProgramSettings from './pages/LoanProgramSettings';
import TemplatesHub from './pages/TemplatesHub';

// Role-protected route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

// Role-protected route wrapper for write actions
function WriteRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const isReadOnly = isReadOnlyRole(user?.role);

  if (isReadOnly) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

export function TabRedirect({ to, tab }: { to: string; tab: string }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (!params.has('tab')) {
    params.set('tab', tab);
  }

  return <Navigate to={`${to}?${params.toString()}`} replace />;
}

// Navigation item type
type NavItem = { icon: any; label: string; href: string; adminOnly: boolean };
type NavGroup = { group: string; items: NavItem[] };

// Navigation items organized by group
const navGroups: NavGroup[] = [
  {
    group: 'Home',
    items: [
      { icon: IconDashboard, label: 'Dashboard', href: '/', adminOnly: false },
      { icon: IconCalendar, label: 'Calendar', href: '/calendar', adminOnly: false },
    ],
  },
  {
    group: 'Client Management',
    items: [
      { icon: IconUsers, label: 'Clients', href: '/clients', adminOnly: false },
      { icon: IconLayoutKanban, label: 'Pipeline', href: '/pipeline', adminOnly: false },
      { icon: IconFileText, label: 'Documents', href: '/documents', adminOnly: false },
      { icon: IconCalculator, label: 'Calculator', href: '/calculator', adminOnly: false },
      { icon: IconScale, label: 'Loan Scenarios', href: '/loan-scenarios', adminOnly: false },
      { icon: IconSettings, label: 'Loan Programs', href: '/loan-programs', adminOnly: false },
    ],
  },
  {
    group: 'Productivity',
    items: [
      { icon: IconCheck, label: 'Tasks', href: '/tasks', adminOnly: false },
      { icon: IconBell, label: 'Reminders', href: '/reminders', adminOnly: false },
      { icon: IconNotes, label: 'Notes', href: '/notes', adminOnly: false },
      { icon: IconTemplate, label: 'Templates', href: '/templates', adminOnly: false },
      { icon: IconMail, label: 'Communications', href: '/communications', adminOnly: false },
    ],
  },
  {
    group: 'Automation & Insights',
    items: [
      { icon: IconRobot, label: 'Workflows', href: '/workflows', adminOnly: false },
      { icon: IconChartBar, label: 'Analytics', href: '/analytics', adminOnly: false },
    ],
  },
  {
    group: 'System',
    items: [
      { icon: IconSettings, label: 'Settings', href: '/settings', adminOnly: false },
      { icon: IconShield, label: 'Admin', href: '/admin', adminOnly: true },
    ],
  },
];

// Main navigation component
function MainNav({ currentPath, collapsed }: { currentPath: string; collapsed: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const isActive = (href: string) =>
    currentPath === href || (href !== '/' && currentPath.startsWith(href));

  return (
    <Stack gap={4} p="xs">
      {navGroups.map((group, groupIdx) => {
        const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.group}>
            {groupIdx > 0 && <Divider my={6} />}
            {!collapsed && (
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" mb={4}>
                {group.group}
              </Text>
            )}
            {visibleItems.map((item) => (
              collapsed ? (
                <Tooltip key={item.href} label={item.label} position="right" withArrow>
                  <ActionIcon
                    variant={isActive(item.href) ? 'filled' : 'subtle'}
                    color={isActive(item.href) ? 'blue' : 'gray'}
                    size="lg"
                    onClick={() => navigate(item.href)}
                    style={{ width: '100%' }}
                    aria-label={item.label}
                  >
                    <item.icon size={20} stroke={1.5} aria-hidden="true" />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <NavLink
                  key={item.href}
                  label={item.label}
                  leftSection={<item.icon size={20} stroke={1.5} aria-hidden="true" />}
                  active={isActive(item.href)}
                  onClick={() => navigate(item.href)}
                  style={{ borderRadius: 8 }}
                />
              )
            ))}
          </div>
        );
      })}
    </Stack>
  );
}

// Helper function to check if user has read-only role
function isReadOnlyRole(role: string | undefined): boolean {
  return role === 'VIEWER' || role === 'PROCESSOR' || role === 'UNDERWRITER';
}

// User menu component
function UserMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isReadOnly = isReadOnlyRole(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <UnstyledButton
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: 8,
          }}
        >
          <Group gap="sm">
            <Avatar color="blue" radius="xl" size="sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={500}>
                {user?.name || 'User'}
              </Text>
              <Text c="dimmed" size="xs">
                {user?.role || 'MLO'}
              </Text>
            </div>
            <IconChevronDown size={16} aria-hidden="true" />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Account</Menu.Label>
        <Menu.Item leftSection={<IconSettings size={14} aria-hidden="true" />} onClick={() => navigate('/settings')}>
          Settings
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconLogout size={14} aria-hidden="true" />} onClick={handleLogout}>
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// Protected layout component
function ProtectedLayout() {
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();
  const { user, logout, updateLastActivity, checkSessionTimeout, sessionExpired, clearSessionExpired } = useAuthStore();
  const isReadOnly = isReadOnlyRole(user?.role);

  // Session timeout configuration
  const SESSION_TIMEOUT_MINUTES = parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES || '15', 10);

  // Track session expiry notification and its cause
  const [showSessionExpiry, setShowSessionExpiry] = useState(false);
  const [sessionExpiryReason, setSessionExpiryReason] = useState<'inactivity' | 'token'>('inactivity');

  // React to token-refresh-failure session expiry (separate from inactivity timeout)
  useEffect(() => {
    if (sessionExpired) {
      clearSessionExpired();
      setSessionExpiryReason('token');
      setShowSessionExpiry(true);
      setTimeout(() => {
        setShowSessionExpiry(false);
        navigate('/login');
      }, 5000);
    }
  }, [sessionExpired, clearSessionExpired, navigate]);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store the latest checkSessionTimeout function in a ref
  const checkSessionTimeoutRef = useRef(checkSessionTimeout);
  const logoutRef = useRef(logout);
  const navigateRef = useRef(navigate);

  // Keep refs updated
  useEffect(() => {
    checkSessionTimeoutRef.current = checkSessionTimeout;
    logoutRef.current = logout;
    navigateRef.current = navigate;
  }, [checkSessionTimeout, logout, navigate]);

  // Update last activity on user interactions
  const handleUserActivity = useCallback(() => {
    updateLastActivity();
  }, [updateLastActivity]);

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [handleUserActivity]);

  // Check for session timeout every 30 seconds
  useEffect(() => {
    checkIntervalRef.current = setInterval(async () => {
      const didExpire = checkSessionTimeoutRef.current(SESSION_TIMEOUT_MINUTES);
      if (didExpire) {
        // Show notification first
        setSessionExpiryReason('inactivity');
        setShowSessionExpiry(true);
        // Logout the user
        await logoutRef.current();
        // Hide notification after 5 seconds and redirect to login
        setTimeout(() => {
          setShowSessionExpiry(false);
          navigateRef.current('/login');
        }, 5000);
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [SESSION_TIMEOUT_MINUTES]); // Only depend on SESSION_TIMEOUT_MINUTES

  // Mobile/tablet detection
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Mobile nav opened state
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();

  // Sidebar collapsed state with localStorage persistence (for desktop only)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  // Close mobile nav when navigating
  useEffect(() => {
    closeMobile();
  }, [currentPath, closeMobile]);

  return (
    <>
      {/* Session expiry notification */}
      {showSessionExpiry && (
        <Notification
          withCloseButton={false}
          color="orange"
          title="Session Expired"
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 9999,
            maxWidth: 400,
          }}
        >
          {sessionExpiryReason === 'token'
            ? 'Your session could not be renewed. Please log in again.'
            : 'Your session has expired due to inactivity. Please log in again.'}
        </Notification>
      )}

      <AppShell
      header={{ height: 60 }}
      navbar={{
        width: sidebarCollapsed ? 70 : 250,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened }
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="md">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Text fw={700} size="lg" style={{ color: '#228be6' }}>
              MLO Dashboard
            </Text>
            {isReadOnly && (
              <Tooltip label="You have read-only access. Some actions may be restricted.">
                <Badge
                  color="gray"
                  variant="light"
                  leftSection={<IconEye size={12} />}
                  style={{ cursor: 'help' }}
                >
                  Read Only
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Group gap="sm">
            <NotificationCenter />
            <UserMenu />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <AppShell.Section grow>
          <MainNav currentPath={currentPath} collapsed={sidebarCollapsed} />
        </AppShell.Section>
        <AppShell.Section>
          <Divider my="sm" />
          {sidebarCollapsed ? (
            <Group justify="center" p="xs">
              <Tooltip label={user?.name} position="right" withArrow>
                <Avatar color="blue" radius="xl" size="sm">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
              </Tooltip>
            </Group>
          ) : (
            <Group p="md" gap="xs">
              <Avatar color="blue" radius="xl" size="sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <div>
                <Text size="sm" fw={500}>{user?.name}</Text>
                <Text size="xs" c="dimmed">{user?.email}</Text>
              </div>
            </Group>
          )}
          <Divider my="sm" />
          <Group justify="center" p="xs">
            <Tooltip label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <IconChevronRight size={18} aria-hidden="true" /> : <IconChevronLeft size={18} aria-hidden="true" />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<DashboardHub />} />
          <Route path="/dashboard" element={<DashboardHub />} />
          <Route path="/today" element={<DashboardHub />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetails />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/reminders" element={<RemindersDashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/tasks" element={<TasksDashboard />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/templates" element={<TemplatesHub />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/communications" element={<CommunicationsHub />} />
          <Route path="/communication-templates" element={<TabRedirect to="/communications" tab="templates" />} />
          <Route path="/communication-templates/new" element={<CommunicationTemplateEditor />} />
          <Route path="/communication-templates/:id/edit" element={<CommunicationTemplateEditor />} />
          <Route path="/communications/compose" element={<WriteRoute><CommunicationComposer /></WriteRoute>} />
          <Route path="/communications/:clientId/compose" element={<WriteRoute><CommunicationComposer /></WriteRoute>} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/loan-scenarios" element={<LoanScenarios />} />
          <Route path="/loan-programs" element={<LoanProgramSettings />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/workflows" element={<WorkflowsHub />} />
          <Route path="/workflows/executions" element={<TabRedirect to="/workflows" tab="executions" />} />
          <Route path="/workflows/builder" element={<WorkflowBuilder />} />
          <Route path="/workflows/:id/edit" element={<WorkflowBuilder />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/*" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
    </>
  );
}

// Component to handle redirect with state
function RequireAuth() {
  const location = useLocation();
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

function App() {
  const { isAuthenticated, hasHydrated, refreshAuth, lastActivity } = useAuthStore();
  const [authInitialized, setAuthInitialized] = useState(false);
  const authInitRef = useRef(false);
  const sessionTimeoutMinutes = parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES || '15', 10);

  useEffect(() => {
    if (!hasHydrated || authInitRef.current) {
      return;
    }

    authInitRef.current = true;
    const hasRecentSessionHint = typeof lastActivity === 'number'
      && Number.isFinite(lastActivity)
      && Date.now() - lastActivity < (sessionTimeoutMinutes * 60 * 1000);

    if (!hasRecentSessionHint) {
      setAuthInitialized(true);
      return;
    }

    void refreshAuth().finally(() => {
      setAuthInitialized(true);
    });
  }, [hasHydrated, lastActivity, refreshAuth, sessionTimeoutMinutes]);

  // Wait for auth store to hydrate from persisted state before making routing decisions
  if (!hasHydrated || !authInitialized) {
    return (
      <Center h="100vh">
        <Text size="lg" c="dimmed">Loading...</Text>
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<RequireAuth />} />
      </Routes>
    );
  }

  return (
    <ErrorBoundary>
      <QuickCapture />
      <ProtectedLayout />
      <AiChatSidebar />
    </ErrorBoundary>
  );
}

export default App;
