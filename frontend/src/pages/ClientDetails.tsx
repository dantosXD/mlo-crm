import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Text,
  Paper,
  LoadingOverlay,
  Badge,
  Stack,
  Tabs,
  Card,
  SimpleGrid,
  Center,
  Alert,
  Breadcrumbs,
  Anchor,
  Modal,
  TextInput,
  Select,
  TagsInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconUser,
  IconNotes,
  IconFiles,
  IconChecklist,
  IconCalculator,
  IconTimeline,
  IconAlertCircle,
  IconLock,
  IconHome,
  IconChevronRight,
  IconEdit,
  IconTrash,
  IconTag,
  IconPlus,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  notes: any[];
  tasks: any[];
  documents: any[];
  loanScenarios: any[];
}
interface Note {
  id: string;
  clientId: string;
  text: string;
  tags: string[];
  isPinned: boolean;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt?: string;
}


const statusColors: Record<string, string> = {
  LEAD: 'gray',
  PRE_QUALIFIED: 'blue',
  ACTIVE: 'green',
  PROCESSING: 'yellow',
  UNDERWRITING: 'orange',
  CLEAR_TO_CLOSE: 'lime',
  CLOSED: 'teal',
  DENIED: 'red',
  INACTIVE: 'gray',
};

const API_URL = 'http://localhost:3000/api';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const statusOptions = [
    { value: 'LEAD', label: 'Lead' },
    { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'UNDERWRITING', label: 'Underwriting' },
    { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'DENIED', label: 'Denied' },
  ];

  useEffect(() => {
    if (id) {
      fetchClient();
      fetchNotes();
    }
  }, [id]);

  const fetchClient = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (response.status === 404) {
        setError('Client not found');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch client');
      }

      const data = await response.json();
      setClient(data);
    } catch (error) {
      console.error('Error fetching client:', error);
      setError('Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = () => {
    if (client) {
      setEditForm({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        status: client.status,
      });
      setEditModalOpen(true);
    }
  };

  const handleSaveClient = async () => {
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
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      const updatedClient = await response.json();
      setClient(updatedClient);
      setEditModalOpen(false);

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

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
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
        message: 'Failed to delete client',
        color: 'red',
      });
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus || !client || newStatus === client.status) return;

    const oldStatus = client.status;
    setUpdatingStatus(true);

    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: client.name,
          email: client.email,
          phone: client.phone,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const updatedClient = await response.json();
      setClient(updatedClient);

      notifications.show({
        title: 'Status Updated',
        message: `Status changed from ${oldStatus.replace('_', ' ')} to ${newStatus.replace('_', ' ')}`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update status',
        color: 'red',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTagsChange = async (newTags: string[]) => {
    if (!client) return;

    setUpdatingTags(true);

    try {
      const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: client.name,
          email: client.email,
          phone: client.phone,
          status: client.status,
          tags: newTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update tags');
      }

      const updatedClient = await response.json();
      setClient(updatedClient);

      notifications.show({
        title: 'Tags Updated',
        message: `Tags updated successfully`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating tags:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update tags',
        color: 'red',
      });
    } finally {
      setUpdatingTags(false);
    }
  };

  const fetchNotes = async () => {
    if (!id) return;
    setLoadingNotes(true);
    try {
      const response = await fetch(`${API_URL}/notes?client_id=${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Note text is required',
        color: 'red',
      });
      return;
    }

    setSavingNote(true);
    try {
      const response = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId: id,
          text: newNoteText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const createdNote = await response.json();
      setNotes([createdNote, ...notes]);
      setAddNoteModalOpen(false);
      setNewNoteText('');

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
      setSavingNote(false);
    }
  };


  if (loading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (accessDenied) {
    return (
      <Container size="xl" py="md">
        <Center h={400}>
          <Paper p="xl" withBorder shadow="sm" style={{ textAlign: 'center', maxWidth: 500 }}>
            <IconLock size={64} color="var(--mantine-color-red-6)" style={{ marginBottom: 16 }} />
            <Title order={2} mb="sm">Access Denied</Title>
            <Text c="dimmed" mb="lg">
              You do not have permission to view this client. This client belongs to another user.
            </Text>
            <Button onClick={() => navigate('/clients')}>
              Back to Clients
            </Button>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (error || !client) {
    return (
      <Container size="xl" py="md">
        <Center h={400}>
          <Paper p="xl" withBorder shadow="sm" style={{ textAlign: 'center', maxWidth: 500 }}>
            <IconAlertCircle size={64} color="var(--mantine-color-orange-6)" style={{ marginBottom: 16 }} />
            <Title order={2} mb="sm">Client Not Found</Title>
            <Text c="dimmed" mb="lg">
              {error || 'The requested client could not be found.'}
            </Text>
            <Button onClick={() => navigate('/clients')}>
              Back to Clients
            </Button>
          </Paper>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        separator={<IconChevronRight size={14} color="gray" />}
        mb="md"
      >
        <Anchor onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          Dashboard
        </Anchor>
        <Anchor onClick={() => navigate('/clients')} style={{ cursor: 'pointer' }}>
          Clients
        </Anchor>
        <Text>{client.name}</Text>
      </Breadcrumbs>

      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>{client.name}</Title>
          <Select
            value={client.status}
            onChange={handleStatusChange}
            data={statusOptions}
            disabled={updatingStatus}
            size="sm"
            w={160}
            styles={{
              input: {
                backgroundColor: `var(--mantine-color-${statusColors[client.status] || 'gray'}-light)`,
                color: `var(--mantine-color-${statusColors[client.status] || 'gray'}-filled)`,
                fontWeight: 600,
                border: `1px solid var(--mantine-color-${statusColors[client.status] || 'gray'}-outline)`,
              },
            }}
          />
        </Group>
        <Group>
          <Button
            leftSection={<IconEdit size={16} />}
            variant="light"
            onClick={openEditModal}
          >
            Edit
          </Button>
          <Button
            leftSection={<IconTrash size={16} />}
            variant="light"
            color="red"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete
          </Button>
        </Group>
      </Group>

      {/* Client Info Card */}
      <Paper shadow="xs" p="md" withBorder mb="lg">
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <div>
            <Text size="sm" c="dimmed">Email</Text>
            <Text>{client.email}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Phone</Text>
            <Text>{client.phone || '-'}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Created</Text>
            <Text>{new Date(client.createdAt).toLocaleDateString()}</Text>
          </div>
        </SimpleGrid>
        <TagsInput
          label="Tags"
          placeholder="Add tags (press Enter to add)"
          value={client.tags || []}
          onChange={handleTagsChange}
          disabled={updatingTags}
          leftSection={<IconTag size={16} />}
          clearable
        />
      </Paper>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconUser size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
            Notes ({notes.length})
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFiles size={16} />}>
            Documents ({client.documents?.length || 0})
          </Tabs.Tab>
          <Tabs.Tab value="tasks" leftSection={<IconChecklist size={16} />}>
            Tasks ({client.tasks?.length || 0})
          </Tabs.Tab>
          <Tabs.Tab value="loans" leftSection={<IconCalculator size={16} />}>
            Loan Scenarios ({client.loanScenarios?.length || 0})
          </Tabs.Tab>
          <Tabs.Tab value="activity" leftSection={<IconTimeline size={16} />}>
            Activity
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Card withBorder>
              <Title order={4} mb="sm">Recent Notes</Title>
              {client.notes?.length > 0 ? (
                <Stack gap="xs">
                  {client.notes.map((note: any) => (
                    <Paper key={note.id} p="sm" withBorder>
                      <Text size="sm" lineClamp={2}>{note.text}</Text>
                      <Text size="xs" c="dimmed" mt="xs">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">No notes yet</Text>
              )}
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">Recent Tasks</Title>
              {client.tasks?.length > 0 ? (
                <Stack gap="xs">
                  {client.tasks.map((task: any) => (
                    <Paper key={task.id} p="sm" withBorder>
                      <Group justify="space-between">
                        <Text size="sm">{task.text}</Text>
                        <Badge size="sm" color={task.status === 'COMPLETE' ? 'green' : 'blue'}>
                          {task.status}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">No tasks yet</Text>
              )}
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="notes" pt="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Notes</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setAddNoteModalOpen(true)}
            >
              Add Note
            </Button>
          </Group>
          {loadingNotes ? (
            <Text c="dimmed">Loading notes...</Text>
          ) : notes.length === 0 ? (
            <Text c="dimmed">No notes yet. Click "Add Note" to create one.</Text>
          ) : (
            <Stack gap="md">
              {notes.map((note) => (
                <Paper key={note.id} p="md" withBorder>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>{note.text}</Text>
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
        </Tabs.Panel>

        <Tabs.Panel value="documents" pt="md">
          <Text c="dimmed">Document management coming soon...</Text>
        </Tabs.Panel>

        <Tabs.Panel value="tasks" pt="md">
          <Text c="dimmed">Task management coming soon...</Text>
        </Tabs.Panel>

        <Tabs.Panel value="loans" pt="md">
          <Text c="dimmed">Loan scenario management coming soon...</Text>
        </Tabs.Panel>

        <Tabs.Panel value="activity" pt="md">
          <Text c="dimmed">Activity timeline coming soon...</Text>
        </Tabs.Panel>
      </Tabs>

      {/* Edit Client Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
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
            <Button variant="subtle" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClient} loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Client"
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to delete <strong>{client.name}</strong>? This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteClient} loading={deleting}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
      {/* Add Note Modal */}
      <Modal
        opened={addNoteModalOpen}
        onClose={() => setAddNoteModalOpen(false)}
        title="Add Note"
      >
        <Stack>
          <Textarea
            label="Note"
            placeholder="Enter your note..."
            required
            minRows={4}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setAddNoteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} loading={savingNote}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
