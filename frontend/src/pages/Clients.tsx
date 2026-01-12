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
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch, IconEye, IconEdit, IconTrash, IconFilter, IconX, IconTag, IconArrowUp, IconArrowDown, IconArrowsSort, IconCalendar } from '@tabler/icons-react';
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
  const [dateFilter, setDateFilter] = useState<string | null>(searchParams.get('dateRange') || null);
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
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  // Sorting state
  type SortColumn = 'name' | 'email' | 'status' | 'createdAt' | null;
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Navigate to client details while storing current filter state
  const navigateToClient = (clientId: string) => {
    // Store current URL (with search params) in sessionStorage so we can return to it
    sessionStorage.setItem('clientsListReferrer', location.pathname + location.search);
    navigate(`/clients/${clientId}`);
  };

  // Sync filter state to URL search params for persistence on navigation
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter) params.set('status', statusFilter);
    if (tagFilter) params.set('tag', tagFilter);
    if (dateFilter) params.set('dateRange', dateFilter);
    if (page > 1) params.set('page', page.toString());

    // Update URL without adding to history (replace instead of push)
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, tagFilter, dateFilter, page, setSearchParams]);

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
    // Validate required fields with specific error messages
    const errors: { name?: string; email?: string; phone?: string } = {};
    if (!newClient.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!newClient.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) {
      errors.email = 'Please enter a valid email address';
    }
    // Phone is optional, but if provided, validate format
    if (newClient.phone.trim() && !/^[\d\s\-\(\)\+\.]+$/.test(newClient.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Clear any previous errors
    setFormErrors({});

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
      setFormErrors({});

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

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort icon for a column
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <IconArrowsSort size={14} style={{ opacity: 0.3 }} />;
    }
    return sortDirection === 'asc'
      ? <IconArrowUp size={14} />
      : <IconArrowDown size={14} />;
  };

  // Helper function to check if client matches date filter
  const matchesDateFilter = (clientDate: string, filter: string | null): boolean => {
    if (!filter) return true;

    const now = new Date();
    const clientCreatedAt = new Date(clientDate);
    const diffTime = now.getTime() - clientCreatedAt.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    switch (filter) {
      case 'last7days':
        return diffDays <= 7;
      case 'last30days':
        return diffDays <= 30;
      case 'last90days':
        return diffDays <= 90;
      default:
        return true;
    }
  };

  // Filter clients by search query, status, tag, and date range
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || client.status === statusFilter;
    const matchesTag = !tagFilter || (client.tags && client.tags.includes(tagFilter));
    const matchesDate = matchesDateFilter(client.createdAt, dateFilter);
    return matchesSearch && matchesStatus && matchesTag && matchesDate;
  });

  // Sort filtered clients
  const sortedClients = useMemo(() => {
    if (!sortColumn) return filteredClients;

    return [...filteredClients].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredClients, sortColumn, sortDirection]);

  // Paginate sorted clients
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const paginatedClients = sortedClients.slice(0, page * itemsPerPage);
  const hasMore = page * itemsPerPage < sortedClients.length;

  return (
    <Box style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <Container size="xl" py="md" style={{ maxWidth: '100%' }}>
        <LoadingOverlay visible={loading} />

        {/* Header */}
        <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
          <Title order={2}>Clients</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add Client
          </Button>
        </Group>

        {/* Search and Filters - responsive wrap */}
        <Stack gap="sm" mb="md">
          <TextInput
            placeholder="Search clients..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1); // Reset to first page when search changes
            }}
            style={{ width: '100%' }}
          />
          <Group gap="sm" wrap="wrap">
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
              style={{ flex: '1 1 150px', minWidth: '140px' }}
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
              style={{ flex: '1 1 140px', minWidth: '120px' }}
            />
            <Select
              placeholder="Date range"
              leftSection={<IconCalendar size={16} />}
              clearable
              data={[
                { value: 'last7days', label: 'Last 7 days' },
                { value: 'last30days', label: 'Last 30 days' },
                { value: 'last90days', label: 'Last 90 days' },
              ]}
              value={dateFilter}
              onChange={(value) => {
                setDateFilter(value);
                setPage(1); // Reset to first page when filter changes
              }}
              style={{ flex: '1 1 130px', minWidth: '120px' }}
            />
            {(searchQuery || statusFilter || tagFilter || dateFilter) && (
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconX size={16} />}
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter(null);
                  setTagFilter(null);
                  setDateFilter(null);
                  setPage(1);
                }}
                style={{ flex: '0 0 auto' }}
              >
                Clear
              </Button>
            )}
          </Group>
        </Stack>

        {/* Clients Table - scrollable on mobile */}
        <Paper shadow="xs" p="md" withBorder style={{ overflow: 'hidden' }}>
          {filteredClients.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {clients.length === 0 ? 'No clients yet. Click "Add Client" to create one.' : 'No clients match your search or filter.'}
            </Text>
          ) : (
            <>
            <Box style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table striped highlightOnHover style={{ minWidth: '700px' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th
                      onClick={() => handleSort('name')}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Group gap={4} wrap="nowrap">
                        Name {getSortIcon('name')}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      onClick={() => handleSort('email')}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Group gap={4} wrap="nowrap">
                        Email {getSortIcon('email')}
                      </Group>
                    </Table.Th>
                    <Table.Th>Phone</Table.Th>
                    <Table.Th
                      onClick={() => handleSort('status')}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Group gap={4} wrap="nowrap">
                        Status {getSortIcon('status')}
                      </Group>
                    </Table.Th>
                    <Table.Th>Tags</Table.Th>
                    <Table.Th
                      onClick={() => handleSort('createdAt')}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Group gap={4} wrap="nowrap">
                        Created {getSortIcon('createdAt')}
                      </Group>
                    </Table.Th>
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
                        <Group gap="xs" wrap="nowrap">
                          <Tooltip label="View Details">
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => navigateToClient(client.id)}
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
            </Box>
            {hasMore && (
              <Group justify="center" mt="md">
                <Button
                  variant="light"
                  onClick={() => setPage(p => p + 1)}
                >
                  Load More ({sortedClients.length - paginatedClients.length} remaining)
                </Button>
              </Group>
            )}
            {sortedClients.length > 0 && (
              <Text c="dimmed" size="sm" ta="center" mt="sm">
                Showing {paginatedClients.length} of {sortedClients.length} clients
                {statusFilter && ` (filtered by ${statusFilter.replace('_', ' ')})`}
                {tagFilter && ` (tagged: ${tagFilter})`}
                {dateFilter && ` (${dateFilter === 'last7days' ? 'Last 7 days' : dateFilter === 'last30days' ? 'Last 30 days' : 'Last 90 days'})`}
                {sortColumn && ` (sorted by ${sortColumn}${sortDirection === 'desc' ? ' desc' : ''})`}
              </Text>
            )}
            </>
          )}
        </Paper>

        {/* Create Client Modal */}
        <Modal
          opened={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false);
            setFormErrors({});
          }}
          title="Add New Client"
        >
          <Stack>
            <TextInput
              label="Name"
              placeholder="Client name"
              required
              value={newClient.name}
              onChange={(e) => {
                setNewClient({ ...newClient, name: e.target.value });
                if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
              }}
              error={formErrors.name}
            />
            <TextInput
              label="Email"
              placeholder="client@example.com"
              required
              type="email"
              value={newClient.email}
              onChange={(e) => {
                setNewClient({ ...newClient, email: e.target.value });
                if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
              }}
              error={formErrors.email}
            />
            <TextInput
              label="Phone"
              placeholder="(555) 123-4567"
              value={newClient.phone}
              onChange={(e) => {
                setNewClient({ ...newClient, phone: e.target.value });
                if (formErrors.phone) setFormErrors({ ...formErrors, phone: undefined });
              }}
              error={formErrors.phone}
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
    </Box>
  );
}
