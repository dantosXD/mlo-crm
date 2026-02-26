import { Stack, Paper, Group, Text, Title, Button, ActionIcon } from '@mantine/core';
import { IconPlus, IconPin, IconPinnedOff, IconEdit, IconTrash } from '@tabler/icons-react';
import { EmptyState } from '../EmptyState';
import type { Note } from '../../types';

interface NotesTabProps {
  notes: Note[];
  sortedNotes: Note[];
  loadingNotes: boolean;
  onAddNote: () => void;
  onTogglePin: (note: Note) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (noteId: string) => void;
}

export function NotesTab({
  notes,
  sortedNotes,
  loadingNotes,
  onAddNote,
  onTogglePin,
  onEditNote,
  onDeleteNote,
}: NotesTabProps) {
  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Notes</Title>
        <Button
          leftSection={<IconPlus size={16} aria-hidden="true" />}
          onClick={onAddNote}
        >
          Add Note
        </Button>
      </Group>
      {loadingNotes ? (
        <Text c="dimmed">Loading notes...</Text>
      ) : notes.length === 0 ? (
        <EmptyState
          iconType="notes"
          title="No notes yet"
          description="Capture call outcomes, borrower preferences, and blockers here so anyone can pick up the file quickly."
          ctaLabel="Add First Note"
          onCtaClick={onAddNote}
        />
      ) : (
        <Stack gap="md">
          {sortedNotes.map((note) => (
            <Paper key={note.id} p="md" withBorder style={note.isPinned ? { borderColor: 'var(--mantine-color-blue-5)', borderWidth: 2 } : {}}>
              <Group justify="space-between" align="flex-start">
                <Group gap="xs" style={{ flex: 1 }}>
                  {note.isPinned && <IconPin size={16} color="var(--mantine-color-blue-6)" aria-hidden="true" />}
                  <Text style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{note.text}</Text>
                </Group>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color={note.isPinned ? 'blue' : 'gray'}
                    onClick={() => onTogglePin(note)}
                    title={note.isPinned ? 'Unpin note' : 'Pin to top'}
                    aria-label={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                  >
                    {note.isPinned ? <IconPinnedOff size={16} aria-hidden="true" /> : <IconPin size={16} aria-hidden="true" />}
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="blue" onClick={() => onEditNote(note)} aria-label="Edit note">
                    <IconEdit size={16} aria-hidden="true" />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => onDeleteNote(note.id)} aria-label="Delete note">
                    <IconTrash size={16} aria-hidden="true" />
                  </ActionIcon>
                </Group>
              </Group>
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">
                  By {note.createdBy?.name || 'Unknown'}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(note.createdAt).toLocaleString()}
                </Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </>
  );
}
