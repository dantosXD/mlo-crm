import { Paper, Text, Group, ThemeIcon } from '@mantine/core';
import { IconUsers, IconFileText, IconChecklist, IconCoin } from '@tabler/icons-react';

interface StatsCardsWidgetProps {
  stats: {
    totalClients: number;
    totalDocuments: number;
    pendingTasks: number;
    totalLoanScenarios: number;
  };
}

export function StatsCardsWidget({ stats }: StatsCardsWidgetProps) {
  const cards = [
    {
      title: 'Total Clients',
      value: stats.totalClients || 0,
      icon: IconUsers,
      color: 'blue',
    },
    {
      title: 'Total Documents',
      value: stats.totalDocuments || 0,
      icon: IconFileText,
      color: 'green',
    },
    {
      title: 'Pending Tasks',
      value: stats.pendingTasks || 0,
      icon: IconChecklist,
      color: 'orange',
    },
    {
      title: 'Loan Scenarios',
      value: stats.totalLoanScenarios || 0,
      icon: IconCoin,
      color: 'violet',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
      {cards.map((card) => (
        <Paper key={card.title} shadow="sm" p="md" radius="md" withBorder h="100%">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {card.title}
              </Text>
              <Text size="xl" fw={700}>
                {card.value}
              </Text>
            </div>
            <ThemeIcon size={48} radius="md" color={card.color} variant="light">
              <card.icon size={28} aria-hidden="true" />
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </div>
  );
}
