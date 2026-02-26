import { useState, useEffect, useRef } from 'react';
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
  Tabs,
  Alert,
  Loader,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconRefresh,
  IconEye,
  IconCalendar,
  IconBellOff,
  IconPlus,
  IconPaperclip,
  IconSparkles,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { COMM_TYPE_CONFIG, COMM_STATUS_CONFIG, COMM_STATUS_FILTER_OPTIONS } from '../utils/constants';
import type { Communication, CommunicationsResponse } from '../types';

const TYPE_CONFIG = COMM_TYPE_CONFIG;
const STATUS_CONFIG = COMM_STATUS_CONFIG;

interface RenderedCommunicationPreview {
  body: {
    original: string;
    filled: string;
    placeholders: string[];
    missing: string[];
  };
  subject: {
    original: string;
    filled: string;
    placeholders: string[];
    missing: string[];
  } | null;
  context: Record<string, unknown>;
}

function hasHtmlContent(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

export function Communications() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isReadOnly = ['VIEWER', 'PROCESSOR', 'UNDERWRITER'].includes((user?.role || '').toUpperCase());
  const composeButtonRef = useRef<HTMLButtonElement | null>(null);

  const queryClient = useQueryClient();
  const [clientSearch, setClientSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scheduledFilter, setScheduledFilter] = useState<boolean>(false);
  const [followUpFilter, setFollowUpFilter] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Preview modal state
  const [previewOpened, setPreviewOpened] = useState(false);
  const [previewCommunication, setPreviewCommunication] = useState<Communication | null>(null);
  const [previewTab, setPreviewTab] = useState('details');
  const [renderedPreview, setRenderedPreview] = useState<RenderedCommunicationPreview | null>(null);
  const [loadingRenderedPreview, setLoadingRenderedPreview] = useState(false);
  const [renderedPreviewError, setRenderedPreviewError] = useState<string | null>(null);
  const [editingFollowUpDate, setEditingFollowUpDate] = useState<Date | null>(null);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

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

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (document.activeElement === document.body) {
      composeButtonRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPage(1);
      setSearchTerm(clientSearch.trim());
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [clientSearch]);

  const { data: commsData, isLoading: loading } = useQuery({
    queryKey: ['communications', page, typeFilter, statusFilter, scheduledFilter, followUpFilter, startDate?.toISOString(), endDate?.toISOString(), searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (scheduledFilter) params.append('scheduled', 'true');
      if (followUpFilter) params.append('follow_up', 'true');
      if (startDate) params.append('start_date', startDate.toISOString());
      if (endDate) params.append('end_date', endDate.toISOString());
      if (searchTerm) params.append('q', searchTerm);

      const response = await api.get(`/communications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch communications');
      return response.json() as Promise<CommunicationsResponse>;
    },
  });

  const communications = commsData?.data ?? [];
  const pagination = commsData?.pagination ?? { page: 1, limit, total: 0, totalPages: 0 };

  const handleClearFilters = () => {
    setClientSearch('');
    setSearchTerm('');
    setTypeFilter('all');
    setStatusFilter('all');
    setScheduledFilter(false);
    setFollowUpFilter(false);
    setStartDate(null);
    setEndDate(null);
    setPage(1);
  };

  const handlePreview = (communication: Communication) => {
    setPreviewCommunication(communication);
    setEditingFollowUpDate(communication.followUpDate ? new Date(communication.followUpDate) : null);
    setPreviewTab('details');
    void loadRenderedPreview(communication);
    setPreviewOpened(true);
  };

  const loadRenderedPreview = async (communication: Communication) => {
    if (!communication.clientId || !communication.body) {
      setRenderedPreview(null);
      return;
    }

    setLoadingRenderedPreview(true);
    setRenderedPreviewError(null);

    try {
      const response = await api.post('/communications/preview', {
        clientId: communication.clientId,
        body: communication.body,
        subject: communication.subject || undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to load rendered preview');
      }

      const data = await response.json() as RenderedCommunicationPreview;
      setRenderedPreview(data);
    } catch (error) {
      console.error('Error loading rendered preview:', error);
      setRenderedPreviewError('Unable to generate rendered preview');
      setRenderedPreview(null);
    } finally {
      setLoadingRenderedPreview(false);
    }
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
      await queryClient.invalidateQueries({ queryKey: ['communications'] });

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
                ref={composeButtonRef}
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate('/communications/compose')}
              >
                Compose
              </Button>
            )}
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['communications'] })}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group gap="md">
              <TextInput
                placeholder="Search by client name, subject, or body..."
                leftSection={<IconSearch size={16} />}
                value={clientSearch}
                onChange={event => setClientSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setPage(1);
                    setSearchTerm(clientSearch.trim());
                  }
                }}
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
                  setPage(1);
                }}
                style={{ minWidth: 140 }}
                clearable
              />

              <Select
                placeholder="Filter by status"
                data={COMM_STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(value: string | null) => {
                  setStatusFilter(value || 'all');
                  setPage(1);
                }}
                style={{ minWidth: 140 }}
                clearable
              />

              <Checkbox
                label="Scheduled only"
                checked={scheduledFilter}
                onChange={(event) => {
                  setScheduledFilter(event.currentTarget.checked);
                  setPage(1);
                }}
              />

              <Checkbox
                label="Follow-up due"
                checked={followUpFilter}
                onChange={(event) => {
                  setFollowUpFilter(event.currentTarget.checked);
                  setPage(1);
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
              onChange={(p) => setPage(p)}
            />
          </Group>
        )}

        {/* Preview Modal */}
        <Modal
          opened={previewOpened}
          onClose={() => {
            setPreviewOpened(false);
            setPreviewTab('details');
            setRenderedPreviewError(null);
          }}
          title={
            <Group gap="sm">
              <IconEye size={20} />
              <Text fw={500}>Communication Details</Text>
            </Group>
          }
          size="lg"
        >
          {previewCommunication && (
            <Tabs value={previewTab} onChange={(value) => setPreviewTab(value || 'details')}>
              <Tabs.List>
                <Tabs.Tab value="details" leftSection={<IconEye size={14} />}>
                  Details
                </Tabs.Tab>
                <Tabs.Tab value="rendered" leftSection={<IconSparkles size={14} />}>
                  Final Rendered
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="details" pt="md">
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
              </Tabs.Panel>

              <Tabs.Panel value="rendered" pt="md">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Preview of final content with placeholders resolved for this client.
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconRefresh size={14} />}
                      onClick={() => void loadRenderedPreview(previewCommunication)}
                      loading={loadingRenderedPreview}
                    >
                      Refresh
                    </Button>
                  </Group>

                  {loadingRenderedPreview ? (
                    <Group justify="center" py="lg">
                      <Loader size="sm" />
                    </Group>
                  ) : renderedPreviewError ? (
                    <Alert color="red" title="Preview Error">
                      {renderedPreviewError}
                    </Alert>
                  ) : renderedPreview ? (
                    (() => {
                      const renderedSubject = renderedPreview.subject?.filled || previewCommunication.subject || '';
                      const renderedBody = renderedPreview.body.filled || previewCommunication.body;
                      const missing = Array.from(
                        new Set([
                          ...renderedPreview.body.missing,
                          ...(renderedPreview.subject?.missing || []),
                        ]),
                      );

                      return (
                        <Stack gap="md">
                          {missing.length > 0 && (
                            <Alert color="yellow" title="Missing Placeholder Values">
                              <Group gap="xs" mt="xs">
                                {missing.map((key) => (
                                  <Badge key={key} variant="light" color="yellow">
                                    {key}
                                  </Badge>
                                ))}
                              </Group>
                            </Alert>
                          )}

                          {renderedSubject && (
                            <Stack gap="xs">
                              <Text size="sm" fw={500} c="dimmed">
                                Final Subject:
                              </Text>
                              <Paper withBorder p="sm">
                                <Text>{renderedSubject}</Text>
                              </Paper>
                            </Stack>
                          )}

                          <Stack gap="xs">
                            <Text size="sm" fw={500} c="dimmed">
                              Final Message:
                            </Text>

                            {previewCommunication.type === 'SMS' ? (
                              <Paper withBorder p="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                {renderedBody}
                              </Paper>
                            ) : hasHtmlContent(renderedBody) ? (
                              <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
                                <iframe
                                  title="Rendered communication preview"
                                  srcDoc={renderedBody}
                                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                                  referrerPolicy="no-referrer"
                                  style={{ width: '100%', minHeight: 360, border: 'none' }}
                                />
                              </Paper>
                            ) : (
                              <Paper withBorder p="md" bg="gray.0">
                                <Paper withBorder p="md" bg="white">
                                  <Text style={{ whiteSpace: 'pre-wrap' }}>{renderedBody}</Text>
                                </Paper>
                              </Paper>
                            )}
                          </Stack>
                        </Stack>
                      );
                    })()
                  ) : (
                    <Text size="sm" c="dimmed">
                      No rendered preview available.
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}
