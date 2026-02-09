import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, Textarea, TagsInput, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { Note } from '../../../types';

interface EditNoteModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
  note: Note | null;
  existingNoteTags: string[];
}

export function EditNoteModal({ opened, onClose, clientId, note, existingNoteTags }: EditNoteModalProps) {
  const queryClient = useQueryClient();

  const [noteText, setNoteText] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync form when modal opens or note changes
  useEffect(() => {
    if (opened && note) {
      setNoteText(note.text);
      setNoteTags(note.tags || []);
    }
  }, [opened, note]);

  const handleClose = () => {
    setNoteText('');
    setNoteTags([]);
    onClose();
  };

  const handleUpdate = async () => {
    if (!note || !noteText.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Note text is required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.put(`/notes/${note.id}`, {
        text: noteText,
        tags: noteTags,
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const updatedNote = await response.json();
      queryClient.setQueryData(['client-notes', clientId], (old: Note[] = []) => old.map(n => n.id === updatedNote.id ? { ...n, text: updatedNote.text, tags: updatedNote.tags, updatedAt: updatedNote.updatedAt } : n));
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      handleClose();

      notifications.show({
        title: 'Success',
        message: 'Note updated successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update note',
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
      title="Edit Note"
    >
      <Stack>
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
          <Button onClick={handleUpdate} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
