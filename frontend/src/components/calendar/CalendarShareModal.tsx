import React, { useState } from 'react';
import {
  Modal,
  Stack,
  Title,
  Text,
  TextInput,
  Select,
  Button,
  Group,
  Paper,
  Badge,
  ActionIcon,
  Tooltip,
  Alert,
  Switch,
  ColorInput,
  ScrollArea,
  Loader,
  Flex,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconShare,
  IconTrash,
  IconCopy,
  IconCheck,
  IconUserPlus,
  IconLink,
  IconLock,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { apiRequest } from '../../utils/api';

interface CalendarShare {
  id: string;
  ownerId: string;
  sharedWithId: string;
  sharedWith: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  visibilityLevel: string;
  permissionLevel: string;
  canEdit: boolean;
  color: string | null;
  expiresAt: string | null;
  isPublicLink: boolean;
  shareToken: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CalendarShareModalProps {
  opened: boolean;
  onClose: () => void;
}

export const CalendarShareModal: React.FC<CalendarShareModalProps> = ({ opened, onClose }) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [visibilityLevel, setVisibilityLevel] = useState('FULL_DETAILS');
  const [permissionLevel, setPermissionLevel] = useState('VIEW_ONLY');
  const [canEdit, setCanEdit] = useState(false);
  const [color, setColor] = useState('#228be6');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isPublicLink, setIsPublicLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Fetch existing shares
  const { data: shares = [], isLoading } = useQuery<CalendarShare[]>({
    queryKey: ['calendar-shares'],
    queryFn: async () => {
      const response = await apiRequest('/calendar/shares');
      if (!response.ok) {
        throw new Error('Failed to fetch calendar shares');
      }
      return response.json();
    },
    enabled: opened,
  });

  // Create share mutation
  const createShareMutation = useMutation({
    mutationFn: async (shareData: any) => {
      const response = await apiRequest('/calendar/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shareData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to share calendar');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-shares'] });
      notifications.show({
        title: 'Calendar shared',
        message: 'Calendar has been shared successfully',
        color: 'green',
      });
      // Reset form
      setEmail('');
      setVisibilityLevel('FULL_DETAILS');
      setPermissionLevel('VIEW_ONLY');
      setCanEdit(false);
      setColor('#228be6');
      setExpiresAt(null);
      setIsPublicLink(false);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error sharing calendar',
        message: error.message || 'Failed to share calendar',
        color: 'red',
      });
    },
  });

  // Delete share mutation
  const deleteShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const response = await apiRequest(`/calendar/shares/${shareId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to revoke share');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-shares'] });
      notifications.show({
        title: 'Share revoked',
        message: 'Calendar share has been revoked',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to revoke share',
        color: 'red',
      });
    },
  });

  const handleShare = () => {
    if (!email) {
      notifications.show({
        title: 'Email required',
        message: 'Please enter an email address',
        color: 'red',
      });
      return;
    }

    createShareMutation.mutate({
      sharedWithEmail: email,
      visibilityLevel,
      permissionLevel,
      canEdit,
      color,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isPublicLink,
    });
  };

  const handleRevoke = (shareId: string) => {
    if (window.confirm('Are you sure you want to revoke this calendar share?')) {
      deleteShareMutation.mutate(shareId);
    }
  };

  const copyShareLink = (token: string) => {
    const link = `${window.location.origin}/calendar/shared/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    notifications.show({
      title: 'Link copied',
      message: 'Shareable link has been copied to clipboard',
      color: 'green',
    });
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const getVisibilityLabel = (level: string) => {
    const labels: Record<string, string> = {
      BUSY_ONLY: 'Busy Only',
      LIMITED_DETAILS: 'Limited Details',
      FULL_DETAILS: 'Full Details',
    };
    return labels[level] || level;
  };

  const getVisibilityColor = (level: string) => {
    const colors: Record<string, string> = {
      BUSY_ONLY: 'red',
      LIMITED_DETAILS: 'yellow',
      FULL_DETAILS: 'green',
    };
    return colors[level] || 'gray';
  };

  const getPermissionLabel = (level: string) => {
    const labels: Record<string, string> = {
      VIEW_ONLY: 'View Only',
      CAN_EDIT: 'Can Edit',
      OWNER: 'Owner',
    };
    return labels[level] || level;
  };

  return (
    <Modal opened={opened} onClose={onClose} size="lg" title={<Title order={3}>Share Calendar</Title>}>
      <Stack gap="md">
        {/* Add new share */}
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            <Group gap="xs">
              <IconUserPlus size={18} />
              Share with User
            </Group>
          </Title>

          <Stack gap="sm">
            <TextInput
              label="Email Address"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Select
              label="Visibility Level"
              data={[
                { value: 'BUSY_ONLY', label: 'Busy Only - Show only time blocks' },
                { value: 'LIMITED_DETAILS', label: 'Limited Details - Show title and time' },
                { value: 'FULL_DETAILS', label: 'Full Details - Show all information' },
              ]}
              value={visibilityLevel}
              onChange={(v) => setVisibilityLevel(v || 'FULL_DETAILS')}
              description="How much detail can the recipient see?"
            />

            <Select
              label="Permission Level"
              data={[
                { value: 'VIEW_ONLY', label: 'View Only - Recipient can only view' },
                { value: 'CAN_EDIT', label: 'Can Edit - Recipient can edit events' },
              ]}
              value={permissionLevel}
              onChange={(v) => setPermissionLevel(v || 'VIEW_ONLY')}
              description="What can the recipient do with your calendar?"
            />

            <Group>
              <ColorInput
                label="Overlay Color"
                value={color}
                onChange={setColor}
                format="hex"
                swatches={[
                  '#228be6', '#40c057', '#fab005', '#fd7e14', '#fa5252',
                  '#7950f2', '#be4bdb', '#20c997', '#1098ad', '#fcc419'
                ]}
              />

              <Switch
                label="Create Shareable Link"
                description="Generate a public link for sharing"
                checked={isPublicLink}
                onChange={(e) => setIsPublicLink(e.currentTarget.checked)}
              />
            </Group>

            {isPublicLink && (
              <Alert variant="light" color="yellow" title="Public Link Warning">
                Shareable links can be accessed by anyone who has the link. Use with caution.
              </Alert>
            )}

            <DateInput
              label="Expiration Date (Optional)"
              placeholder="Select expiration date"
              value={expiresAt}
              onChange={setExpiresAt}
              clearable
              minDate={new Date()}
              description="Leave empty for no expiration"
            />

            <Button
              onClick={handleShare}
              loading={createShareMutation.isPending}
              leftSection={<IconShare size={16} />}
              fullWidth
            >
              Share Calendar
            </Button>
          </Stack>
        </Paper>

        {/* Existing shares */}
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            Shared With
          </Title>

          {isLoading ? (
            <Flex justify="center" p="md">
              <Loader />
            </Flex>
          ) : shares.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">
              You haven't shared your calendar with anyone yet
            </Text>
          ) : (
            <ScrollArea.Autosize mah={300}>
              <Stack gap="sm">
                {shares.map((share) => (
                  <Paper key={share.id} p="sm" withBorder>
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={0} flex={1}>
                        <Group gap="xs">
                          <Text fw={500}>{share.sharedWith.name}</Text>
                          <Badge size="xs" variant="light">
                            {share.sharedWith.role}
                          </Badge>
                        </Group>

                        <Text size="sm" c="dimmed">
                          {share.sharedWith.email}
                        </Text>

                        <Group gap="xs" mt="xs">
                          <Badge
                            size="sm"
                            color={getVisibilityColor(share.visibilityLevel)}
                            leftSection={<IconEye size={12} />}
                          >
                            {getVisibilityLabel(share.visibilityLevel)}
                          </Badge>

                          <Badge
                            size="sm"
                            variant="light"
                            leftSection={share.canEdit ? <IconLock size={12} /> : undefined}
                          >
                            {getPermissionLabel(share.permissionLevel)}
                          </Badge>

                          {share.color && (
                            <Badge
                              size="sm"
                              color="dark"
                              style={{
                                backgroundColor: share.color,
                                color: 'white'
                              }}
                            >
                              Color
                            </Badge>
                          )}

                          {share.expiresAt && (
                            <Badge size="sm" color="orange" variant="light">
                              Expires {dayjs(share.expiresAt).format('MMM D, YYYY')}
                            </Badge>
                          )}
                        </Group>

                        {share.isPublicLink && share.shareToken && (
                          <Group gap="xs" mt="xs">
                            <Button
                              size="xs"
                              variant="light"
                              leftSection={
                                copiedToken === share.shareToken ? (
                                  <IconCheck size={14} />
                                ) : (
                                  <IconCopy size={14} />
                                )
                              }
                              onClick={() => copyShareLink(share.shareToken!)}
                            >
                              {copiedToken === share.shareToken ? 'Copied!' : 'Copy Link'}
                            </Button>
                          </Group>
                        )}
                      </Stack>

                      <Tooltip label="Revoke access">
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => handleRevoke(share.id)}
                          loading={deleteShareMutation.isPending}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Paper>
      </Stack>
    </Modal>
  );
};
