import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, TextInput, Select, Textarea, Group, Button } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { ClientDocument } from '../../../types';

interface RequestDocumentModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
}

const defaultForm = {
  documentName: '',
  category: 'OTHER' as ClientDocument['category'],
  dueDate: null as Date | null,
  message: '',
};

export function RequestDocumentModal({ opened, onClose, clientId }: RequestDocumentModalProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ ...defaultForm });
  const [requesting, setRequesting] = useState(false);

  const handleClose = () => {
    setForm({ ...defaultForm });
    onClose();
  };

  const handleRequest = async () => {
    if (!form.documentName.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please enter a document name',
        color: 'red',
      });
      return;
    }

    setRequesting(true);
    try {
      const response = await api.post('/documents/request', {
        clientId,
        documentName: form.documentName,
        category: form.category,
        dueDate: form.dueDate ? form.dueDate.toISOString() : null,
        message: form.message || null,
      });

      if (!response.ok) throw new Error('Failed to request document');

      const data = await response.json();

      queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });

      notifications.show({
        title: 'Success',
        message: data.emailLogged
          ? 'Document request logged to terminal (dev mode)'
          : 'Document request sent to client',
        color: 'green',
      });

      handleClose();
    } catch (error) {
      console.error('Error requesting document:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to request document',
        color: 'red',
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Request Document from Client">
      <Stack>
        <TextInput
          label="Document Name"
          placeholder="e.g., W-2 Form 2023"
          required
          value={form.documentName}
          onChange={(e) => setForm({ ...form, documentName: e.target.value })}
        />
        <Select
          label="Category"
          data={[
            { value: 'INCOME', label: 'Income' },
            { value: 'IDENTITY', label: 'Identity' },
            { value: 'PROPERTY', label: 'Property' },
            { value: 'CREDIT', label: 'Credit' },
            { value: 'EMPLOYMENT', label: 'Employment' },
            { value: 'TAX', label: 'Tax' },
            { value: 'INSURANCE', label: 'Insurance' },
            { value: 'LEGAL', label: 'Legal' },
            { value: 'OTHER', label: 'Other' },
          ]}
          value={form.category}
          onChange={(value) => setForm({ ...form, category: (value as ClientDocument['category']) || 'OTHER' })}
        />
        <DateInput
          label="Due Date (optional)"
          placeholder="When should the client provide this?"
          value={form.dueDate}
          onChange={(date) => setForm({ ...form, dueDate: date })}
          clearable
          minDate={new Date()}
        />
        <Textarea
          label="Message to Client (optional)"
          placeholder="Please provide your most recent..."
          minRows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleRequest} loading={requesting}>
            Send Request
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
