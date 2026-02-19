import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Stack, Text, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';

interface DeleteClientModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

export function DeleteClientModal({ opened, onClose, clientId, clientName, onSuccess }: DeleteClientModalProps) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await api.delete(`/clients/${clientId}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, string>;
        throw new Error(body.message || body.error || `Failed to archive client (${response.status})`);
      }

      notifications.show({
        title: 'Client Archived',
        message: `${clientName} has been archived and hidden from the client list.`,
        color: 'green',
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/clients');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to archive client',
        color: 'red',
      });
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Archive Client"
      centered
    >
      <Stack>
        <Text>
          Archive <strong>{clientName}</strong>? They will be hidden from the client list but their data will be preserved.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="orange" onClick={handleDelete} loading={deleting}>
            Archive
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
