import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Table,
  Badge,
  Text,
  TextInput,
  Modal,
  Stack,
  Select,
  LoadingOverlay,
  Paper,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch, IconEye, IconEdit, IconTrash } from '@tabler/icons-react';
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

export default function Clients() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'LEAD',
  });
  const [creating, setCreating] = useState(false);

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/clients`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load clients',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.email) {
      notifications.show({
        title: 'Validation Error',
        message: 'Name and email are required',
        color: 'red',
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(newClient),
      });

      if (!response.ok) {
        throw new Error('Failed to create client');
      }

      const createdClient = await response.json();
      setClients([createdClient, ...clients]);
      setCreateModalOpen(false);
      setNewClient({ name: '', email: '', phone: '', status: 'LEAD' });

      notifications.show({
        title: 'Success',
        message: 'Client created successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating client:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create client',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) {
      return;
    }

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

      setClients(clients.filter(c => c.id !== id));
      notifications.show({
        title: 'Success',
        message: 'Client deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting client:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete client',
        color: 'red',
      });
    }
  };

  // Filter clients by search query
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} />

      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Title order={2}>Clients</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          Add Client
        </Button>
      </Group>

      {/* Search */}
      <TextInput
        placeholder="Search clients..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        mb="md"
      />

      {/* Clients Table */}
      <Paper shadow="xs" p="md" withBorder>
        {filteredClients.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {clients.length === 0 ? 'No clients yet. Click "Add Client" to create one.' : 'No clients match your search.'}
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredClients.map((client) => (
                <Table.Tr key={client.id}>
                  <Table.Td>
                    <Text fw={500}>{client.name}</Text>
                  </Table.Td>
                  <Table.Td>{client.email}</Table.Td>
                  <Table.Td>{client.phone || '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={statusColors[client.status] || 'gray'}>
                      {client.status.replace('_', ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {new Date(client.createdAt).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="View Details">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/clients/${client.id}`)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteClient(client.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Create Client Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New Client"
      >
        <Stack>
          <TextInput
            label="Name"
            placeholder="Client name"
            required
            value={newClient.name}
            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
          />
          <TextInput
            label="Email"
            placeholder="client@example.com"
            required
            type="email"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
          />
          <TextInput
            label="Phone"
            placeholder="(555) 123-4567"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
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
            value={newClient.status}
            onChange={(value) => setNewClient({ ...newClient, status: value || 'LEAD' })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClient} loading={creating}>
              Create Client
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
