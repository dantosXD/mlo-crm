import { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { IconDashboard, IconSun } from '@tabler/icons-react';
import { useSearchParams, useLocation } from 'react-router-dom';
import Dashboard from './Dashboard';
import Today from './Today';

const validTabs = ['dashboard', 'today'];

export default function DashboardHub() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const pathDefault = location.pathname === '/today' ? 'today' : 'dashboard';
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : pathDefault;
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);

  const handleTabChange = (value: string | null) => {
    setActiveTab(value);
    if (value) {
      setSearchParams({ tab: value }, { replace: true });
    }
  };

  return (
    <Tabs value={activeTab} onChange={handleTabChange}>
      <Container size="xl">
        <Tabs.List mb="md">
          <Tabs.Tab value="dashboard" leftSection={<IconDashboard size={16} />}>
            Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="today" leftSection={<IconSun size={16} />}>
            Today
          </Tabs.Tab>
        </Tabs.List>
      </Container>

      <Tabs.Panel value="dashboard">
        <Dashboard />
      </Tabs.Panel>

      <Tabs.Panel value="today">
        <Today />
      </Tabs.Panel>
    </Tabs>
  );
}
