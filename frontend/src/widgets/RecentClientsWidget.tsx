import { Paper, Title, Group, Card, Text, Badge, Stack } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface RecentClient {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

interface RecentClientsWidgetProps {
  recentClients: RecentClient[];
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

export function RecentClientsWidget({ recentClients }: RecentClientsWidgetProps) {
  const navigate = useNavigate();

  return (
    <Paper shadow="sm" p="md" radius="md" withBorder h="100%">
      <Title order={4} mb="md">
        <Group gap="xs">
          <IconClock size={20} aria-hidden="true" />
          Recent Clients
        </Group>
      </Title>
      {recentClients && recentClients.length > 0 ? (
        <Stack gap="xs">
          {recentClients.map((client) => (
            <Card
              key={client.id}
              p="sm"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/clients/${client.id}`)}
              aria-label={`View details for ${client.name}`}
            >
              <Group justify="space-between">
                <div>
                  <Text fw={500}>{client.name}</Text>
                  <Text size="xs" c="dimmed">
                    Added {new Date(client.createdAt).toLocaleDateString()}
                  </Text>
                </div>
                <Badge color={statusColors[client.status] || 'gray'}>
                  {client.status.replace(/_/g, ' ')}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed" size="sm">No clients yet. Add your first client to get started!</Text>
      )}
    </Paper>
  );
}
