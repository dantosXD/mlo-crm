import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  TagsInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch, IconEye, IconEdit, IconTrash, IconFilter, IconX, IconTag } from '@tabler/icons-react';
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize filter state from URL search params for persistence on navigation
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get('status') || null);
  const [tagFilter, setTagFilter] = useState<string | null>(searchParams.get('tag') || null);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const itemsPerPage = 10;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'LEAD',
    tags: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  // Sync filter state to URL search params for persistence on navigation
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter) params.set('status', statusFilter);
    if (tagFilter) params.set('tag', tagFilter);
    if (page > 1) params.set('page', page.toString());

    // Update URL without adding to history (replace instead of push)
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, tagFilter, page, setSearchParams]);

  // Fetch clients on mount and when location changes (handles back navigation)
  useEffect(() => {
    fetchClients();
  }, [accessToken, location.key]);

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
      setNewClient({ name: '', email: '', phone: '', status: 'LEAD', tags: [] });

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

  // Get unique tags from all clients for the filter dropdown
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    clients.forEach(client => {
      if (client.tags && Array.isArray(client.tags)) {
        client.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [clients]);

  // Filter clients by search query, status, and tag
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || client.status === statusFilter;
    const matchesTag = !tagFilter || (client.tags && client.tags.includes(tagFilter));
    return matchesSearch && matchesStatus && matchesTag;
  });

  // Paginate filtered clients
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(0, page * itemsPerPage);
  const hasMore = page * itemsPerPage < filteredClients.length;

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

      {/* Search and Filters */}
      <Group mb="md" gap="md">
        <TextInput
          placeholder="Search clients..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1); // Reset to first page when search changes
          }}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Filter by status"
          leftSection={<IconFilter size={16} />}
          clearable
          data={[
            { value: 'LEAD', label: 'Lead' },
            { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PROCESSING', label: 'Processing' },
            { value: 'UNDERWRITING', label: 'Underwriting' },
            { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
            { value: 'CLOSED', label: 'Closed' },
            { value: 'DENIED', label: 'Denied' },
          ]}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1); // Reset to first page when filter changes
          }}
          w={200}
        />
        <Select
          placeholder="Filter by tag"
          leftSection={<IconTag size={16} />}
          clearable
          data={allTags.map(tag => ({ value: tag, label: tag }))}
          value={tagFilter}
          onChange={(value) => {
            setTagFilter(value);
            setPage(1); // Reset to first page when filter changes
          }}
          w={180}
        />
        {(searchQuery || statusFilter || tagFilter) && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconX size={16} />}
            onClick={() => {
              setSearchQuery('');
              setStatusFilter(null);
              setTagFilter(null);
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </Group>

      {/* Clients Table */}
      <Paper shadow="xs" p="md" withBorder>
        {filteredClients.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {clients.length === 0 ? 'No clients yet. Click "Add Client" to create one.' : 'No clients match your search or filter.'}
          </Text>
        ) : (
          <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tags</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedClients.map((client) => (
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
                    <Group gap={4}>
                      {client.tags && client.tags.length > 0 ? (
                        client.tags.map((tag, index) => (
                          <Badge key={index} size="sm" variant="outline" color="violet">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <Text c="dimmed" size="sm">-</Text>
                      )}
                    </Group>
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
          {hasMore && (
            <Group justify="center" mt="md">
              <Button
                variant="light"
                onClick={() => setPage(p => p + 1)}
              >
                Load More ({filteredClients.length - paginatedClients.length} remaining)
              </Button>
            </Group>
          )}
          {filteredClients.length > 0 && (
            <Text c="dimmed" size="sm" ta="center" mt="sm">
              Showing {paginatedClients.length} of {filteredClients.length} clients
              {statusFilter && ` (filtered by ${statusFilter.replace('_', ' ')})`}
              {tagFilter && ` (tagged: ${tagFilter})`}
            </Text>
          )}
          </>
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
          <TagsInput
            label="Tags"
            placeholder="Type tag and press Enter"
            value={newClient.tags}
            onChange={(value) => setNewClient({ ...newClient, tags: value })}
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
