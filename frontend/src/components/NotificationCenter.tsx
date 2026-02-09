import { useState, useEffect } from 'react';
import {
  Menu,
  UnstyledButton,
  Text,
  Group,
  Avatar,
  Stack,
  Badge,
  ActionIcon,
  Box,
  ScrollArea,
  Divider,
  Loader,
} from '@mantine/core';
import { IconBell, IconBellRinging, IconCheck, IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      const response = await api.get('/notifications?limit=20');

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      if (!accessToken) {
        setUnreadCount(0);
        return;
      }
      const response = await api.get('/notifications/unread-count');

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      if (!accessToken) return;
      const response = await api.patch(`/notifications/${notificationId}/read`);

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      if (!accessToken) return;
      const response = await api.patch('/notifications/read-all');

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      if (!accessToken) return;
      const response = await api.delete(`/notifications/${notificationId}`);

      if (response.ok) {
        setNotifications(prev => {
          const notification = prev.find(n => n.id === notificationId);
          if (notification && !notification.isRead) {
            setUnreadCount(count => Math.max(0, count - 1));
          }
          return prev.filter(n => n.id !== notificationId);
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      setOpened(false);
    }
  };

  // Fetch notifications when menu opens
  useEffect(() => {
    if (opened) {
      fetchNotifications();
    }
  }, [opened, accessToken]);

  // Poll for unread count every 30 seconds
  useEffect(() => {
    if (!accessToken) {
      setUnreadCount(0);
      return undefined;
    }
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [accessToken]);

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={380}
      shadow="md"
      withinPortal
    >
      <Menu.Target>
        <UnstyledButton
          style={{
            padding: '8px',
            borderRadius: 8,
            position: 'relative',
          }}
        >
          <ActionIcon component="span" variant="subtle" color="gray" size="lg" pos="relative">
            {unreadCount > 0 ? (
              <IconBellRinging size={20} stroke={1.5} />
            ) : (
              <IconBell size={20} stroke={1.5} />
            )}
            {unreadCount > 0 && (
              <Badge
                size="xs"
                color="red"
                variant="filled"
                circle
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  transform: 'translate(25%, -25%)',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </ActionIcon>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown p={0}>
        <Box p="md" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text fw={600}>Notifications</Text>
          {unreadCount > 0 && (
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer' }}
              onClick={markAllAsRead}
            >
              Mark all as read
            </Text>
          )}
        </Box>

        <Divider />

        <ScrollArea.Autosize mah={400} type="scroll">
          {loading ? (
            <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
              <Loader size="sm" />
            </Box>
          ) : notifications.length === 0 ? (
            <Box p="xl">
              <Text c="dimmed" size="sm" ta="center">
                No notifications yet
              </Text>
            </Box>
          ) : (
            <Stack gap={0}>
              {notifications.map((notification) => (
                <Box
                  key={notification.id}
                  p="md"
                  style={{
                    backgroundColor: notification.isRead ? 'transparent' : 'rgba(34, 139, 230, 0.05)',
                    cursor: notification.link ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <Group gap="sm" justify="space-between" align="flex-start">
                    <Group gap="sm" style={{ flex: 1 }}>
                      {!notification.isRead && (
                        <Badge size="xs" color="blue" variant="filled" circle>
                          •
                        </Badge>
                      )}
                      <div style={{ flex: 1 }}>
                        <Text size="sm" fw={notification.isRead ? 400 : 600}>
                          {notification.title}
                        </Text>
                        <Text size="xs" c="dimmed" mt={2}>
                          {notification.message}
                        </Text>
                        <Text size="xs" c="dimmed" mt={4}>
                          {new Date(notification.createdAt).toLocaleString()}
                        </Text>
                      </div>
                    </Group>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}
