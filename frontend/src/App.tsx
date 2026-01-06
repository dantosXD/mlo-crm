import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppShell, Text, Center, NavLink, Group, Avatar, Menu, UnstyledButton, Stack, Divider, Badge, Tooltip } from '@mantine/core';
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
} from '@tabler/icons-react';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Admin from './pages/Admin';
import AccessDenied from './pages/AccessDenied';
import Clients from './pages/Clients';
import ClientDetails from './pages/ClientDetails';
import NotFound from './pages/NotFound';

// Placeholder components - to be implemented
const Dashboard = () => (
  <Center h="100%">
    <Stack align="center" gap="md">
      <Text size="xl" fw={600}>Welcome to MLO Dashboard</Text>
      <Text c="dimmed">Your mortgage loan origination command center</Text>
    </Stack>
  </Center>
);

const Pipeline = () => (
  <Center h="100%">
    <Text size="xl">Pipeline - Coming Soon</Text>
  </Center>
);

const Documents = () => (
  <Center h="100%">
    <Text size="xl">Documents - Coming Soon</Text>
  </Center>
);

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

const Settings = () => (
  <Center h="100%">
    <Text size="xl">Settings - Coming Soon</Text>
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
function MainNav({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Filter out admin-only items for non-admin users
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <Stack gap={4} p="xs">
      {visibleItems.map((item) => (
        <NavLink
          key={item.href}
          label={item.label}
          leftSection={<item.icon size={20} stroke={1.5} />}
          active={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
          onClick={() => navigate(item.href)}
          style={{ borderRadius: 8 }}
        />
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

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
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
          <MainNav currentPath={currentPath} />
        </AppShell.Section>
        <AppShell.Section>
          <Divider my="sm" />
          <Group p="md" gap="xs">
            <Avatar color="blue" radius="xl" size="sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <div>
              <Text size="sm" fw={500}>{user?.name}</Text>
              <Text size="xs" c="dimmed">{user?.email}</Text>
            </div>
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
