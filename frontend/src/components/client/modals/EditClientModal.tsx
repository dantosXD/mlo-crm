import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, TextInput, Select, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { Client } from '../../../types';

interface EditClientModalProps {
  opened: boolean;
  onClose: () => void;
  client: Client;
  clientId: string;
  onUnsavedChange?: (hasChanges: boolean) => void;
}

export function EditClientModal({ opened, onClose, client, clientId, onUnsavedChange }: EditClientModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: '',
  });
  const [saving, setSaving] = useState(false);

  // Sync form when modal opens or client changes
  useEffect(() => {
    if (opened && client) {
      setEditForm({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        status: client.status,
      });
    }
  }, [opened, client]);

  const hasUnsavedChanges = useMemo(() => {
    if (!opened || !client) return false;
    return (
      editForm.name !== client.name ||
      editForm.email !== client.email ||
      editForm.phone !== (client.phone || '') ||
      editForm.status !== client.status
    );
  }, [opened, client, editForm]);

  // Report unsaved changes to parent for safeNavigate coordination
  useEffect(() => {
    onUnsavedChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChange]);

  // Handle browser back/forward and tab close with beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    if (!editForm.name || !editForm.email) {
      notifications.show({
        title: 'Validation Error',
        message: 'Name and email are required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.put(`/clients/${clientId}`, editForm);

      // Handle deleted client scenario (404)
      if (response.status === 404) {
        notifications.show({
          title: 'Client Not Found',
          message: 'This client has been deleted by another user. You will be redirected to the clients list.',
          color: 'orange',
          autoClose: 4000,
        });
        onClose();
        // Redirect to clients list after a short delay
        setTimeout(() => {
          navigate('/clients');
        }, 4000);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      const updatedClient = await response.json();
      queryClient.setQueryData(['client', clientId], updatedClient);
      onClose();

      notifications.show({
        title: 'Success',
        message: 'Client updated successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating client:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update client',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit Client"
    >
      <Stack>
        <TextInput
          label="Name"
          placeholder="Client name"
          required
          value={editForm.name}
          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
        />
        <TextInput
          label="Email"
          placeholder="client@example.com"
          required
          type="email"
          value={editForm.email}
          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
        />
        <TextInput
          label="Phone"
          placeholder="(555) 123-4567"
          value={editForm.phone}
          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
        />
        <Select
          label="Status"
          data={[
            { value: 'LEAD', label: 'Lead' },
            { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PROCESSING', label: 'Processing' },
            { value: 'UNDERWRITING', label: 'Underwriting' },
            { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
          value={editForm.status}
          onChange={(value) => setEditForm({ ...editForm, status: value || 'LEAD' })}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
