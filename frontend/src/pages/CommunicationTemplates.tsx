import { useState } from 'react';
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
  Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconEye,
  IconPlus,
  IconTemplate,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { COMM_TYPE_CONFIG } from '../utils/constants';
import type { CommunicationTemplate, PaginationInfo, MetaOption } from '../types';

interface TemplateResponse {
  data: CommunicationTemplate[];
  pagination: PaginationInfo;
}

const TYPE_CONFIG = COMM_TYPE_CONFIG;

export function CommunicationTemplates() {
  const { accessToken, user } = useAuthStore();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [deleting, setDeleting] = useState<string | null>(null);

  // Preview modal state
  const [previewOpened, setPreviewOpened] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<CommunicationTemplate | null>(null);

  const canManageTemplates = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Fetch meta options
  const { data: metaData } = useQuery({
    queryKey: ['comm-template-meta'],
    queryFn: async () => {
      const [typesRes, categoriesRes] = await Promise.all([
        api.get('/communication-templates/meta/types'),
        api.get('/communication-templates/meta/categories'),
      ]);
      const typeOptions = typesRes.ok ? ((await typesRes.json()).data || []) as MetaOption[] : [];
      const categoryOptions = categoriesRes.ok ? ((await categoriesRes.json()).data || []) as MetaOption[] : [];
      return { typeOptions, categoryOptions };
    },
    staleTime: 300_000,
  });

  const typeOptions = metaData?.typeOptions ?? [];
  const categoryOptions = metaData?.categoryOptions ?? [];

  // Fetch templates
  const { data: templateData, isLoading: loading } = useQuery({
    queryKey: ['comm-templates', page, typeFilter, categoryFilter, isActiveFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (isActiveFilter !== 'all') params.append('is_active', isActiveFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await api.get(`/communication-templates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json() as Promise<TemplateResponse>;
    },
  });

  const templates = templateData?.data ?? [];
  const pagination = templateData?.pagination ?? { page: 1, limit, total: 0, totalPages: 0 };

  const handleSearch = () => {
    setPage(1);
    setSearchTerm(search);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete template "${name}"?`)) {
      return;
    }

    setDeleting(id);
    try {
      const response = await api.delete(`/communication-templates/${id}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete template');
      }

      notifications.show({
        title: 'Success',
        message: 'Template deleted successfully',
        color: 'green',
      });

      queryClient.invalidateQueries({ queryKey: ['comm-templates'] });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete template',
        color: 'red',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = (template: CommunicationTemplate) => {
    setPreviewTemplate(template);
    setPreviewOpened(true);
  };

  const rows = templates.map(template => {
    const typeConfig = TYPE_CONFIG[template.type] || { label: template.type, color: 'gray' };

    return (
      <Table.Tr key={template.id}>
        <Table.Td>
          <Stack gap={0}>
            <Text fw={500}>{template.name}</Text>
            {template.subject && (
              <Text size="sm" c="dimmed">
                {template.subject}
              </Text>
            )}
          </Stack>
        </Table.Td>
        <Table.Td>
          <Badge color={typeConfig.color}>{typeConfig.label}</Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{template.category}</Text>
        </Table.Td>
        <Table.Td>
          {template.placeholders && template.placeholders.length > 0 ? (
            <Group gap="xs">
              {template.placeholders.slice(0, 3).map(ph => (
                <Badge key={ph} variant="outline" size="xs">
                  {ph}
                </Badge>
              ))}
              {template.placeholders.length > 3 && (
                <Badge variant="outline" size="xs">
                  +{template.placeholders.length - 3}
                </Badge>
              )}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              None
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          <Badge color={template.isActive ? 'green' : 'gray'}>
            {template.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => handlePreview(template)}
              title="Preview template"
            >
              <IconEye size={16} />
            </ActionIcon>
            {canManageTemplates && (
              <>
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  onClick={() => navigate(`/communication-templates/${template.id}/edit`)}
                  title="Edit template"
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => handleDelete(template.id, template.name)}
                  loading={deleting === template.id}
                  title="Delete template"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>Communication Templates</Title>
          {canManageTemplates && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate('/communication-templates/new')}
            >
              Create Template
            </Button>
          )}
        </Group>

        <Paper p="md" withBorder>
          <Group gap="md">
            <TextInput
              placeholder="Search templates..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyPress={handleKeyPress}
              style={{ flex: 1 }}
            />

            <Select
              placeholder="Filter by type"
              data={[
                { value: 'all', label: 'All Types' },
                ...typeOptions.map(opt => ({ value: opt.value, label: opt.label })),
              ]}
              value={typeFilter}
              onChange={(value: string | null) => {
                setTypeFilter(value || 'all');
                setPage(1);
              }}
              style={{ minWidth: 150 }}
              clearable
            />

            <Select
              placeholder="Filter by category"
              data={[
                { value: 'all', label: 'All Categories' },
                ...categoryOptions.map(opt => ({ value: opt.value, label: opt.label })),
              ]}
              value={categoryFilter}
              onChange={(value: string | null) => {
                setCategoryFilter(value || 'all');
                setPage(1);
              }}
              style={{ minWidth: 180 }}
              clearable
            />

            <Select
              placeholder="Filter by status"
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={isActiveFilter}
              onChange={(value: string | null) => {
                setIsActiveFilter(value || 'all');
                setPage(1);
              }}
              style={{ minWidth: 140 }}
              clearable
            />

            <ActionIcon
              variant="light"
              color="blue"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['comm-templates'] })}
              title="Refresh"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Paper>

        <Paper withBorder>
          <Box pos="relative">
            <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name / Subject</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Placeholders</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed">
                        Loading templates...
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : templates.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Stack align="center" gap="md" py="xl">
                        <IconTemplate size={48} style={{ opacity: 0.5 }} />
                        <Text size="lg" fw={500}>
                          No templates found
                        </Text>
                        <Text size="sm" c="dimmed">
                          {canManageTemplates
                            ? 'Create your first communication template to get started'
                            : 'No templates available'}
                        </Text>
                        {canManageTemplates && (
                          <Button
                            leftSection={<IconPlus size={16} />}
                            onClick={() => navigate('/communication-templates/new')}
                          >
                            Create Template
                          </Button>
                        )}
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
          onClose={() => setPreviewOpened(false)}
          title={
            <Group gap="sm">
              <IconTemplate size={20} />
              <Text fw={500}>Template Preview</Text>
            </Group>
          }
          size="lg"
        >
          {previewTemplate && (
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="xl" fw={600}>
                  {previewTemplate.name}
                </Text>
                <Group gap="xs">
                  <Badge color={TYPE_CONFIG[previewTemplate.type]?.color || 'gray'}>
                    {TYPE_CONFIG[previewTemplate.type]?.label || previewTemplate.type}
                  </Badge>
                  <Badge color={previewTemplate.isActive ? 'green' : 'gray'}>
                    {previewTemplate.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Group>
              </Group>

              {previewTemplate.subject && (
                <Stack gap="xs">
                  <Text size="sm" fw={500} c="dimmed">
                    Subject:
                  </Text>
                  <Text>{previewTemplate.subject}</Text>
                </Stack>
              )}

              <Stack gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  Body:
                </Text>
                <Paper withBorder p="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {previewTemplate.body}
                </Paper>
              </Stack>

              {previewTemplate.placeholders && previewTemplate.placeholders.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={500} c="dimmed">
                    Available Placeholders:
                  </Text>
                  <Group gap="xs">
                    {previewTemplate.placeholders.map(ph => (
                      <Badge key={ph} variant="outline">
                        {ph}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              )}

              <Group gap="md">
                <Text size="sm" c="dimmed">
                  Category: <strong>{previewTemplate.category}</strong>
                </Text>
                <Text size="sm" c="dimmed">
                  Created: <strong>{previewTemplate.createdAt ? new Date(previewTemplate.createdAt).toLocaleDateString() : '-'}</strong>
                </Text>
              </Group>

              {canManageTemplates && (
                <Button
                  fullWidth
                  variant="light"
                  leftSection={<IconEdit size={16} />}
                  onClick={() => {
                    setPreviewOpened(false);
                    navigate(`/communication-templates/${previewTemplate.id}/edit`);
                  }}
                >
                  Edit Template
                </Button>
              )}
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}
