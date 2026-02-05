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
  ScrollArea,
  Skeleton,
  Checkbox,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch, IconEye, IconEdit, IconTrash, IconFilter, IconX, IconTag, IconArrowUp, IconArrowDown, IconArrowsSort, IconCalendar, IconDownload, IconEyeOff, IconMail } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';
import { canWriteClients } from '../utils/roleUtils';
import { handleFetchError, fetchWithErrorHandling } from '../utils/errorHandler';
import { API_URL } from '../utils/apiBase';
import { api } from '../utils/api';
import { decryptData } from '../utils/encryption';
import { BulkCommunicationComposer } from './BulkCommunicationComposer';

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
  CLOSED: 'green.9',
  DENIED: 'red',
  INACTIVE: 'gray',
};

// Mask email: show first 2 chars, mask middle, show domain
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

// Mask phone: show last 4 digits only
function maskPhone(phone: string): string {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
}

// Component for masked sensitive data with reveal on hover/click
function MaskedData({ value, maskFn, label }: { value: string; maskFn: (v: string) => string; label: string }) {
  const [revealed, setRevealed] = useState(false);

  if (!value || value === '-') return <Text c="dimmed" size="sm">-</Text>;

  return (
    <Tooltip label={revealed ? `Hide ${label}` : `Click to reveal ${label}`}>
      <Group
        gap={4}
        wrap="nowrap"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          setRevealed(!revealed);
        }}
        onMouseEnter={() => setRevealed(true)}
        onMouseLeave={() => setRevealed(false)}
      >
        <Text size="sm" truncate="end" style={{ maxWidth: '150px' }}>
          {revealed ? value : maskFn(value)}
        </Text>
        <ActionIcon size="xs" variant="subtle" color="gray" aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}>
          {revealed ? <IconEyeOff size={12} aria-hidden="true" /> : <IconEye size={12} aria-hidden="true" />}
        </ActionIcon>
      </Group>
    </Tooltip>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, user } = useAuthStore();
  const canWrite = canWriteClients(user?.role);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery('(max-width: 576px)');

  // Status options fetched from backend
  const [statusOptions, setStatusOptions] = useState<Array<{ value: string; label: string }>>([]);

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

  // Bulk selection state
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkComposeModalOpen, setBulkComposeModalOpen] = useState(false);

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

  // Fetch clients on mount and when location changes (handles back navigation) or sort changes
  useEffect(() => {
    fetchClients();
    fetchStatuses();
  }, [accessToken, location.key, sortColumn, sortDirection]);

  const fetchStatuses = async () => {
    try {
      const response = await fetch(`${API_URL}/clients/statuses`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch client statuses');
      }

      const data = await response.json();
      setStatusOptions(data);
    } catch (error) {
      console.error('Error fetching client statuses:', error);
      // Fallback to hardcoded options if fetch fails
      setStatusOptions([
        { value: 'LEAD', label: 'Lead' },
        { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
        { value: 'ACTIVE', label: 'Active' },
        { value: 'PROCESSING', label: 'Processing' },
        { value: 'UNDERWRITING', label: 'Underwriting' },
        { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
        { value: 'CLOSED', label: 'Closed' },
        { value: 'DENIED', label: 'Denied' },
        { value: 'INACTIVE', label: 'Inactive' },
      ]);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      // Build query parameters including sort
      const params = new URLSearchParams();
      if (sortColumn) {
        params.append('sortBy', sortColumn);
        params.append('sortOrder', sortDirection);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';

      // Minimum loading time to ensure skeleton is visible (better UX)
      const [response] = await Promise.all([
        fetchWithErrorHandling(`${API_URL}/clients${queryString}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }, 'loading clients'),
        new Promise(resolve => setTimeout(resolve, 300)), // Minimum 300ms loading state for smooth UX
      ]);

      const data = await response.json();
      const normalized = Array.isArray(data) ? data : data.data || [];
      const decrypted = normalized.map((client: Client) => ({
        ...client,
        name: decryptData(client.name),
        email: decryptData(client.email),
        phone: decryptData(client.phone),
      }));
      setClients(decrypted);
    } catch (error) {
      console.error('Error fetching clients:', error);
      handleFetchError(error, 'loading clients');
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
      const response = await api.post('/clients', newClient);

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
      handleFetchError(error, 'creating client');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) {
      return;
    }

    try {
      const response = await api.delete(`/clients/${id}`);

      setClients(clients.filter(c => c.id !== id));
      notifications.show({
        title: 'Success',
        message: 'Client deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting client:', error);
      handleFetchError(error, 'deleting client');
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedClientIds.length === 0) {
      return;
    }

    setBulkUpdating(true);
    try {
      const response = await api.patch('/clients/bulk', {
        clientIds: selectedClientIds,
        status: bulkStatus,
      });

      const result = await response.json();

      // Refresh clients list
      const clientsResponse = await fetchWithErrorHandling(`${API_URL}/clients`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }, 'loading clients');
      const updatedClients = await clientsResponse.json();
      setClients(updatedClients);

      setSelectedClientIds([]);
      setBulkStatusModalOpen(false);
      setBulkStatus(null);

      notifications.show({
        title: 'Success',
        message: result.message || 'Clients updated successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error bulk updating clients:', error);
      handleFetchError(error, 'updating clients');
    } finally {
      setBulkUpdating(false);
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
      return <IconArrowsSort size={14} style={{ opacity: 0.3 }} aria-hidden="true" />;
    }
    return sortDirection === 'asc'
      ? <IconArrowUp size={14} aria-hidden="true" />
      : <IconArrowDown size={14} aria-hidden="true" />;
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

  // NOTE: Sorting is now done server-side via API, no client-side sorting needed
  // The clients array is already sorted when returned from the API

  // Paginate filtered clients
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(0, page * itemsPerPage);
  const hasMore = page * itemsPerPage < filteredClients.length;


  // Export clients to CSV
  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Tags', 'Created'];
    const csvContent = [
      headers.join(','),
      ...filteredClients.map(client => [
        `"${client.name.replace(/"/g, '""')}"`,
        `"${client.email.replace(/"/g, '""')}"`,
        `"${(client.phone || '-').replace(/"/g, '""')}"`,
        `"${client.status}"`,
        `"${(client.tags || []).join('; ')}"`,
        `"${new Date(client.createdAt).toLocaleDateString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'clients-export.csv';
    link.click();
    URL.revokeObjectURL(link.href);

    notifications.show({
      title: 'Export Complete',
      message: `Exported ${filteredClients.length} clients to CSV`,
      color: 'green',
    });
  };

  return (
    <Box style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <Container size="xl" py="md" style={{ maxWidth: '100%' }}>
        {/* Header */}
        <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
          <Title order={2}>Clients</Title>
          <Group gap="sm">
            <Button
              variant="outline"
              leftSection={<IconDownload size={16} aria-hidden="true" />}
              onClick={exportToCSV}
            >
              Export CSV
            </Button>
            {canWrite && (
              <Button
                leftSection={<IconPlus size={16} aria-hidden="true" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Add Client
              </Button>
            )}
          </Group>
        </Group>

        {/* Search and Filters - responsive wrap */}
        <Stack gap="sm" mb="md">
          <TextInput
            placeholder="Search clients..."
            leftSection={<IconSearch size={16} aria-hidden="true" />}
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
              leftSection={<IconFilter size={16} aria-hidden="true" />}
              clearable
              data={statusOptions}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1); // Reset to first page when filter changes
              }}
              style={{ flex: '1 1 150px', minWidth: '140px' }}
            />
            <Select
              placeholder="Filter by tag"
              leftSection={<IconTag size={16} aria-hidden="true" />}
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
              leftSection={<IconCalendar size={16} aria-hidden="true" />}
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

        {/* Bulk Actions Bar */}
        {canWrite && selectedClientIds.length > 0 && (
          <Paper shadow="xs" p="md" withBorder mb="sm" style={{ backgroundColor: '#f8f9fa' }}>
            <Group justify="space-between" wrap="wrap">
              <Text fw={500}>{selectedClientIds.length} client(s) selected</Text>
              <Group gap="sm">
                <Button
                  size="sm"
                  leftSection={<IconMail size={14} />}
                  onClick={() => setBulkComposeModalOpen(true)}
                >
                  Compose Message
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBulkStatusModalOpen(true)}
                >
                  Change Status
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => setSelectedClientIds([])}
                >
                  Clear Selection
                </Button>
              </Group>
            </Group>
          </Paper>
        )}

        {/* Clients Table - scrollable on mobile */}
        <Paper shadow="xs" p="md" withBorder style={{ overflow: 'hidden' }}>
          {loading ? (
            /* Skeleton loading state that matches table layout */
            <Box style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table striped style={{ minWidth: '700px' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: '200px' }}>Name</Table.Th>
                    <Table.Th style={{ width: '200px' }}>Email</Table.Th>
                    <Table.Th style={{ width: '120px' }}>Phone</Table.Th>
                    <Table.Th style={{ width: '120px' }}>Status</Table.Th>
                    <Table.Th style={{ width: '100px' }}>Tags</Table.Th>
                    <Table.Th style={{ width: '100px' }}>Created</Table.Th>
                    <Table.Th style={{ width: '80px' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...Array(8)].map((_, index) => (
                    <Table.Tr key={index}>
                      <Table.Td><Skeleton height={20} width="80%" radius="sm" /></Table.Td>
                      <Table.Td><Skeleton height={20} width="70%" radius="sm" /></Table.Td>
                      <Table.Td><Skeleton height={20} width="90%" radius="sm" /></Table.Td>
                      <Table.Td><Skeleton height={24} width={80} radius="xl" /></Table.Td>
                      <Table.Td><Skeleton height={20} width={50} radius="xl" /></Table.Td>
                      <Table.Td><Skeleton height={20} width="80%" radius="sm" /></Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Skeleton height={28} width={28} radius="sm" />
                          <Skeleton height={28} width={28} radius="sm" />
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          ) : filteredClients.length === 0 ? (
            clients.length === 0 ? (
              <EmptyState
                iconType="clients"
                title="No clients yet"
                description={canWrite ? "Get started by adding your first client to the system." : "No clients are available yet."}
                ctaLabel={canWrite ? "Add Client" : undefined}
                onCtaClick={canWrite ? () => setCreateModalOpen(true) : undefined}
              />
            ) : (
              <EmptyState
                iconType="clients"
                title="No matching clients"
                description="No clients match your search or filter criteria. Try adjusting your search or clearing filters."
                ctaLabel="Clear Filters"
                onCtaClick={() => {
                  setSearchQuery('');
                  setStatusFilter(null);
                  setTagFilter(null);
                  setDateFilter(null);
                }}
              />
            )
          ) : (
            <>
            <Box style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table striped highlightOnHover style={{ minWidth: '750px' }}>
                <Table.Thead>
                  <Table.Tr>
                    {canWrite && (
                      <Table.Th style={{ width: '50px' }}>
                        <Checkbox
                          checked={selectedClientIds.length === paginatedClients.length && paginatedClients.length > 0}
                          onChange={(e) => {
                            if (e.currentTarget.checked) {
                              setSelectedClientIds(paginatedClients.map(c => c.id));
                            } else {
                              setSelectedClientIds([]);
                            }
                          }}
                        />
                      </Table.Th>
                    )}
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
                      {canWrite && (
                        <Table.Td>
                          <Checkbox
                            checked={selectedClientIds.includes(client.id)}
                            onChange={(e) => {
                              if (e.currentTarget.checked) {
                                setSelectedClientIds([...selectedClientIds, client.id]);
                              } else {
                                setSelectedClientIds(selectedClientIds.filter(id => id !== client.id));
                              }
                            }}
                          />
                        </Table.Td>
                      )}
                      <Table.Td style={{ maxWidth: '200px' }}>
                        <Text fw={500} truncate="end" title={client.name}>{client.name}</Text>
                      </Table.Td>
                      <Table.Td style={{ maxWidth: '200px' }}>
                        <MaskedData value={client.email} maskFn={maskEmail} label="email" />
                      </Table.Td>
                      <Table.Td>
                        <MaskedData value={client.phone || ''} maskFn={maskPhone} label="phone" />
                      </Table.Td>
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
                              aria-label={`View details for ${client.name}`}
                            >
                              <IconEye size={16} aria-hidden="true" />
                            </ActionIcon>
                          </Tooltip>
                          {canWrite && (
                            <Tooltip label="Delete">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => handleDeleteClient(client.id)}
                                aria-label={`Delete ${client.name}`}
                              >
                                <IconTrash size={16} aria-hidden="true" />
                              </ActionIcon>
                            </Tooltip>
                          )}
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
                  Load More ({filteredClients.length - paginatedClients.length} remaining)
                </Button>
              </Group>
            )}
            {filteredClients.length > 0 && (
              <Text c="dimmed" size="sm" ta="center" mt="sm">
                Showing {paginatedClients.length} of {filteredClients.length} clients
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
          fullScreen={isMobile}
          styles={{
            body: {
              maxHeight: isMobile ? 'calc(100vh - 60px)' : undefined,
              overflowY: 'auto',
            },
          }}
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

        {/* Bulk Status Update Modal */}
        <Modal
          opened={bulkStatusModalOpen}
          onClose={() => {
            setBulkStatusModalOpen(false);
            setBulkStatus(null);
          }}
          title={`Update Status for ${selectedClientIds.length} Client(s)`}
        >
          <Stack>
            <Text size="sm">Select new status for {selectedClientIds.length} selected client(s):</Text>
            <Select
              placeholder="Select status"
              data={statusOptions}
              value={bulkStatus}
              onChange={setBulkStatus}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setBulkStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusUpdate} loading={bulkUpdating} disabled={!bulkStatus}>
                Update Status
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Bulk Communication Composer Modal */}
        <BulkCommunicationComposer
          opened={bulkComposeModalOpen}
          onClose={() => setBulkComposeModalOpen(false)}
          clientIds={selectedClientIds}
        />
      </Container>
    </Box>
  );
}
