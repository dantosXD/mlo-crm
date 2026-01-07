import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppShell, Text, Center, NavLink, Group, Avatar, Menu, UnstyledButton, Stack, Divider, Badge, Tooltip, ActionIcon } from '@mantine/core';
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
} from '@tabler/icons-react';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Admin from './pages/Admin';
import AccessDenied from './pages/AccessDenied';
import Clients from './pages/Clients';
import ClientDetails from './pages/ClientDetails';
import NotFound from './pages/NotFound';
import Pipeline from './pages/Pipeline';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';

const Calculator = () => (
  <Center h="100%">
    <Text size="xl">Loan Calculator - Coming Soon</Text>
  </Center>
);

const Analytics = () => (
  <Center h="100%">
    <Text size="xl">Analytics - Coming Soon</Text>
  </Center>
);

const ForgotPassword = () => (
  <Center h="100vh">
    <Text size="xl">Forgot Password - Coming Soon</Text>
  </Center>
);

// Role-protected route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

// Navigation items
const navItems = [
  { icon: IconDashboard, label: 'Dashboard', href: '/', adminOnly: false },
  { icon: IconUsers, label: 'Clients', href: '/clients', adminOnly: false },
  { icon: IconLayoutKanban, label: 'Pipeline', href: '/pipeline', adminOnly: false },
  { icon: IconFileText, label: 'Documents', href: '/documents', adminOnly: false },
  { icon: IconCalculator, label: 'Calculator', href: '/calculator', adminOnly: false },
  { icon: IconChartBar, label: 'Analytics', href: '/analytics', adminOnly: false },
  { icon: IconSettings, label: 'Settings', href: '/settings', adminOnly: false },
  { icon: IconShield, label: 'Admin', href: '/admin', adminOnly: true },
];

// Main navigation component
function MainNav({ currentPath, collapsed }: { currentPath: string; collapsed: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Filter out admin-only items for non-admin users
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <Stack gap={4} p="xs">
      {visibleItems.map((item) => (
        collapsed ? (
          <Tooltip key={item.href} label={item.label} position="right" withArrow>
            <ActionIcon
              variant={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href)) ? 'filled' : 'subtle'}
              color={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href)) ? 'blue' : 'gray'}
              size="lg"
              onClick={() => navigate(item.href)}
              style={{ width: '100%' }}
            >
              <item.icon size={20} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <NavLink
            key={item.href}
            label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            active={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
            onClick={() => navigate(item.href)}
            style={{ borderRadius: 8 }}
          />
        )
      ))}
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
            <IconChevronDown size={16} />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Account</Menu.Label>
        <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => navigate('/settings')}>
          Settings
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={handleLogout}>
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// Protected layout component
function ProtectedLayout() {
  const currentPath = window.location.pathname;
  const { user } = useAuthStore();
  const isReadOnly = isReadOnlyRole(user?.role);

  // Sidebar collapsed state with localStorage persistence
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

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: sidebarCollapsed ? 70 : 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="md">
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
          <UserMenu />
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
                {sidebarCollapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetails />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/*" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

// Component to handle redirect with state
function RequireAuth() {
  const location = useLocation();
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<RequireAuth />} />
      </Routes>
    );
  }

  return <ProtectedLayout />;
}

export default App;
