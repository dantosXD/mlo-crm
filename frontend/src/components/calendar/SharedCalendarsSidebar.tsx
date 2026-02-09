import React, { useState } from 'react';
import {
  Paper,
  Stack,
  Title,
  Text,
  Checkbox,
  Group,
  Badge,
  ScrollArea,
  Collapse,
  ActionIcon,
  Tooltip,
  Button,
} from '@mantine/core';
import {
  IconUsers,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../utils/api';

interface SharedCalendar {
  id: string;
  ownerId: string;
  sharedWithId: string;
  owner: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  visibilityLevel: string;
  permissionLevel: string;
  canEdit: boolean;
  color: string | null;
  isActive: boolean;
}

interface SharedCalendarsSidebarProps {
  enabledSharedCalendars: Set<string>;
  onToggleCalendar: (shareId: string) => void;
}

export const SharedCalendarsSidebar: React.FC<SharedCalendarsSidebarProps> = ({
  enabledSharedCalendars,
  onToggleCalendar,
}) => {
  const [expanded, setExpanded] = useState(true);

  // Fetch shared calendars
  const { data: sharedCalendars = [], isLoading } = useQuery<SharedCalendar[]>({
    queryKey: ['calendar-shared-with-me'],
    queryFn: async () => {
      const response = await apiRequest('/calendar/shared-with-me');
      if (!response.ok) {
        throw new Error('Failed to fetch shared calendars');
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const getVisibilityLabel = (level: string) => {
    const labels: Record<string, string> = {
      BUSY_ONLY: 'Busy Only',
      LIMITED_DETAILS: 'Limited',
      FULL_DETAILS: 'Full',
    };
    return labels[level] || level;
  };

  const getVisibilityIcon = (level: string) => {
    if (level === 'BUSY_ONLY') {
      return <IconEyeOff size={14} />;
    }
    return <IconEye size={14} />;
  };

  return (
    <Paper p="md" withBorder h="100%">
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconUsers size={18} />
            <Title order={5}>Shared Calendars</Title>
            <Badge size="xs" variant="light">
              {sharedCalendars.length}
            </Badge>
          </Group>

          <ActionIcon
            variant="subtle"
            onClick={() => setExpanded(!expanded)}
            size="sm"
          >
            {expanded ? (
              <IconChevronUp size={16} />
            ) : (
              <IconChevronDown size={16} />
            )}
          </ActionIcon>
        </Group>

        {/* Calendars list */}
        <Collapse in={expanded}>
          {isLoading ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Loading...
            </Text>
          ) : sharedCalendars.length === 0 ? (
            <Stack gap="xs" align="center" py="md">
              <IconUsers size={32} style={{ color: '#868e96' }} />
              <Text size="sm" c="dimmed" ta="center">
                No calendars shared with you
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Ask your team members to share their calendars with you
              </Text>
            </Stack>
          ) : (
            <ScrollArea.Autosize mah={400}>
              <Stack gap="xs">
                {sharedCalendars.map((calendar) => {
                  const isEnabled = enabledSharedCalendars.has(calendar.id);
                  const color = calendar.color || '#228be6';

                  return (
                    <Paper
                      key={calendar.id}
                      p="xs"
                      withBorder
                      style={{
                        borderColor: isEnabled ? color : undefined,
                        backgroundColor: isEnabled ? `${color}10` : undefined,
                      }}
                    >
                      <Group gap="xs" justify="space-between">
                        <Checkbox
                          checked={isEnabled}
                          onChange={() => onToggleCalendar(calendar.id)}
                          label={
                            <Group gap="xs" wrap="nowrap">
                              <Text
                                size="sm"
                                fw={500}
                                style={{
                                  color: isEnabled ? color : undefined,
                                }}
                              >
                                {calendar.owner.name}
                              </Text>

                              <Badge
                                size="xs"
                                variant="light"
                                leftSection={getVisibilityIcon(calendar.visibilityLevel)}
                              >
                                {getVisibilityLabel(calendar.visibilityLevel)}
                              </Badge>

                              {calendar.canEdit && (
                                <Badge size="xs" color="green" variant="light">
                                  Can Edit
                                </Badge>
                              )}
                            </Group>
                          }
                          styles={{
                            label: { display: 'flex', alignItems: 'center' },
                          }}
                        />

                        <Tooltip label="Toggle visibility">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => onToggleCalendar(calendar.id)}
                            color={isEnabled ? 'blue' : 'gray'}
                          >
                            {isEnabled ? (
                              <IconEye size={14} />
                            ) : (
                              <IconEyeOff size={14} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      </Group>

                      <Text size="xs" c="dimmed" mt={4} ml={34}>
                        {calendar.owner.email}
                      </Text>

                      {calendar.color && isEnabled && (
                        <div
                          style={{
                            width: '100%',
                            height: 3,
                            backgroundColor: color,
                            marginTop: 8,
                            borderRadius: 2,
                          }}
                        />
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Collapse>
      </Stack>
    </Paper>
  );
};
