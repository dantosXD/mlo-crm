import { Stack, Text, Button, ThemeIcon, Box } from '@mantine/core';
import { IconPlus, IconUsers, IconFileText, IconChecklist, IconClipboard, IconFolder, IconNotes, IconAlertCircle, IconRobot } from '@tabler/icons-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  iconType?: 'clients' | 'notes' | 'tasks' | 'documents' | 'scenarios' | 'activity' | 'workflows' | 'general';
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  ctaIcon?: ReactNode;
}

const iconMap = {
  clients: IconUsers,
  notes: IconNotes,
  tasks: IconChecklist,
  documents: IconFolder,
  scenarios: IconFileText,
  activity: IconClipboard,
  workflows: IconRobot,
  general: IconAlertCircle,
};

export function EmptyState({
  icon,
  iconType = 'general',
  title,
  description,
  ctaLabel,
  onCtaClick,
  ctaIcon,
}: EmptyStateProps) {
  const IconComponent = iconMap[iconType];

  return (
    <Box py="xl">
      <Stack align="center" gap="md">
        {/* Illustration/Icon */}
        {icon || (
          <ThemeIcon
            size={80}
            radius="xl"
            variant="light"
            color="blue"
            style={{ opacity: 0.8 }}
          >
            <IconComponent size={40} stroke={1.5} aria-hidden="true" />
          </ThemeIcon>
        )}

        {/* Helpful message */}
        <Stack align="center" gap="xs">
          <Text size="lg" fw={600} c="dimmed">
            {title}
          </Text>
          {description && (
            <Text size="sm" c="dimmed" ta="center" maw={300}>
              {description}
            </Text>
          )}
        </Stack>

        {/* CTA Button */}
        {ctaLabel && onCtaClick && (
          <Button
            leftSection={ctaIcon || <IconPlus size={16} aria-hidden="true" />}
            onClick={onCtaClick}
            variant="filled"
            mt="sm"
          >
            {ctaLabel}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
