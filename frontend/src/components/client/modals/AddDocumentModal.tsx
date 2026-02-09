import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Modal, Stack, TextInput, Select, Textarea, Group, Button, Text, Progress,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../../../stores/authStore';
import { api } from '../../../utils/api';
import { API_URL } from '../../../utils/apiBase';
import type { ClientDocument } from '../../../types';

interface AddDocumentModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
}

const defaultForm = {
  name: '',
  fileName: '',
  category: 'OTHER' as ClientDocument['category'],
  status: 'UPLOADED' as ClientDocument['status'],
  expiresAt: null as Date | null,
  notes: '',
};

const getCsrfToken = (): string | null => {
  const match = document.cookie.match(/(?:^|; )csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export function AddDocumentModal({ opened, onClose, clientId }: AddDocumentModalProps) {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();

  const [form, setForm] = useState({ ...defaultForm });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleClose = () => {
    if (!saving) {
      setForm({ ...defaultForm });
      setSelectedFile(null);
      setUploadProgress(null);
      onClose();
    }
  };

  const refreshActivities = () => {
    queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Document name is required', color: 'red' });
      return;
    }

    if (!selectedFile && !form.fileName.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Either select a file or enter a file name', color: 'red' });
      return;
    }

    setSaving(true);

    if (selectedFile) {
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', clientId);
      formData.append('name', form.name);
      formData.append('category', form.category);
      formData.append('status', form.status);
      if (form.notes) formData.append('notes', form.notes);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const newDocument = JSON.parse(xhr.responseText);
            queryClient.setQueryData(['client-documents', clientId], (old: ClientDocument[] = []) => [newDocument, ...old]);
            handleClose();
            notifications.show({ title: 'Success', message: 'Document uploaded successfully', color: 'green' });
            refreshActivities();
          } catch {
            notifications.show({ title: 'Error', message: 'Failed to process upload response', color: 'red' });
          }
        } else {
          let message = 'Failed to upload document';
          try {
            const errorBody = JSON.parse(xhr.responseText);
            if (errorBody?.message) message = errorBody.message;
          } catch { /* Use default message */ }
          notifications.show({ title: 'Error', message, color: 'red' });
        }
        setSaving(false);
        setUploadProgress(null);
      });

      xhr.addEventListener('error', () => {
        notifications.show({ title: 'Error', message: 'Upload failed. Please check your connection.', color: 'red' });
        setSaving(false);
        setUploadProgress(null);
      });

      xhr.open('POST', `${API_URL}/documents/upload`);
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      const csrf = getCsrfToken();
      if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);
      xhr.withCredentials = true;
      xhr.send(formData);
    } else {
      // Metadata-only upload (no file)
      try {
        const response = await api.post('/documents', {
          clientId,
          name: form.name,
          fileName: form.fileName,
          category: form.category,
          status: form.status,
          expiresAt: form.expiresAt ? form.expiresAt.toISOString() : undefined,
          notes: form.notes || undefined,
        });

        if (!response.ok) throw new Error('Failed to create document');

        const newDocument = await response.json();
        queryClient.setQueryData(['client-documents', clientId], (old: ClientDocument[] = []) => [newDocument, ...old]);
        handleClose();
        notifications.show({ title: 'Success', message: 'Document created successfully', color: 'green' });
        refreshActivities();
      } catch (error) {
        console.error('Error creating document:', error);
        notifications.show({ title: 'Error', message: 'Failed to create document', color: 'red' });
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Document" size="lg">
      <Stack>
        <Dropzone
          onDrop={(files: FileWithPath[]) => {
            if (files.length > 0) {
              setSelectedFile(files[0]);
              if (!form.name) {
                setForm({ ...form, name: files[0].name.replace(/\.[^/.]+$/, '') });
              }
            }
          }}
          maxSize={10 * 1024 * 1024}
          accept={[
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]}
          disabled={saving}
        >
          <Group justify="center" gap="xl" mih={80} style={{ pointerEvents: 'none' }}>
            <IconUpload size={32} aria-hidden="true" />
            <div>
              <Text size="md" fw={500}>
                {selectedFile ? selectedFile.name : 'Drag file here or click to select'}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                PDF, Images, Word, Excel (max 10MB)
              </Text>
            </div>
          </Group>
        </Dropzone>

        {uploadProgress !== null && (
          <Progress value={uploadProgress} size="lg" animated striped />
        )}

        <TextInput
          label="Document Name"
          placeholder="e.g., Pay Stub - January 2024"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        {!selectedFile && (
          <TextInput
            label="File Name (if no upload)"
            placeholder="e.g., paystub_jan2024.pdf"
            value={form.fileName}
            onChange={(e) => setForm({ ...form, fileName: e.target.value })}
          />
        )}

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

        <Select
          label="Status"
          data={[
            { value: 'UPLOADED', label: 'Uploaded' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'EXPIRED', label: 'Expired' },
          ]}
          value={form.status}
          onChange={(value) => setForm({ ...form, status: (value as ClientDocument['status']) || 'UPLOADED' })}
        />

        <DateInput
          label="Expires At (optional)"
          placeholder="Select expiration date"
          value={form.expiresAt}
          onChange={(date) => setForm({ ...form, expiresAt: date })}
          clearable
        />

        <Textarea
          label="Notes (optional)"
          placeholder="Any additional notes..."
          minRows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={saving}>
            {selectedFile ? 'Upload' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
