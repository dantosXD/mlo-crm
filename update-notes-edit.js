const fs = require("fs");
const path = "./frontend/src/pages/ClientDetails.tsx";
let content = fs.readFileSync(path, "utf8");

// Add edit state variables after savingNote state
content = content.replace(
  "const [savingNote, setSavingNote] = useState(false);",
  `const [savingNote, setSavingNote] = useState(false);
  const [editNoteModalOpen, setEditNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editNoteText, setEditNoteText] = useState('');`
);

// Add handleEditNote and handleUpdateNote functions after handleCreateNote
const editNoteFuncs = `

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setEditNoteText(note.text);
    setEditNoteModalOpen(true);
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !editNoteText.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Note text is required',
        color: 'red',
      });
      return;
    }

    setSavingNote(true);
    try {
      const response = await fetch(\`\${API_URL}/notes/\${editingNote.id}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${accessToken}\`,
        },
        body: JSON.stringify({
          text: editNoteText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const updatedNote = await response.json();
      setNotes(notes.map(n => n.id === updatedNote.id ? { ...n, text: updatedNote.text, updatedAt: updatedNote.updatedAt } : n));
      setEditNoteModalOpen(false);
      setEditingNote(null);
      setEditNoteText('');

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
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await fetch(\`\${API_URL}/notes/\${noteId}\`, {
        method: 'DELETE',
        headers: {
          Authorization: \`Bearer \${accessToken}\`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      setNotes(notes.filter(n => n.id !== noteId));

      notifications.show({
        title: 'Success',
        message: 'Note deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete note',
        color: 'red',
      });
    }
  };
`;

content = content.replace(
  /setSavingNote\(false\);\s*\}\s*\};(\s*const fetchNotes)/,
  (match, fetchNotes) => `setSavingNote(false);\n    }\n  };` + editNoteFuncs + fetchNotes
);

// Update the note display to include edit/delete buttons
const oldNoteDisplay = `<Paper key={note.id} p="md" withBorder>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>{note.text}</Text>
                  <Group justify="space-between" mt="sm">
                    <Text size="xs" c="dimmed">
                      By {note.createdBy?.name || 'Unknown'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(note.createdAt).toLocaleString()}
                    </Text>
                  </Group>
                </Paper>`;

const newNoteDisplay = `<Paper key={note.id} p="md" withBorder>
                  <Group justify="space-between" align="flex-start">
                    <Text style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{note.text}</Text>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" color="blue" onClick={() => handleEditNote(note)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteNote(note.id)}>
                        <IconTrash size={16} />
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
                </Paper>`;

content = content.replace(oldNoteDisplay, newNoteDisplay);

// Add ActionIcon to imports if not present
if (!content.includes('ActionIcon,')) {
  content = content.replace(
    "Textarea,",
    "Textarea,\n  ActionIcon,"
  );
}

// Add Edit Note Modal after Add Note Modal
const editNoteModal = `
      {/* Edit Note Modal */}
      <Modal
        opened={editNoteModalOpen}
        onClose={() => { setEditNoteModalOpen(false); setEditingNote(null); setEditNoteText(''); }}
        title="Edit Note"
      >
        <Stack>
          <Textarea
            label="Note"
            placeholder="Enter your note..."
            required
            minRows={4}
            value={editNoteText}
            onChange={(e) => setEditNoteText(e.target.value)}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => { setEditNoteModalOpen(false); setEditingNote(null); setEditNoteText(''); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNote} loading={savingNote}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
`;

// Find the Add Note Modal and add Edit Note Modal after it
content = content.replace(
  /(\{\/\* Add Note Modal \*\/[\s\S]*?<\/Modal>)/,
  (match) => match + editNoteModal
);

fs.writeFileSync(path, content);
console.log("ClientDetails.tsx updated with Note edit/delete functionality");
