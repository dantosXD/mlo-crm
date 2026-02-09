import { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { IconRobot, IconPlayerPlay } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { Workflows } from './Workflows';
import { WorkflowExecutions } from './WorkflowExecutions';

const validTabs = ['workflows', 'executions'];

export default function WorkflowsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'workflows';
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
          <Tabs.Tab value="workflows" leftSection={<IconRobot size={16} />}>
            Workflows
          </Tabs.Tab>
          <Tabs.Tab value="executions" leftSection={<IconPlayerPlay size={16} />}>
            Executions
          </Tabs.Tab>
        </Tabs.List>
      </Container>

      <Tabs.Panel value="workflows">
        <Workflows />
      </Tabs.Panel>

      <Tabs.Panel value="executions">
        <WorkflowExecutions />
      </Tabs.Panel>
    </Tabs>
  );
}
