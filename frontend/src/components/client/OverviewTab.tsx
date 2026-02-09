import { SimpleGrid, Card, Stack, Paper, Group, Text, Title, Badge, ThemeIcon } from '@mantine/core';
import { IconNotes, IconChecklist } from '@tabler/icons-react';
import type { Client } from '../../types';

interface OverviewTabProps {
  client: Client;
}

export function OverviewTab({ client }: OverviewTabProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <Card withBorder>
        <Title order={4} mb="sm">Recent Notes</Title>
        {(client.notes?.length ?? 0) > 0 ? (
          <Stack gap="xs">
            {client.notes!.map((note: any) => (
              <Paper key={note.id} p="sm" withBorder>
                <Text size="sm" lineClamp={2}>{note.text}</Text>
                <Text size="xs" c="dimmed" mt="xs">
                  {new Date(note.createdAt).toLocaleDateString()}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Stack align="center" gap="xs" py="md">
            <ThemeIcon size={40} radius="xl" variant="light" color="blue" style={{ opacity: 0.6 }}>
              <IconNotes size={20} stroke={1.5} aria-hidden="true" />
            </ThemeIcon>
            <Text c="dimmed" size="sm" ta="center">No notes yet</Text>
            <Text c="dimmed" size="xs" ta="center" maw={200}>
              Add notes to track important information
            </Text>
          </Stack>
        )}
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">Recent Tasks</Title>
        {(client.tasks?.length ?? 0) > 0 ? (
          <Stack gap="xs">
            {client.tasks!.map((task: any) => (
              <Paper key={task.id} p="sm" withBorder>
                <Group justify="space-between">
                  <Text size="sm">{task.text}</Text>
                  <Badge size="sm" color={task.status === 'COMPLETE' ? 'green' : 'blue'}>
                    {task.status}
                  </Badge>
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Stack align="center" gap="xs" py="md">
            <ThemeIcon size={40} radius="xl" variant="light" color="orange" style={{ opacity: 0.6 }}>
              <IconChecklist size={20} stroke={1.5} aria-hidden="true" />
            </ThemeIcon>
            <Text c="dimmed" size="sm" ta="center">No tasks yet</Text>
            <Text c="dimmed" size="xs" ta="center" maw={200}>
              Create tasks to track action items
            </Text>
          </Stack>
        )}
      </Card>
    </SimpleGrid>
  );
}
