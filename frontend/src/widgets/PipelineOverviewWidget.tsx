import { Paper, Title, Group, Badge, Text } from '@mantine/core';
import { IconTrendingUp } from '@tabler/icons-react';

interface PipelineOverviewWidgetProps {
  clientsByStatus: Record<string, number>;
}

const statusColors: Record<string, string> = {
  LEAD: 'gray',
  PRE_QUALIFIED: 'blue',
  ACTIVE: 'green',
  PROCESSING: 'yellow',
  UNDERWRITING: 'orange',
  CLEAR_TO_CLOSE: 'lime',
  CLOSED: 'green.9',
  DENIED: 'red',
};

export function PipelineOverviewWidget({ clientsByStatus }: PipelineOverviewWidgetProps) {
  return (
    <Paper shadow="sm" p="md" radius="md" withBorder h="100%">
      <Title order={4} mb="md">
        <Group gap="xs">
          <IconTrendingUp size={20} aria-hidden="true" />
          Pipeline Overview
        </Group>
      </Title>
      <Group gap="md" wrap="wrap">
        {Object.entries(clientsByStatus || {}).map(([status, count]) => (
          <Badge
            key={status}
            size="lg"
            color={statusColors[status] || 'gray'}
            variant="light"
            leftSection={count}
          >
            {status.replace(/_/g, ' ')}
          </Badge>
        ))}
        {Object.keys(clientsByStatus || {}).length === 0 && (
          <Text c="dimmed" size="sm">No clients in pipeline yet</Text>
        )}
      </Group>
    </Paper>
  );
}
