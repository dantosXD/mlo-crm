import { useState, useEffect } from 'react';
import {
  Title,
  Stack,
  Paper,
  Table,
  Button,
  Group,
  Badge,
  Text,
  LoadingOverlay,
  TextInput,
  Select,
  ActionIcon,
  Container,
  Pagination,
  Box,
  Modal,
  Checkbox,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconRefresh,
  IconEye,
  IconCalendar,
  IconBell,
  IconBellOff,
  IconPlus,
  IconPaperclip,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../utils/apiBase';
import { api } from '../utils/api';

interface Communication {
  id: string;
  clientId: string;
  clientName: string;
  type: string;
  status: string;
  subject: string | null;
  body: string;
  recipient: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  followUpDate: string | null;
  attachments: any[];
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  templateName: string | null;
}

interface CommunicationsResponse {
  data: Communication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Type labels and colors
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  EMAIL: { label: 'Email', color: 'blue' },
  SMS: { label: 'SMS', color: 'cyan' },
  LETTER: { label: 'Letter', color: 'grape' },
};

// Status labels and colors
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'gray' },
  READY: { label: 'Ready', color: 'blue' },
  PENDING: { label: 'Pending', color: 'yellow' },
  SENT: { label: 'Sent', color: 'green' },
  FAILED: { label: 'Failed', color: 'red' },
  DELIVERED: { label: 'Delivered', color: 'green' },
  SCHEDULED: { label: 'Scheduled', color: 'cyan' },
};

export function Communications() {
  const { accessToken, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isReadOnly = ['VIEWER', 'PROCESSOR', 'UNDERWRITER'].includes((user?.role || '').toUpperCase());

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scheduledFilter, setScheduledFilter] = useState<boolean>(false);
  const [followUpFilter, setFollowUpFilter] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Preview modal state
  const [previewOpened, setPreviewOpened] = useState(false);
  const [previewCommunication, setPreviewCommunication] = useState<Communication | null>(null);
  const [editingFollowUpDate, setEditingFollowUpDate] = useState<Date | null>(null);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  const canViewAll = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    fetchCommunications();
  }, [pagination.page, typeFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    const state = location.state as { toast?: { title: string; message: string; color?: string } } | null;
    if (state?.toast) {
      notifications.show({
        title: state.toast.title,
        message: state.toast.message,
        color: state.toast.color || 'blue',
        autoClose: 6000,
      });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const fetchCommunications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (scheduledFilter) {
        params.append('scheduled', 'true');
      }
      if (followUpFilter) {
        params.append('follow_up', 'true');
      }
      if (startDate) {
        params.append('start_date', startDate.toISOString());
      }
      if (endDate) {
        params.append('end_date', endDate.toISOString());
      }
      if (clientSearch) {
        params.append('client_id', clientSearch);
      }

      const response = await fetch(`${API_URL}/communications?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch communications');
      }

      const data: CommunicationsResponse = await response.json();
      setCommunications(data.data || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (error) {
      console.error('Error fetching communications:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load communications',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchCommunications();
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearFilters = () => {
    setClientSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setStartDate(null);
    setEndDate(null);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePreview = (communication: Communication) => {
    setPreviewCommunication(communication);
    setEditingFollowUpDate(communication.followUpDate ? new Date(communication.followUpDate) : null);
    setPreviewOpened(true);
  };

  const handleUpdateFollowUpDate = async () => {
    if (!previewCommunication) return;

    setIsSavingFollowUp(true);
    try {
      const response = await api.put(`/communications/${previewCommunication.id}`, {
        followUpDate: editingFollowUpDate ? editingFollowUpDate.toISOString() : null,
      });

      if (!response.ok) {
        throw new Error('Failed to update follow-up date');
      }

      notifications.show({
        title: 'Success',
        message: 'Follow-up date updated successfully',
        color: 'green',
      });

      // Refresh the communication data
      await fetchCommunications();

      // Update the preview communication
      const updatedComm = await response.json();
      setPreviewCommunication({
        ...previewCommunication,
        followUpDate: updatedComm.followUpDate,
      });
    } catch (error) {
      console.error('Error updating follow-up date:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update follow-up date',
        color: 'red',
      });
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  const handleClearFollowUp = async () => {
    setEditingFollowUpDate(null);
    await handleUpdateFollowUpDate();
  };

  const rows = communications.map(comm => {
    const typeConfig = TYPE_CONFIG[comm.type] || { label: comm.type, color: 'gray' };
    const statusConfig = STATUS_CONFIG[comm.status] || { label: comm.status, color: 'gray' };

    return (
      <Table.Tr key={comm.id}>
        <Table.Td>
          <Text size="sm" fw={500}>
            {comm.clientName}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge color={typeConfig.color}>{typeConfig.label}</Badge>
        </Table.Td>
        <Table.Td>
          {comm.subject ? (
            <Text size="sm" lineClamp={1}>
              {comm.subject}
            </Text>
          ) : (
            <Text size="sm" lineClamp={1}>
              {comm.body.substring(0, 50)}...
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          <Badge color={statusConfig.color}>{statusConfig.label}</Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">
            {comm.scheduledAt
              ? new Date(comm.scheduledAt).toLocaleDateString()
              : comm.sentAt
              ? new Date(comm.sentAt).toLocaleDateString()
              : '-'}
          </Text>
        </Table.Td>
        <Table.Td>
          {comm.attachments && comm.attachments.length > 0 ? (
            <Group gap="xs">
              <IconPaperclip size={16} />
              <Text size="sm">{comm.attachments.length}</Text>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          <Text size="sm">{comm.createdBy.name}</Text>
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => handlePreview(comm)}
              title="View details"
            >
              <IconEye size={16} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>Communications</Title>
          <Group>
            {!isReadOnly && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate('/communications/compose')}
              >
                Compose
              </Button>
            )}
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchCommunications}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group gap="md">
              <TextInput
                placeholder="Search by client ID..."
                leftSection={<IconSearch size={16} />}
                value={clientSearch}
                onChange={event => setClientSearch(event.target.value)}
                onKeyPress={handleKeyPress}
                style={{ flex: 1 }}
              />

              <Select
                placeholder="Filter by type"
                data={[
                  { value: 'all', label: 'All Types' },
                  { value: 'EMAIL', label: 'Email' },
                  { value: 'SMS', label: 'SMS' },
                  { value: 'LETTER', label: 'Letter' },
                ]}
                value={typeFilter}
                onChange={(value: string | null) => {
                  setTypeFilter(value || 'all');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                style={{ minWidth: 140 }}
                clearable
              />

              <Select
                placeholder="Filter by status"
                data={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'READY', label: 'Ready' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'SENT', label: 'Sent' },
                  { value: 'DELIVERED', label: 'Delivered' },
                  { value: 'FAILED', label: 'Failed' },
                ]}
                value={statusFilter}
                onChange={(value: string | null) => {
                  setStatusFilter(value || 'all');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                style={{ minWidth: 140 }}
                clearable
              />

              <Checkbox
                label="Scheduled only"
                checked={scheduledFilter}
                onChange={(event) => {
                  setScheduledFilter(event.currentTarget.checked);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />

              <Checkbox
                label="Follow-up due"
                checked={followUpFilter}
                onChange={(event) => {
                  setFollowUpFilter(event.currentTarget.checked);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />

              <DateInput
                placeholder="Start date"
                value={startDate}
                onChange={setStartDate}
                leftSection={<IconCalendar size={16} />}
                style={{ minWidth: 140 }}
                clearable
              />

              <DateInput
                placeholder="End date"
                value={endDate}
                onChange={setEndDate}
                leftSection={<IconCalendar size={16} />}
                style={{ minWidth: 140 }}
                clearable
              />

              <Button variant="default" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder>
          <Box pos="relative">
            <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Subject/Body</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Attachments</Table.Th>
                  <Table.Th>Created By</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text ta="center" c="dimmed">
                        Loading communications...
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : communications.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Stack align="center" gap="md" py="xl">
                        <Text size="lg" fw={500}>
                          No communications found
                        </Text>
                        <Text size="sm" c="dimmed">
                          Send your first communication to see it here
                        </Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  rows
                )}
              </Table.Tbody>
            </Table>
          </Box>
        </Paper>

        {pagination.totalPages > 1 && (
          <Group justify="center">
            <Pagination
              total={pagination.totalPages}
              value={pagination.page}
              onChange={page => setPagination(prev => ({ ...prev, page }))}
            />
          </Group>
        )}

        {/* Preview Modal */}
        <Modal
          opened={previewOpened}
          onClose={() => setPreviewOpened(false)}
          title={
            <Group gap="sm">
              <IconEye size={20} />
              <Text fw={500}>Communication Details</Text>
            </Group>
          }
          size="lg"
        >
          {previewCommunication && (
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="xl" fw={600}>
                  {previewCommunication.clientName}
                </Text>
                <Group gap="xs">
                  <Badge
                    color={
                      TYPE_CONFIG[previewCommunication.type]?.color || 'gray'
                    }
                  >
                    {TYPE_CONFIG[previewCommunication.type]?.label || previewCommunication.type}
                  </Badge>
                  <Badge
                    color={
                      STATUS_CONFIG[previewCommunication.status]?.color || 'gray'
                    }
                  >
                    {STATUS_CONFIG[previewCommunication.status]?.label || previewCommunication.status}
                  </Badge>
                </Group>
              </Group>

              {previewCommunication.subject && (
                <Stack gap="xs">
                  <Text size="sm" fw={500} c="dimmed">
                    Subject:
                  </Text>
                  <Text>{previewCommunication.subject}</Text>
                </Stack>
              )}

              <Stack gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  Message:
                </Text>
                <Paper withBorder p="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {previewCommunication.body}
                </Paper>
              </Stack>

              {previewCommunication.recipient && (
                <Stack gap="xs">
                  <Text size="sm" fw={500} c="dimmed">
                    Recipient:
                  </Text>
                  <Text>{previewCommunication.recipient}</Text>
                </Stack>
              )}

              <Group gap="md">
                <Text size="sm" c="dimmed">
                  Template: <strong>{previewCommunication.templateName || 'None'}</strong>
                </Text>
                <Text size="sm" c="dimmed">
                  Created: <strong>{new Date(previewCommunication.createdAt).toLocaleString()}</strong>
                </Text>
                <Text size="sm" c="dimmed">
                  By: <strong>{previewCommunication.createdBy.name}</strong>
                </Text>
              </Group>

              {previewCommunication.scheduledAt && (
                <Text size="sm" c="dimmed">
                  Scheduled: <strong>{new Date(previewCommunication.scheduledAt).toLocaleString()}</strong>
                </Text>
              )}

              {previewCommunication.sentAt && (
                <Text size="sm" c="dimmed">
                  Sent: <strong>{new Date(previewCommunication.sentAt).toLocaleString()}</strong>
                </Text>
              )}

              {/* Follow-up Date Section */}
              {previewCommunication.status !== 'SENT' && (
                <Stack gap="xs" mt="md">
                  <Group gap="sm" justify="space-between">
                    <Text size="sm" fw={500} c="dimmed">
                      Follow-up Reminder
                    </Text>
                    {(previewCommunication.followUpDate || editingFollowUpDate) && (
                      <Tooltip label="Clear follow-up">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={handleClearFollowUp}
                          disabled={isSavingFollowUp}
                        >
                          <IconBellOff size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                  <Group gap="sm">
                    <DateInput
                      placeholder="Set follow-up date"
                      value={editingFollowUpDate}
                      onChange={setEditingFollowUpDate}
                      leftSection={<IconCalendar size={14} />}
                      minDate={new Date()}
                      clearable
                      style={{ flex: 1 }}
                      disabled={isSavingFollowUp}
                    />
                    <Button
                      size="sm"
                      onClick={handleUpdateFollowUpDate}
                      loading={isSavingFollowUp}
                      disabled={!editingFollowUpDate || editingFollowUpDate.getTime() === new Date(previewCommunication.followUpDate || 0).getTime()}
                    >
                      Set
                    </Button>
                  </Group>
                  {previewCommunication.followUpDate && (
                    <Text size="xs" c="blue">
                      {editingFollowUpDate && editingFollowUpDate.getTime() === new Date(previewCommunication.followUpDate).getTime()
                        ? `Follow-up set for ${new Date(previewCommunication.followUpDate).toLocaleDateString()}`
                        : `Current: ${new Date(previewCommunication.followUpDate).toLocaleDateString()}`}
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}
