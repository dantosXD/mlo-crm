import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell, Text, Center, Loader } from '@mantine/core';

// Placeholder components - to be implemented
const Dashboard = () => (
  <Center h="100%">
    <Text size="xl">Dashboard - Coming Soon</Text>
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

const Login = () => (
  <Center h="100vh">
    <Text size="xl">Login Page - Coming Soon</Text>
  </Center>
);

const NotFound = () => (
  <Center h="100%">
    <Text size="xl">404 - Page Not Found</Text>
  </Center>
);

function App() {
  // TODO: Implement authentication check
  const isAuthenticated = false;

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Text p="md" fw={700} size="lg">
          MLO Dashboard
        </Text>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text>Navigation - Coming Soon</Text>
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

export default App;
