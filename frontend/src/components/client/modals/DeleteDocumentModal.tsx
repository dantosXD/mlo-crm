import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, Text, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { ClientDocument } from '../../../types';

interface DeleteDocumentModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
  document: ClientDocument | null;
}

export function DeleteDocumentModal({ opened, onClose, clientId, document: doc }: DeleteDocumentModalProps) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!doc) {
      onClose();
      return;
    }

    setDeleting(true);
    try {
      const response = await api.delete(`/documents/${doc.id}`);

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      queryClient.setQueryData(['client-documents', clientId], (old: ClientDocument[] = []) => old.filter(d => d.id !== doc.id));
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      onClose();

      notifications.show({
        title: 'Success',
        message: 'Document deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete document',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Delete Document" centered>
      <Stack>
        <Text>
          Are you sure you want to delete <strong>{doc?.name}</strong>? This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete} loading={deleting}>
            Delete Document
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
