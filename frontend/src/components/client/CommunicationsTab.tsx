import { Stack, Paper, Group, Text, Title, Button, Badge, Select, ActionIcon } from '@mantine/core';
import { IconSend, IconEye, IconCopy } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../EmptyState';
import { formatRelativeTime } from '../../utils/dateUtils';
import { COMM_TYPE_CONFIG, COMM_STATUS_CONFIG, COMM_STATUS_FILTER_OPTIONS } from '../../utils/constants';

interface CommunicationsTabProps {
  clientId: string;
  communications: any[];
  loadingCommunications: boolean;
  communicationsTypeFilter: string;
  communicationsStatusFilter: string;
  onTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onPreview: (comm: any) => void;
}

export function CommunicationsTab({
  clientId,
  communications,
  loadingCommunications,
  communicationsTypeFilter,
  communicationsStatusFilter,
  onTypeFilterChange,
  onStatusFilterChange,
  onPreview,
}: CommunicationsTabProps) {
  const navigate = useNavigate();

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Communications</Title>
        <Button
          leftSection={<IconSend size={16} aria-hidden="true" />}
          onClick={() => navigate(`/communications/${clientId}/compose`)}
        >
          Compose New
        </Button>
      </Group>

      <Group gap="sm" mb="md">
        <Select
          placeholder="Filter by type"
          value={communicationsTypeFilter}
          onChange={(value) => onTypeFilterChange(value || 'all')}
          data={[
            { value: 'all', label: 'All Types' },
            { value: 'EMAIL', label: 'Email' },
            { value: 'SMS', label: 'SMS' },
            { value: 'LETTER', label: 'Letter' },
          ]}
          style={{ width: 150 }}
          clearable
        />
        <Select
          placeholder="Filter by status"
          value={communicationsStatusFilter}
          onChange={(value) => onStatusFilterChange(value || 'all')}
          data={COMM_STATUS_FILTER_OPTIONS}
          style={{ width: 150 }}
          clearable
        />
      </Group>

      {loadingCommunications ? (
        <Text c="dimmed">Loading communications...</Text>
      ) : communications.length === 0 ? (
        <EmptyState
          iconType="communications"
          title="No communications yet"
          description="Create and send communications to this client."
          ctaLabel="Compose Communication"
          onCtaClick={() => navigate(`/communications/${clientId}/compose`)}
        />
      ) : (
        <Stack gap="md">
          {communications.map((comm) => {
            const typeInfo = COMM_TYPE_CONFIG[comm.type] || { label: comm.type, color: 'gray' };
            const statusInfo = COMM_STATUS_CONFIG[comm.status] || { label: comm.status, color: 'gray' };

            return (
              <Paper key={comm.id} p="md" withBorder>
                <Group justify="space-between" align="flex-start" mb="xs">
                  <Group gap="sm">
                    <Badge color={typeInfo.color}>{typeInfo.label}</Badge>
                    <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
                    {comm.templateName && (
                      <Badge variant="light" color="blue">Template: {comm.templateName}</Badge>
                    )}
                  </Group>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => onPreview(comm)}
                      title="View communication"
                      aria-label="View communication"
                    >
                      <IconEye size={16} aria-hidden="true" />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="green"
                      onClick={() => {
                        navigate(`/communications/${clientId}/compose`, {
                          state: { cloneFrom: comm }
                        });
                      }}
                      title="Clone and reuse"
                      aria-label="Clone and reuse"
                    >
                      <IconCopy size={16} aria-hidden="true" />
                    </ActionIcon>
                  </Group>
                </Group>

                {comm.subject && (
                  <Text fw={500} mb="xs">{comm.subject}</Text>
                )}

                <Text
                  size="sm"
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  mb="sm"
                >
                  {comm.body}
                </Text>

                <Group justify="space-between" mt="sm">
                  <Group gap="xs">
                    {comm.recipient && (
                      <Text size="xs" c="dimmed">
                        To: {comm.recipient}
                      </Text>
                    )}
                  </Group>
                  <Group gap="sm">
                    {comm.scheduledAt && (
                      <Text size="xs" c="blue">
                        Scheduled: {new Date(comm.scheduledAt).toLocaleString()}
                      </Text>
                    )}
                    {comm.followUpDate && (
                      <Text size="xs" c="orange">
                        Follow-up: {new Date(comm.followUpDate).toLocaleDateString()}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      {formatRelativeTime(comm.createdAt)}
                    </Text>
                  </Group>
                </Group>

                {comm.createdBy && (
                  <Text size="xs" c="dimmed" mt="xs">
                    By {comm.createdBy.name || 'Unknown'}
                  </Text>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </>
  );
}
