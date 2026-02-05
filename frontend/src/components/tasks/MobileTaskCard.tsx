import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Text,
  Group,
  Badge,
  Stack,
  ActionIcon,
  Checkbox,
  Menu,
  Swipeable,
  Box,
  TouchRipple,
} from '@mantine/core';
import {
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconBell,
  IconDots,
  IconCalendar,
  IconChevronRight,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface Task {
  id: string;
  text: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  client?: { id: string; name: string } | null;
  reminderEnabled?: boolean;
  reminderTimes?: string[];
  snoozedUntil?: string;
}

interface MobileTaskCardProps {
  task: Task;
  onToggleStatus: () => void;
  onDelete: () => void;
  onSnooze: () => void;
  onComplete: () => void;
}

const priorityColors: Record<string, string> = {
  LOW: 'gray',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

export function MobileTaskCard({
  task,
  onToggleStatus,
  onDelete,
  onSnooze,
  onComplete,
}: MobileTaskCardProps) {
  const navigate = useNavigate();
  const [swipeProgress, setSwipeProgress] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const isOverdue = task.dueDate && task.status !== 'COMPLETE' && new Date(task.dueDate) < new Date();
  const isCompleted = task.status === 'COMPLETE';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleCardClick = () => {
    // Navigate to task details or open edit modal
    navigate(`/tasks?edit=${task.id}`);
  };

  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Short vibration for feedback
    }
  };

  const handleSwipeComplete = async () => {
    triggerHapticFeedback();
    await onComplete();
  };

  return (
    <Box pos="relative">
      {/* Swipe action background */}
      <Box
        pos="absolute"
        inset={0}
        style={{
          backgroundColor: '#40c057',
          transform: `translateX(${Math.max(0, swipeProgress - 50)}px)`,
          opacity: swipeProgress > 50 ? 1 : 0,
          transition: 'opacity 0.2s',
          zIndex: 0,
          borderRadius: '8px',
        }}
      >
        <Group
          justify="flex-end"
          align="center"
          h="100%"
          pr="md"
          c="white"
          style={{ transform: `translateX(${Math.max(0, swipeProgress - 50)}px)` }}
        >
          <IconCheck size={32} />
          <Text fw={700}>Complete</Text>
        </Group>
      </Box>

      {/* Task card */}
      <Card
        ref={cardRef}
        padding="sm"
        radius="md"
        withBorder
        shadow="sm"
        style={{
          position: 'relative',
          zIndex: 1,
          cursor: 'pointer',
          opacity: isCompleted ? 0.6 : 1,
          transform: `translateX(${swipeProgress}px)`,
          transition: swipeProgress === 0 ? 'all 0.3s ease' : 'none',
          borderColor: isOverdue ? '#fa5252' : undefined,
          borderWidth: isOverdue ? '2px' : '1px',
        }}
        onClick={handleCardClick}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          const startX = touch.clientX;
          const handleTouchMove = (moveEvent: TouchEvent) => {
            const currentX = moveEvent.touches[0].clientX;
            const diffX = currentX - startX;
            // Only allow right swipe
            if (diffX > 0) {
              setSwipeProgress(Math.min(diffX, 150));
            }
          };
          const handleTouchEnd = () => {
            if (swipeProgress > 100) {
              handleSwipeComplete();
            }
            setSwipeProgress(0);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
          };
          document.addEventListener('touchmove', handleTouchMove);
          document.addEventListener('touchend', handleTouchEnd);
        }}
      >
        <Group gap="sm" align="flex-start">
          {/* Checkbox */}
          <Checkbox
            checked={isCompleted}
            onChange={(e) => {
              e.stopPropagation();
              triggerHapticFeedback();
              onToggleStatus();
            }}
            size="md"
            style={{ cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}
          />

          {/* Task content */}
          <Stack gap={4} style={{ flex: 1 }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={600} size="md" lineClamp={1} style={{ flex: 1 }}>
                {task.text}
              </Text>
              <Badge size="sm" color={priorityColors[task.priority]}>
                {task.priority}
              </Badge>
              {isOverdue && (
                <Badge size="sm" color="red" variant="filled">
                  Overdue
                </Badge>
              )}
            </Group>

            {task.description && (
              <Text size="sm" c="dimmed" lineClamp={2}>
                {task.description}
              </Text>
            )}

            <Group gap="xs" mt={4}>
              {task.dueDate && (
                <Group gap={4} c="dimmed">
                  <IconCalendar size={14} />
                  <Text size="sm">{formatDate(task.dueDate)}</Text>
                </Group>
              )}

              {task.client && (
                <Text
                  size="sm"
                  c="blue"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/clients/${task.client.id}`);
                  }}
                  style={{ textDecoration: 'underline' }}
                >
                  {task.client.name}
                </Text>
              )}

              {task.reminderEnabled && task.reminderTimes && task.reminderTimes.length > 0 && (
                <Group gap={4} c="blue">
                  <IconBell size={14} />
                  <Text size="sm">{task.reminderTimes.length}</Text>
                </Group>
              )}
            </Group>
          </Stack>

          {/* Action menu */}
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                style={{ minHeight: '44px', minWidth: '44px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconDots size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              {!isCompleted && (
                <>
                  <Menu.Item
                    leftSection={<IconCheck size={16} color="green" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHapticFeedback();
                      onComplete();
                    }}
                  >
                    Complete
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconClock size={16} color="blue" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHapticFeedback();
                      onSnooze();
                    }}
                  >
                    Snooze 1 Day
                  </Menu.Item>
                </>
              )}
              <Menu.Item
                leftSection={<IconAlertCircle size={16} color="red" />}
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback();
                  onDelete();
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <IconChevronRight size={18} color="gray" />
        </Group>
      </Card>
    </Box>
  );
}
