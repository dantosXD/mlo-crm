import { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { IconMail, IconTemplate } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { Communications } from './Communications';
import { CommunicationTemplates } from './CommunicationTemplates';

const validTabs = ['messages', 'templates'];

export default function CommunicationsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'messages';
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
          <Tabs.Tab value="messages" leftSection={<IconMail size={16} />}>
            Communications
          </Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<IconTemplate size={16} />}>
            Templates
          </Tabs.Tab>
        </Tabs.List>
      </Container>

      <Tabs.Panel value="messages">
        <Communications />
      </Tabs.Panel>

      <Tabs.Panel value="templates">
        <CommunicationTemplates />
      </Tabs.Panel>
    </Tabs>
  );
}
