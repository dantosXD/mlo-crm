import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppShell, Text, Center, NavLink, Group, Avatar, Menu, UnstyledButton, Stack, Divider } from '@mantine/core';
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
} from '@tabler/icons-react';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';

// Placeholder components - to be implemented
const Dashboard = () => (
  <Center h="100%">
    <Stack align="center" gap="md">
      <Text size="xl" fw={600}>Welcome to MLO Dashboard</Text>
      <Text c="dimmed">Your mortgage loan origination command center</Text>
    </Stack>
  </Center>
);

const Clients = () => (
  <Center h="100%">
    <Text size="xl">Clients - Coming Soon</Text>
  </Center>
);

const ClientDetails = () => (
  <Center h="100%">
    <Text size="xl">Client Details - Coming Soon</Text>
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

const NotFound = () => (
  <Center h="100%">
    <Text size="xl">404 - Page Not Found</Text>
  </Center>
);

// Navigation items
const navItems = [
  { icon: IconDashboard, label: 'Dashboard', href: '/' },
  { icon: IconUsers, label: 'Clients', href: '/clients' },
  { icon: IconLayoutKanban, label: 'Pipeline', href: '/pipeline' },
  { icon: IconFileText, label: 'Documents', href: '/documents' },
  { icon: IconCalculator, label: 'Calculator', href: '/calculator' },
  { icon: IconChartBar, label: 'Analytics', href: '/analytics' },
  { icon: IconSettings, label: 'Settings', href: '/settings' },
];

// Main navigation component
function MainNav({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate();

  return (
    <Stack gap={4} p="xs">
      {navItems.map((item) => (
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

// User menu component
function UserMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

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

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700} size="lg" style={{ color: '#228be6' }}>
            MLO Dashboard
          </Text>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <ProtectedLayout />;
}

export default App;
