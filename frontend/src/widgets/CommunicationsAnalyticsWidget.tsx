import { useEffect, useState } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  SimpleGrid,
  Badge,
  ThemeIcon,
  Loader,
} from '@mantine/core';
import {
  IconMail,
  IconMessage,
  IconFileText,
  IconSend,
  IconAlertCircle,
} from '@tabler/icons-react';
import { API_URL } from '../utils/apiBase';
import { useAuthStore } from '../stores/authStore';

interface AnalyticsData {
  overview: {
    totalCommunications: number;
    totalAllTime: number;
    sentCommunications: number;
    draftCommunications: number;
    readyCommunications: number;
    failedCommunications: number;
    sendRate: number;
  };
  countsByType: {
    EMAIL: number;
    SMS: number;
    LETTER: number;
  };
  countsByStatus: {
    DRAFT: number;
    READY: number;
    SENT: number;
    FAILED: number;
  };
}

interface CommunicationsAnalyticsWidgetProps {
  days?: number;
}

export function CommunicationsAnalyticsWidget({
  days = 30,
}: CommunicationsAnalyticsWidgetProps) {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/analytics/communications?days=${days}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const analytics = await response.json();
        setData(analytics);
      }
    } catch (error) {
      console.error('Error fetching communications analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper p="md" withBorder>
        <Group justify="center" p="xl">
          <Loader size="sm" />
          <Text size="sm">Loading analytics...</Text>
        </Group>
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper p="md" withBorder>
        <Group justify="center" p="xl">
          <Text size="sm" c="dimmed">
            No analytics data available
          </Text>
        </Group>
      </Paper>
    );
  }

  const { overview, countsByType, countsByStatus } = data;

  return (
    <Stack gap="md">
      {/* Overview Stats */}
      <SimpleGrid cols={2} spacing="sm">
        <Paper p="sm" withBorder style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Group gap="xs">
            <ThemeIcon variant="light" color="white" size="lg">
              <IconMail size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="white" opacity={0.8}>
                Total ({days} days)
              </Text>
              <Text size="xl" fw={700} c="white">
                {overview.totalCommunications}
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper p="sm" withBorder style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
          <Group gap="xs">
            <ThemeIcon variant="light" color="white" size="lg">
              <IconSend size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="white" opacity={0.8}>
                Sent
              </Text>
              <Text size="xl" fw={700} c="white">
                {overview.sentCommunications}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* By Type */}
      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">
          By Type
        </Text>
        <SimpleGrid cols={3} spacing="xs">
          <Paper p="xs" withBorder>
            <Stack gap={4}>
              <Group gap={4}>
                <IconMessage size={16} color="#228be6" />
                <Text size="xs" c="dimmed">
                  Email
                </Text>
              </Group>
              <Text size="lg" fw={600}>
                {countsByType.EMAIL}
              </Text>
            </Stack>
          </Paper>

          <Paper p="xs" withBorder>
            <Stack gap={4}>
              <Group gap={4}>
                <IconMessage size={16} color="#22b8cf" />
                <Text size="xs" c="dimmed">
                  SMS
                </Text>
              </Group>
              <Text size="lg" fw={600}>
                {countsByType.SMS}
              </Text>
            </Stack>
          </Paper>

          <Paper p="xs" withBorder>
            <Stack gap={4}>
              <Group gap={4}>
                <IconFileText size={16} color="#9c36b5" />
                <Text size="xs" c="dimmed">
                  Letter
                </Text>
              </Group>
              <Text size="lg" fw={600}>
                {countsByType.LETTER}
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>

      {/* By Status */}
      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">
          By Status
        </Text>
        <SimpleGrid cols={2} spacing="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge color="blue" size="xs">
                Draft
              </Badge>
              <Text size="sm">
                {countsByStatus.DRAFT}
              </Text>
            </Group>
          </Group>

          <Group justify="space-between">
            <Group gap="xs">
              <Badge color="cyan" size="xs">
                Ready
              </Badge>
              <Text size="sm">
                {countsByStatus.READY}
              </Text>
            </Group>
          </Group>

          <Group justify="space-between">
            <Group gap="xs">
              <Badge color="green" size="xs">
                Sent
              </Badge>
              <Text size="sm">
                {countsByStatus.SENT}
              </Text>
            </Group>
          </Group>

          <Group justify="space-between">
            <Group gap="xs">
              <Badge color="red" size="xs">
                Failed
              </Badge>
              <Text size="sm">
                {countsByStatus.FAILED}
              </Text>
            </Group>
          </Group>
        </SimpleGrid>
      </Stack>

      {/* Send Rate */}
      {overview.totalCommunications > 0 && (
        <Paper p="xs" withBorder style={{ background: '#f8f9fa' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Send Rate
            </Text>
            <Text size="sm" fw={600}>
              {overview.sendRate.toFixed(1)}%
            </Text>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
