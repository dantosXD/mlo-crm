import { useState, useEffect, useMemo, useRef } from 'react';
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
  Paper,
  ActionIcon,
  Tooltip,
  TagsInput,
  Box,
  Skeleton,
  Checkbox,
  Pagination,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch, IconEye, IconTrash, IconFilter, IconX, IconTag, IconArrowUp, IconArrowDown, IconArrowsSort, IconCalendar, IconDownload, IconEyeOff, IconMail, IconArchive } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';
import { canWriteClients } from '../utils/roleUtils';
import { useClientStatuses } from '../hooks';
import { handleFetchError } from '../utils/errorHandler';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { BulkCommunicationComposer } from './BulkCommunicationComposer';
import { DeleteClientModal } from '../components/client/modals/DeleteClientModal';
import { CLIENT_STATUS_COLORS } from '../utils/constants';
import type { Client } from '../types';

const statusColors = CLIENT_STATUS_COLORS;

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
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          aria-label={revealed ? 'Hide masked value' : 'Reveal masked value'}
        >
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
  const isMobile = useMediaQuery('(max-width: 576px)');

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

  // Archive modal state
  const [archiveModalClient, setArchiveModalClient] = useState<{ id: string; name: string } | null>(null);

  // Bulk archive state
  const [bulkArchiveModalOpen, setBulkArchiveModalOpen] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);

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

  const queryClient = useQueryClient();

  const statusOptions = useClientStatuses();

  // Fetch clients with server-side search/filter/pagination to keep large datasets discoverable.
  const { data: clientsResponse = { clients: [] as Client[], total: 0, totalPages: 1 }, isLoading: loading } = useQuery({
    queryKey: ['clients', searchQuery, statusFilter, tagFilter, dateFilter, page, itemsPerPage, sortColumn, sortDirection],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (tagFilter) params.append('tag', tagFilter);
      if (dateFilter) params.append('dateRange', dateFilter);
      params.append('page', String(page));
      params.append('limit', String(itemsPerPage));
      if (sortColumn) {
        params.append('sortBy', sortColumn);
        params.append('sortOrder', sortDirection);
      }
      const response = await api.get(`/clients?${params.toString()}`, { signal });
      const payload = await response.json();

      if (Array.isArray(payload)) {
        return {
          clients: payload as Client[],
          total: (payload as Client[]).length,
          totalPages: Math.max(1, Math.ceil((payload as Client[]).length / itemsPerPage)),
        };
      }

      const rows = (payload.data || payload.clients || []) as Client[];
      const total = payload.pagination?.total ?? rows.length;
      const totalPages = payload.pagination?.totalPages ?? Math.max(1, Math.ceil(total / itemsPerPage));
      return { clients: rows, total, totalPages };
    },
    enabled: !!accessToken,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const clients = clientsResponse.clients;
  const totalClientsCount = clientsResponse.total;
  const totalPages = clientsResponse.totalPages;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create client');
      }

      await response.json();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
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

  const handleArchiveClient = (id: string, name: string) => {
    setArchiveModalClient({ id, name });
  };

  const handleBulkArchive = async () => {
    setBulkArchiving(true);
    try {
      const results = await Promise.allSettled(
        selectedClientIds.map(id => api.delete(`/clients/${id}`))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setSelectedClientIds([]);
      setBulkArchiveModalOpen(false);
      if (failed === 0) {
        notifications.show({
          title: 'Clients Archived',
          message: `${succeeded} client(s) archived successfully.`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Partial Success',
          message: `${succeeded} archived, ${failed} failed. Please retry.`,
          color: 'orange',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to archive clients',
        color: 'red',
      });
    } finally {
      setBulkArchiving(false);
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
      await queryClient.invalidateQueries({ queryKey: ['clients'] });

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

  const paginatedClients = clients;


  // Export clients to CSV — requires a confirm click to prevent accidental exports
  const [exportConfirming, setExportConfirming] = useState(false);
  const exportConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exportToCSV = async () => {
    if (!exportConfirming) {
      setExportConfirming(true);
      exportConfirmTimerRef.current = setTimeout(() => setExportConfirming(false), 3000);
      return;
    }

    setExportConfirming(false);
    if (exportConfirmTimerRef.current) clearTimeout(exportConfirmTimerRef.current);

    const exportParams = new URLSearchParams();
    if (searchQuery.trim()) exportParams.append('q', searchQuery.trim());
    if (statusFilter) exportParams.append('status', statusFilter);
    if (tagFilter) exportParams.append('tag', tagFilter);
    if (dateFilter) exportParams.append('dateRange', dateFilter);
    if (sortColumn) {
      exportParams.append('sortBy', sortColumn);
      exportParams.append('sortOrder', sortDirection);
    }

    const fetchAllFilteredClients = async (): Promise<Client[]> => {
      const pageSize = 250;
      let currentPage = 1;
      let totalPagesForExport = 1;
      const rows: Client[] = [];

      while (currentPage <= totalPagesForExport) {
        const params = new URLSearchParams(exportParams);
        params.set('page', String(currentPage));
        params.set('limit', String(pageSize));
        const response = await api.get(`/clients?${params.toString()}`);
        const payload = await response.json();
        if (Array.isArray(payload)) {
          return payload as Client[];
        }

        const pageRows = (payload.data || payload.clients || []) as Client[];
        rows.push(...pageRows);
        totalPagesForExport = payload.pagination?.totalPages || 1;
        currentPage += 1;
      }

      return rows;
    };

    const exportRows = await fetchAllFilteredClients();
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Tags', 'Created'];
    const csvContent = [
      headers.join(','),
      ...exportRows.map(client => [
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
      message: `Exported ${exportRows.length} clients to CSV`,
      color: 'green',
    });
  };

  const hasActiveFilters = Boolean(searchQuery || statusFilter || tagFilter || dateFilter);

  return (
    <Box style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <Container size="xl" py="md" style={{ maxWidth: '100%' }}>
        {/* Header */}
        <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
          <Title order={2}>Clients</Title>
          <Group gap="sm">
            <Tooltip label={exportConfirming ? 'Click again to confirm export' : `Export ${totalClientsCount} clients to CSV`} withArrow>
              <Button
                variant="outline"
                color={exportConfirming ? 'orange' : undefined}
                leftSection={<IconDownload size={16} aria-hidden="true" />}
                onClick={exportToCSV}
              >
                {exportConfirming ? 'Confirm Export?' : 'Export CSV'}
              </Button>
            </Tooltip>
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
                  color="orange"
                  leftSection={<IconArchive size={14} />}
                  onClick={() => setBulkArchiveModalOpen(true)}
                >
                  Archive Selected
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

        {/* Clients Table / Card list */}
        <Paper shadow="xs" p="md" withBorder style={{ overflow: 'hidden' }}>
          {loading ? (
            /* Skeleton loading state */
            isMobile ? (
              <Stack gap="sm">
                {[...Array(5)].map((_, i) => (
                  <Paper key={i} p="sm" withBorder radius="md">
                    <Skeleton height={16} width="60%" mb={8} />
                    <Skeleton height={12} width="40%" mb={6} />
                    <Skeleton height={20} width={80} radius="xl" />
                  </Paper>
                ))}
              </Stack>
            ) : (
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
            )
          ) : totalClientsCount === 0 ? (
            !hasActiveFilters ? (
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
            {isMobile ? (
              /* Mobile: card-based layout */
              <Stack gap="sm">
                {paginatedClients.map((client) => (
                  <Paper
                    key={client.id}
                    p="sm"
                    withBorder
                    radius="md"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigateToClient(client.id)}
                  >
                    <Group justify="space-between" wrap="nowrap" mb={4}>
                      <Text fw={600} size="sm" truncate="end" style={{ flex: 1 }}>{client.name}</Text>
                      <Badge size="sm" color={statusColors[client.status] || 'gray'} style={{ whiteSpace: 'nowrap' }}>
                        {client.status.replace(/_/g, ' ')}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mb={4}>{client.email}</Text>
                    <Group justify="space-between" align="center">
                      <Text size="xs" c="dimmed">
                        Added {new Date(client.createdAt).toLocaleDateString()}
                      </Text>
                      {canWrite && (
                        <Tooltip label="Archive">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="orange"
                            onClick={(e) => { e.stopPropagation(); handleArchiveClient(client.id, client.name); }}
                            aria-label={`Archive ${client.name}`}
                          >
                            <IconTrash size={14} aria-hidden="true" />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              /* Desktop: full table */
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
                      <Table.Th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <Group gap={4} wrap="nowrap">Name {getSortIcon('name')}</Group>
                      </Table.Th>
                      <Table.Th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <Group gap={4} wrap="nowrap">Email {getSortIcon('email')}</Group>
                      </Table.Th>
                      <Table.Th>Phone</Table.Th>
                      <Table.Th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <Group gap={4} wrap="nowrap">Status {getSortIcon('status')}</Group>
                      </Table.Th>
                      <Table.Th>Tags</Table.Th>
                      <Table.Th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <Group gap={4} wrap="nowrap">Created {getSortIcon('createdAt')}</Group>
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
                                <Badge key={index} size="sm" variant="outline" color="violet">{tag}</Badge>
                              ))
                            ) : (
                              <Text c="dimmed" size="sm">-</Text>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>{new Date(client.createdAt).toLocaleDateString()}</Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Tooltip label="View Details">
                              <ActionIcon variant="subtle" color="blue" onClick={() => navigateToClient(client.id)} aria-label={`View details for ${client.name}`}>
                                <IconEye size={16} aria-hidden="true" />
                              </ActionIcon>
                            </Tooltip>
                            {canWrite && (
                              <Tooltip label="Archive">
                                <ActionIcon variant="subtle" color="orange" onClick={() => handleArchiveClient(client.id, client.name)} aria-label={`Archive ${client.name}`}>
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
            )}
            {totalClientsCount > 0 && (
              <Group justify="space-between" align="center" mt="md" wrap="wrap" gap="sm">
                <Text c="dimmed" size="sm">
                  Showing {totalClientsCount === 0 ? 0 : ((page - 1) * itemsPerPage + 1)}–{Math.min(page * itemsPerPage, totalClientsCount)} of {totalClientsCount} clients
                  {statusFilter && ` · ${statusFilter.replace('_', ' ')}`}
                  {tagFilter && ` · ${tagFilter}`}
                </Text>
                {totalPages > 1 && (
                  <Pagination
                    value={page}
                    onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    total={totalPages}
                    size="sm"
                  />
                )}
              </Group>
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

        {/* Bulk Archive Confirmation Modal */}
        <Modal
          opened={bulkArchiveModalOpen}
          onClose={() => setBulkArchiveModalOpen(false)}
          title={`Archive ${selectedClientIds.length} Client(s)`}
          centered
        >
          <Stack>
            <Text>
              Archive <strong>{selectedClientIds.length} selected client(s)</strong>? They will be hidden from the client list but their data will be preserved.
            </Text>
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setBulkArchiveModalOpen(false)}>
                Cancel
              </Button>
              <Button color="orange" onClick={handleBulkArchive} loading={bulkArchiving} leftSection={<IconArchive size={14} />}>
                Archive {selectedClientIds.length} Client(s)
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Archive Client Modal */}
        {archiveModalClient && (
          <DeleteClientModal
            opened={!!archiveModalClient}
            onClose={() => setArchiveModalClient(null)}
            clientId={archiveModalClient.id}
            clientName={archiveModalClient.name}
            onSuccess={() => {
              setArchiveModalClient(null);
              queryClient.invalidateQueries({ queryKey: ['clients'] });
            }}
          />
        )}
      </Container>
    </Box>
  );
}
