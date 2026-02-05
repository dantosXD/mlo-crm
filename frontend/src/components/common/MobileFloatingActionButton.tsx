import React, { useState } from 'react';
import {
  UnstyledButton,
  Tooltip,
  Menu,
  Box,
  Text,
  Group,
  Stack,
  Transition,
  rem,
  useMantineTheme,
} from '@mantine/core';
import {
  IconPlus,
  IconChecklist,
  IconCalendarEvent,
  IconBell,
  IconX,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface MobileFloatingActionButtonProps {
  onCreateTask?: () => void;
  onCreateEvent?: () => void;
  onCreateReminder?: () => void;
}

export function MobileFloatingActionButton({
  onCreateTask,
  onCreateEvent,
  onCreateReminder,
}: MobileFloatingActionButtonProps) {
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);

  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleAction = (action: () => void) => {
    triggerHapticFeedback();
    setOpened(false);
    action();
  };

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="left"
      withArrow
      offset={20}
      shadow="xl"
      width={200}
    >
      <Menu.Target>
        <UnstyledButton
          style={{
            position: 'fixed',
            bottom: rem(20),
            right: rem(20),
            width: rem(56),
            height: rem(56),
            borderRadius: '50%',
            backgroundColor: '#228be6',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(34, 139, 230, 0.4)',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            zIndex: 1000,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 139, 230, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = opened ? 'rotate(45deg)' : 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 139, 230, 0.4)';
          }}
          onClick={() => {
            triggerHapticFeedback();
            if (opened) {
              setOpened(false);
            }
          }}
        >
          <IconPlus
            size={28}
            style={{
              transition: 'transform 0.3s',
              transform: opened ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
          />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown p={0}>
        <Stack gap={0}>
          <Menu.Item
            leftSection={<IconChecklist size={18} />}
            onClick={() => {
              if (onCreateTask) {
                handleAction(onCreateTask);
              } else {
                handleAction(() => navigate('/tasks?create=true'));
              }
            }}
          >
            <Text size="sm" fw={500}>New Task</Text>
            <Text size="xs" c="dimmed">Create a task</Text>
          </Menu.Item>

          <Menu.Item
            leftSection={<IconCalendarEvent size={18} />}
            onClick={() => {
              if (onCreateEvent) {
                handleAction(onCreateEvent);
              } else {
                handleAction(() => navigate('/calendar?create=true'));
              }
            }}
          >
            <Text size="sm" fw={500}>New Event</Text>
            <Text size="xs" c="dimmed">Schedule event</Text>
          </Menu.Item>

          <Menu.Item
            leftSection={<IconBell size={18} />}
            onClick={() => {
              if (onCreateReminder) {
                handleAction(onCreateReminder);
              } else {
                handleAction(() => navigate('/reminders?create=true'));
              }
            }}
          >
            <Text size="sm" fw={500}>New Reminder</Text>
            <Text size="xs" c="dimmed">Set reminder</Text>
          </Menu.Item>
        </Stack>
      </Menu.Dropdown>
    </Menu>
  );
}

// Simple FAB for single action
interface SimpleFabProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

export function SimpleFab({ icon, label, onClick, color = '#228be6' }: SimpleFabProps) {
  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  return (
    <Tooltip label={label} position="left">
      <UnstyledButton
        style={{
          position: 'fixed',
          bottom: rem(20),
          right: rem(20),
          width: rem(56),
          height: rem(56),
          borderRadius: '50%',
          backgroundColor: color,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px ${color}66`,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          zIndex: 1000,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = `0 6px 16px ${color}88`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = `0 4px 12px ${color}66`;
        }}
        onClick={() => {
          triggerHapticFeedback();
          onClick();
        }}
        aria-label={label}
      >
        {icon}
      </UnstyledButton>
    </Tooltip>
  );
}
