import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, Select, Textarea, TagsInput, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { Note } from '../../../types';

interface AddNoteModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
  existingNoteTags: string[];
}

export function AddNoteModal({ opened, onClose, clientId, existingNoteTags }: AddNoteModalProps) {
  const queryClient = useQueryClient();

  const [noteText, setNoteText] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch note templates on-demand when modal opens
  const { data: noteTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['note-templates'],
    queryFn: async () => {
      const response = await api.get('/notes/templates/list');
      if (!response.ok) throw new Error('Failed to fetch note templates');
      return response.json() as Promise<{ id: string; name: string; content: string }[]>;
    },
    enabled: opened,
  });

  const handleClose = () => {
    setNoteText('');
    setNoteTags([]);
    onClose();
  };

  const handleCreate = async () => {
    if (!noteText.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Note text is required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/notes', {
        clientId,
        text: noteText,
        tags: noteTags,
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const createdNote = await response.json();
      queryClient.setQueryData(['client-notes', clientId], (old: Note[] = []) => [createdNote, ...old]);
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      handleClose();

      notifications.show({
        title: 'Success',
        message: 'Note created successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create note',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add Note"
    >
      <Stack>
        <Select
          label="Use Template (optional)"
          placeholder={loadingTemplates ? "Loading templates..." : "Select a template to start with"}
          data={noteTemplates.map(t => ({ value: t.id, label: t.name }))}
          clearable
          disabled={loadingTemplates}
          onChange={(value) => {
            const template = noteTemplates.find(t => t.id === value);
            if (template) {
              setNoteText(template.content);
            }
          }}
        />
        <Textarea
          label="Note"
          placeholder="Enter your note..."
          required
          minRows={4}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
        <TagsInput
          label="Tags (optional)"
          placeholder="Add tags (press Enter to add)"
          value={noteTags}
          onChange={setNoteTags}
          data={existingNoteTags}
          clearable
          acceptValueOnBlur
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
