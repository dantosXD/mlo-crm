const fs = require("fs");
const path = "./frontend/src/pages/ClientDetails.tsx";
let content = fs.readFileSync(path, "utf8");

const functionsToAdd = `

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

// Insert after handleCreateNote function ends and before if (loading)
content = content.replace(
  /(\s*\}\s*finally\s*\{\s*setSavingNote\(false\);\s*\}\s*\};)(\s*\n\s*\n\s*if \(loading\))/,
  '$1' + functionsToAdd + '\n$2'
);

fs.writeFileSync(path, content);
console.log("Functions added successfully");
