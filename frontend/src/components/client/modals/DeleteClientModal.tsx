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
}

export function DeleteClientModal({ opened, onClose, clientId, clientName }: DeleteClientModalProps) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await api.delete(`/clients/${clientId}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, string>;
        throw new Error(body.message || body.error || `Failed to delete client (${response.status})`);
      }

      notifications.show({
        title: 'Success',
        message: 'Client deleted successfully',
        color: 'green',
      });

      // Navigate to clients list after successful deletion
      navigate('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete client',
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
      title="Delete Client"
      centered
    >
      <Stack>
        <Text>
          Are you sure you want to delete <strong>{clientName}</strong>? This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
