import { useState, useMemo, type ReactNode } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  Badge,
  Title,
  Button,
  SegmentedControl,
  ScrollArea,
  Menu,
  ActionIcon,
  ThemeIcon,
  Box,
  Divider,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconDots,
  IconNote,
  IconChecklist,
  IconPhone,
  IconPhoneIncoming,
  IconMailForward,
  IconMailOpened,
  IconUsers,
  IconMessage,
  IconMessageForward,
  IconActivity,
  IconPointFilled,
} from '@tabler/icons-react';
import { EmptyState } from '../EmptyState';
import { formatRelativeTime } from '../../utils/dateUtils';
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
  ACTIVITY_FILTER_GROUPS,
  ACTIVITY_FILTER_TYPE_MAP,
} from '../../utils/constants';
import type { Activity } from '../../types';

interface ActivitySidebarProps {
  activities: Activity[];
  loadingActivities: boolean;
  onLogInteraction: () => void;
  onAddNote: () => void;
  onAddTask: () => void;
}

const ACTIVITY_ICONS: Record<string, ReactNode> = {
  CALL_PLACED: <IconPhone size={14} />,
  CALL_RECEIVED: <IconPhoneIncoming size={14} />,
  EMAIL_SENT: <IconMailForward size={14} />,
  EMAIL_RECEIVED: <IconMailOpened size={14} />,
  MEETING: <IconUsers size={14} />,
  TEXT_SENT: <IconMessageForward size={14} />,
  TEXT_RECEIVED: <IconMessage size={14} />,
  INTERACTION_OTHER: <IconActivity size={14} />,
  NOTE_ADDED: <IconNote size={14} />,
  NOTE_UPDATED: <IconNote size={14} />,
  NOTE_DELETED: <IconNote size={14} />,
  NOTE_ARCHIVED: <IconNote size={14} />,
  TASK_CREATED: <IconChecklist size={14} />,
  TASK_COMPLETED: <IconChecklist size={14} />,
  TASK_DELETED: <IconChecklist size={14} />,
  TASK_ARCHIVED: <IconChecklist size={14} />,
  LOAN_SCENARIO_ARCHIVED: <IconChecklist size={14} />,
};

export function ActivitySidebar({
  activities,
  loadingActivities,
  onLogInteraction,
  onAddNote,
  onAddTask,
}: ActivitySidebarProps) {
  const [filter, setFilter] = useState('all');

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    const allowedTypes = ACTIVITY_FILTER_TYPE_MAP[filter] || [];
    if (allowedTypes.length === 0) return activities;
    return activities.filter((a) => allowedTypes.includes(a.type));
  }, [activities, filter]);

  return (
    <Paper
      shadow="xs"
      withBorder
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
      }}
    >
      {/* Header */}
      <Box p="md" pb="xs">
        <Group justify="space-between" mb="xs">
          <Title order={5}>Activity Timeline</Title>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={onLogInteraction}
          >
            Log Interaction
          </Button>
        </Group>

        {/* Filter chips */}
        <ScrollArea type="never" offsetScrollbars>
          <SegmentedControl
            size="xs"
            value={filter}
            onChange={setFilter}
            data={ACTIVITY_FILTER_GROUPS}
            fullWidth={false}
            style={{ flexWrap: 'nowrap' }}
          />
        </ScrollArea>
      </Box>

      <Divider />

      {/* Timeline */}
      <ScrollArea
        style={{ flex: 1 }}
        p="md"
        pt="sm"
        offsetScrollbars
        type="auto"
      >
        {loadingActivities ? (
          <Text c="dimmed" size="sm" ta="center" py="xl">
            Loading activities...
          </Text>
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            iconType="activity"
            title={filter === 'all' ? 'No activity yet' : 'No matching activity'}
            description={
              filter === 'all'
                ? 'Activity will appear here as you work with this client.'
                : 'Try a different filter or log a new interaction.'
            }
          />
        ) : (
          <Stack gap={0}>
            {filteredActivities.map((activity, index) => (
              <Box key={activity.id} style={{ position: 'relative' }}>
                {/* Vertical timeline line */}
                {index < filteredActivities.length - 1 && (
                  <Box
                    style={{
                      position: 'absolute',
                      left: 13,
                      top: 24,
                      bottom: 0,
                      width: 2,
                      backgroundColor: 'var(--mantine-color-gray-3)',
                    }}
                  />
                )}

                <Group gap="sm" align="flex-start" wrap="nowrap" py={6}>
                  {/* Timeline dot */}
                  <ThemeIcon
                    size={28}
                    radius="xl"
                    color={ACTIVITY_TYPE_COLORS[activity.type] || 'gray'}
                    variant="light"
                    style={{ flexShrink: 0, zIndex: 1 }}
                  >
                    {ACTIVITY_ICONS[activity.type] || <IconPointFilled size={10} />}
                  </ThemeIcon>

                  {/* Content */}
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" gap={4} wrap="nowrap">
                      <Badge
                        size="xs"
                        color={ACTIVITY_TYPE_COLORS[activity.type] || 'gray'}
                        variant="light"
                        style={{ flexShrink: 0 }}
                      >
                        {ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
                      </Badge>
                      <Menu position="bottom-end" withArrow shadow="md">
                        <Menu.Target>
                          <ActionIcon size="xs" variant="subtle" color="gray">
                            <IconDots size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Follow-up Actions</Menu.Label>
                          <Menu.Item
                            leftSection={<IconNote size={14} />}
                            onClick={onAddNote}
                          >
                            Add Note
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconChecklist size={14} />}
                            onClick={onAddTask}
                          >
                            Create Task
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>

                    <Text size="xs" mt={2} style={{ wordBreak: 'break-word' }}>
                      {activity.description}
                    </Text>

                    {/* Metadata badges for interactions */}
                    {activity.metadata && (
                      <Group gap={4} mt={4}>
                        {activity.metadata.duration && (
                          <Badge size="xs" variant="outline" color="gray">
                            {activity.metadata.duration} min
                          </Badge>
                        )}
                        {activity.metadata.outcome && (
                          <Badge size="xs" variant="outline" color="gray">
                            {activity.metadata.outcome.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {activity.metadata.followUpNeeded && (
                          <Badge size="xs" variant="dot" color="orange">
                            Follow-up
                          </Badge>
                        )}
                      </Group>
                    )}

                    <Group gap={4} mt={2}>
                      <Text size="xs" c="dimmed">
                        {activity.user?.name || 'System'}
                      </Text>
                      <Text size="xs" c="dimmed">•</Text>
                      <Tooltip
                        label={activity.createdAt ? new Date(activity.createdAt).toLocaleString() : ''}
                        position="bottom"
                      >
                        <Text size="xs" c="dimmed" style={{ cursor: 'default' }}>
                          {activity.createdAt ? formatRelativeTime(activity.createdAt) : ''}
                        </Text>
                      </Tooltip>
                    </Group>
                  </Box>
                </Group>
              </Box>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Paper>
  );
}
