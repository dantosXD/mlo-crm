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
  FileButton,
  Tooltip,
  Menu,
  Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconPower,
  IconPlayerPlay,
  IconHistory,
  IconPlus,
  IconCopy,
  IconDownload,
  IconUpload,
  IconDots,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import TestWorkflowModal from '../components/workflows/TestWorkflowModal';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isTemplate: boolean;
  triggerType: string;
  version: number;
  executionCount: number;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface WorkflowResponse {
  workflows: Workflow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type WorkflowModalState = {
  mode: 'test' | 'run';
  workflow: Workflow;
} | null;

// Trigger type labels
const TRIGGER_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Client Created',
  CLIENT_STATUS_CHANGED: 'Status Changed',
  DOCUMENT_UPLOADED: 'Document Uploaded',
  DOCUMENT_STATUS_CHANGED: 'Document Status Changed',
  TASK_DUE: 'Task Due',
  TASK_COMPLETED: 'Task Completed',
  MANUAL: 'Manual',
};

export function Workflows() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Workflow | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importAsTemplate, setImportAsTemplate] = useState(false);
  const [workflowModalState, setWorkflowModalState] = useState<WorkflowModalState>(null);

  const canManageWorkflows = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'MLO';

  // Debounce search 350ms
  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  // Auto-apply filters immediately on change
  useEffect(() => { setPage(1); }, [isActiveFilter, triggerTypeFilter]);

  const { data: workflowData, isLoading: loading } = useQuery({
    queryKey: ['workflows', page, isActiveFilter, triggerTypeFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (isActiveFilter !== 'all') params.append('is_active', isActiveFilter);
      if (triggerTypeFilter !== 'all') params.append('trigger_type', triggerTypeFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);
      const response = await api.get(`/workflows?${params}`);
      if (!response.ok) throw new Error('Failed to fetch workflows');
      return response.json() as Promise<WorkflowResponse>;
    },
  });

  const workflows = workflowData?.workflows ?? [];
  const pagination = workflowData?.pagination ?? { page: 1, limit, total: 0, totalPages: 0 };
  const hasActiveFilters = !!(search || isActiveFilter !== 'all' || triggerTypeFilter !== 'all');

  const clearAllFilters = () => { setSearch(''); setIsActiveFilter('all'); setTriggerTypeFilter('all'); setPage(1); };

  const handleToggleActive = (workflow: Workflow) => {
    if (!canManageWorkflows) return;
    setToggleConfirm(workflow);
  };

  const confirmToggle = async () => {
    if (!toggleConfirm) return;
    const { id, isActive, name } = toggleConfirm;
    setToggleConfirm(null);
    setToggling(id);
    try {
      const response = await api.patch(`/workflows/${id}/toggle`);
      if (!response.ok) throw new Error('Failed to toggle workflow');
      notifications.show({ title: 'Success', message: `"${name}" ${isActive ? 'disabled' : 'enabled'}`, color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to toggle workflow', color: 'red' });
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = (workflow: Workflow) => {
    if (user?.role !== 'ADMIN') {
      notifications.show({ title: 'Access Denied', message: 'Only admins can delete workflows', color: 'red' });
      return;
    }
    setDeleteConfirm(workflow);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    setDeleting(id);
    try {
      const response = await api.delete(`/workflows/${id}`);
      if (!response.ok) throw new Error('Failed to delete workflow');
      notifications.show({ title: 'Success', message: 'Workflow deleted successfully', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete workflow', color: 'red' });
    } finally {
      setDeleting(null);
    }
  };

  const handleClone = async (id: string, name: string) => {
    if (!canManageWorkflows) return;
    setCloning(id);
    try {
      const response = await api.post(`/workflows/${id}/clone`);
      if (!response.ok) throw new Error('Failed to clone workflow');
      const clonedWorkflow = await response.json();
      notifications.show({ title: 'Success', message: `"${name}" cloned`, color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate(`/workflows/${clonedWorkflow.id}/edit`);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to clone workflow', color: 'red' });
    } finally {
      setCloning(null);
    }
  };

  const openWorkflowModal = (workflow: Workflow, mode: 'test' | 'run') => {
    if (!canManageWorkflows) {
      notifications.show({
        title: 'Access Denied',
        message: 'You do not have permission to run or test workflows',
        color: 'red',
      });
      return;
    }

    setWorkflowModalState({ mode, workflow });
  };

  const handleViewExecutions = (id: string) => {
    navigate(`/workflows/executions?workflow_id=${id}`);
  };

  const handleExport = async (id: string, name: string) => {
    setExporting(id);
    try {
      const response = await api.get(`/workflows/${id}/export`);
      if (!response.ok) throw new Error('Failed to export workflow');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, '_')}_workflow.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notifications.show({ title: 'Success', message: `"${name}" exported`, color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to export workflow', color: 'red' });
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select a file to import',
        color: 'red',
      });
      return;
    }

    setImporting(true);
    try {
      // Read file
      const text = await importFile.text();
      const workflowData = JSON.parse(text);

      // Send to API
      const response = await api.post('/workflows/import', {
        workflowData,
        asTemplate: importAsTemplate,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import workflow');
      }

      const importedWorkflow = await response.json();

      notifications.show({
        title: 'Success',
        message: `Workflow "${importedWorkflow.name}" imported successfully`,
        color: 'green',
      });

      // Close modal and refresh
      setImportModalOpen(false);
      setImportFile(null);
      setImportAsTemplate(false);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    } catch (error) {
      console.error('Error importing workflow:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to import workflow',
        color: 'red',
      });
    } finally {
      setImporting(false);
    }
  };

  const rows = workflows.map((workflow) => (
    <Table.Tr key={workflow.id}>
      {/* Name — clickable link */}
      <Table.Td>
        <Stack gap={2}>
          <Anchor
            fw={500}
            href={`/workflows/${workflow.id}/edit`}
            underline="hover"
            data-testid={`workflow-name-${workflow.id}`}
          >
            {workflow.name}
          </Anchor>
          {workflow.description && (
            <Text size="xs" c="dimmed" lineClamp={1}>{workflow.description}</Text>
          )}
        </Stack>
      </Table.Td>

      {/* Trigger */}
      <Table.Td>
        <Badge color="blue" variant="light" size="sm">
          {TRIGGER_LABELS[workflow.triggerType] || workflow.triggerType}
        </Badge>
      </Table.Td>

      {/* Status — full text, no truncation */}
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Badge
          color={workflow.isActive ? 'green' : 'gray'}
          variant={workflow.isActive ? 'filled' : 'light'}
          size="sm"
          style={{ whiteSpace: 'nowrap', overflow: 'visible' }}
        >
          {workflow.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Table.Td>

      <Table.Td><Text size="sm">{workflow.executionCount}</Text></Table.Td>
      <Table.Td><Text size="sm">v{workflow.version}</Text></Table.Td>
      <Table.Td><Text size="sm">{workflow.createdBy.name}</Text></Table.Td>

      {/* Actions: 4 primary icons + overflow menu */}
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Tooltip label={workflow.isActive ? 'Disable workflow' : 'Enable workflow'} withArrow>
            <ActionIcon
              variant="subtle"
              color={workflow.isActive ? 'orange' : 'teal'}
              onClick={() => handleToggleActive(workflow)}
              loading={toggling === workflow.id}
              disabled={!canManageWorkflows}
              size="sm"
              aria-label={workflow.isActive ? `Disable workflow ${workflow.name}` : `Enable workflow ${workflow.name}`}
            >
              <IconPower size={15} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Edit" withArrow>
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
              disabled={!canManageWorkflows}
              size="sm"
              aria-label={`Edit workflow ${workflow.name}`}
            >
              <IconEdit size={15} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Dry-run test" withArrow>
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => openWorkflowModal(workflow, 'test')}
              disabled={!canManageWorkflows}
              size="sm"
              aria-label={`Test workflow ${workflow.name}`}
            >
              <IconSearch size={15} />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            label={!workflow.isActive ? 'Enable workflow first to run it' : 'Run with client'}
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="green"
              onClick={() => openWorkflowModal(workflow, 'run')}
              disabled={!canManageWorkflows || !workflow.isActive}
              size="sm"
              aria-label={`Run workflow ${workflow.name}`}
            >
              <IconPlayerPlay size={15} />
            </ActionIcon>
          </Tooltip>

          <Menu shadow="md" width={175} position="bottom-end" withArrow>
            <Menu.Target>
              <Tooltip label="More actions" withArrow>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`More actions for ${workflow.name}`}>
                  <IconDots size={15} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconHistory size={14} />} onClick={() => handleViewExecutions(workflow.id)}>
                View Executions
              </Menu.Item>
              <Menu.Item
                leftSection={<IconCopy size={14} />}
                onClick={() => handleClone(workflow.id, workflow.name)}
                disabled={cloning === workflow.id || !canManageWorkflows}
              >
                Clone
              </Menu.Item>
              <Menu.Item
                leftSection={<IconDownload size={14} />}
                onClick={() => handleExport(workflow.id, workflow.name)}
                disabled={exporting === workflow.id}
              >
                Export
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                onClick={() => handleDelete(workflow)}
                disabled={deleting === workflow.id || user?.role !== 'ADMIN'}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>Workflows</Title>
          <Group gap="sm">
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['workflows'] })}
              loading={loading}
            >
              Refresh
            </Button>
            {canManageWorkflows && (
              <>
                <Button
                  leftSection={<IconUpload size={16} />}
                  variant="light"
                  onClick={() => setImportModalOpen(true)}
                >
                  Import
                </Button>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate('/workflows/builder')}
                >
                  Create Workflow
                </Button>
              </>
            )}
          </Group>
        </Group>

        <Paper p="md" withBorder>
          <Group gap="sm" align="flex-end">
            <TextInput
              ref={searchInputRef}
              placeholder="Search workflows..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                search ? (
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setSearch('')} aria-label="Clear search">
                    <IconX size={14} />
                  </ActionIcon>
                ) : null
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setDebouncedSearch(search); setPage(1); } }}
              style={{ flex: 1 }}
              data-testid="workflow-search"
            />
            <Select
              label="Status"
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={isActiveFilter}
              onChange={(value) => setIsActiveFilter(value || 'all')}
              w={145}
              data-testid="workflow-status-filter"
            />
            <Select
              label="Trigger Type"
              data={[
                { value: 'all', label: 'All Types' },
                { value: 'CLIENT_CREATED', label: 'Client Created' },
                { value: 'CLIENT_STATUS_CHANGED', label: 'Status Changed' },
                { value: 'DOCUMENT_UPLOADED', label: 'Doc Uploaded' },
                { value: 'DOCUMENT_STATUS_CHANGED', label: 'Doc Status Changed' },
                { value: 'TASK_DUE', label: 'Task Due' },
                { value: 'TASK_COMPLETED', label: 'Task Completed' },
                { value: 'MANUAL', label: 'Manual' },
              ]}
              value={triggerTypeFilter}
              onChange={(value) => setTriggerTypeFilter(value || 'all')}
              w={175}
              data-testid="workflow-trigger-filter"
            />
            {hasActiveFilters && (
              <Button variant="subtle" color="gray" size="sm" onClick={clearAllFilters}>
                Clear filters
              </Button>
            )}
          </Group>
        </Paper>

        <Paper p="md" withBorder>
          <LoadingOverlay visible={loading} />
          <Box pos="relative">
            {workflows.length === 0 && !loading ? (
              <Text c="dimmed" ta="center" py="xl">
                {hasActiveFilters
                  ? 'No workflows match your search or filters. Try clearing them.'
                  : 'No workflows found. Create your first workflow to get started.'}
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={900}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Trigger</Table.Th>
                    <Table.Th style={{ whiteSpace: 'nowrap', width: 90 }}>Status</Table.Th>
                    <Table.Th>Executions</Table.Th>
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Created By</Table.Th>
                    <Table.Th style={{ whiteSpace: 'nowrap', width: 160 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            )}
          </Box>
        </Paper>

        <Group justify="space-between" align="center" mt="xs">
          <Text size="sm" c="dimmed">
            Showing {workflows.length} of {pagination.total} workflow{pagination.total !== 1 ? 's' : ''}
          </Text>
          {pagination.totalPages > 1 && (
            <Pagination
              total={pagination.totalPages}
              value={pagination.page}
              onChange={(p) => setPage(p)}
            />
          )}
        </Group>
      </Stack>

      {/* Toggle Confirmation Modal */}
      <Modal opened={!!toggleConfirm} onClose={() => setToggleConfirm(null)} title={toggleConfirm?.isActive ? 'Disable Workflow?' : 'Enable Workflow?'} size="sm">
        <Stack gap="md">
          <Text size="sm">
            {toggleConfirm?.isActive
              ? `"${toggleConfirm?.name}" will stop running automatically. Scheduled executions will not fire.`
              : `"${toggleConfirm?.name}" will become active and may begin executing automatically.`}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => setToggleConfirm(null)}>Cancel</Button>
            <Button color={toggleConfirm?.isActive ? 'orange' : 'teal'} onClick={confirmToggle}>
              {toggleConfirm?.isActive ? 'Disable' : 'Enable'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal opened={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Workflow?" size="sm">
        <Stack gap="md">
          <Text size="sm">
            Permanently delete <Text span fw={600}>"{deleteConfirm?.name}"</Text>? This cannot be undone and will also remove all associated execution history.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button color="red" onClick={confirmDelete} loading={!!deleting}>Delete</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Import Workflow Modal */}
      <Modal
        opened={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Workflow"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Select a workflow JSON file to import. The file should be exported from this system.
          </Text>

          <FileButton
            onChange={setImportFile}
            accept="application/json"
          >
            {(props) => (
              <Button {...props}>
                {importFile ? importFile.name : 'Select JSON File'}
              </Button>
            )}
          </FileButton>

          <Checkbox
            label="Import as Template (inactive)"
            description="If checked, the workflow will be imported as a template and will be inactive"
            checked={importAsTemplate}
            onChange={(event) => setImportAsTemplate(event.currentTarget.checked)}
          />

          {importFile && (
            <Text size="sm" c="dimmed">
              Selected: <Text span fw={500}>{importFile.name}</Text>
            </Text>
          )}

          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => {
                setImportModalOpen(false);
                setImportFile(null);
                setImportAsTemplate(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile}
              loading={importing}
            >
              Import Workflow
            </Button>
          </Group>
        </Stack>
      </Modal>

      {workflowModalState && (
        <TestWorkflowModal
          opened
          onClose={() => setWorkflowModalState(null)}
          workflowId={workflowModalState.workflow.id}
          workflowName={workflowModalState.workflow.name}
          triggerType={workflowModalState.workflow.triggerType}
          mode={workflowModalState.mode}
          isActive={workflowModalState.workflow.isActive}
          onExecutionCreated={(executionId) => {
            queryClient.invalidateQueries({ queryKey: ['workflows'] });
            queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
            setWorkflowModalState(null);
            navigate(
              `/workflows?tab=executions&workflow_id=${workflowModalState.workflow.id}&execution_id=${executionId}`
            );
          }}
        />
      )}
    </Container>
  );
}
