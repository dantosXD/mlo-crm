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
  Checkbox,
  FileButton,
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
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

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
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importAsTemplate, setImportAsTemplate] = useState(false);

  const canManageWorkflows = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'MLO';

  const { data: workflowData, isLoading: loading } = useQuery({
    queryKey: ['workflows', page, isActiveFilter, triggerTypeFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (isActiveFilter !== 'all') params.append('is_active', isActiveFilter);
      if (triggerTypeFilter !== 'all') params.append('trigger_type', triggerTypeFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await api.get(`/workflows?${params}`);
      if (!response.ok) throw new Error('Failed to fetch workflows');
      return response.json() as Promise<WorkflowResponse>;
    },
  });

  const workflows = workflowData?.workflows ?? [];
  const pagination = workflowData?.pagination ?? { page: 1, limit, total: 0, totalPages: 0 };

  const handleSearch = () => {
    setPage(1);
    setSearchTerm(search);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!canManageWorkflows) {
      notifications.show({
        title: 'Access Denied',
        message: 'You do not have permission to manage workflows',
        color: 'red',
      });
      return;
    }

    setToggling(id);
    try {
      const response = await api.patch(`/workflows/${id}/toggle`);

      if (!response.ok) {
        throw new Error('Failed to toggle workflow');
      }

      notifications.show({
        title: 'Success',
        message: `Workflow ${currentStatus ? 'disabled' : 'enabled'}`,
        color: 'green',
      });

      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    } catch (error) {
      console.error('Error toggling workflow:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to toggle workflow',
        color: 'red',
      });
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (user?.role !== 'ADMIN') {
      notifications.show({
        title: 'Access Denied',
        message: 'Only admins can delete workflows',
        color: 'red',
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(id);
    try {
      const response = await api.delete(`/workflows/${id}`);

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      notifications.show({
        title: 'Success',
        message: 'Workflow deleted successfully',
        color: 'green',
      });

      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    } catch (error) {
      console.error('Error deleting workflow:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete workflow',
        color: 'red',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleClone = async (id: string, name: string) => {
    if (!canManageWorkflows) {
      notifications.show({
        title: 'Access Denied',
        message: 'You do not have permission to clone workflows',
        color: 'red',
      });
      return;
    }

    setCloning(id);
    try {
      const response = await api.post(`/workflows/${id}/clone`);

      if (!response.ok) {
        throw new Error('Failed to clone workflow');
      }

      const clonedWorkflow = await response.json();

      notifications.show({
        title: 'Success',
        message: `Workflow "${name}" cloned successfully`,
        color: 'green',
      });

      queryClient.invalidateQueries({ queryKey: ['workflows'] });

      // Navigate to edit the cloned workflow
      navigate(`/workflows/${clonedWorkflow.id}/edit`);
    } catch (error) {
      console.error('Error cloning workflow:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to clone workflow',
        color: 'red',
      });
    } finally {
      setCloning(null);
    }
  };

  const handleRun = async (id: string) => {
    if (!canManageWorkflows) {
      notifications.show({
        title: 'Access Denied',
        message: 'You do not have permission to run workflows',
        color: 'red',
      });
      return;
    }

    try {
      const response = await api.post(`/workflows/${id}/execute`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to execute workflow');
      }

      notifications.show({
        title: 'Workflow Executed',
        message: data.message || 'Workflow execution started',
        color: 'green',
      });
    } catch (error: any) {
      console.error('Error executing workflow:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to execute workflow',
        color: 'red',
      });
    }
  };

  const handleViewExecutions = (id: string) => {
    navigate(`/workflows/executions?workflow_id=${id}`);
  };

  const handleExport = async (id: string, name: string) => {
    setExporting(id);
    try {
      const response = await api.get(`/workflows/${id}/export`);

      if (!response.ok) {
        throw new Error('Failed to export workflow');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, '_')}_workflow.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notifications.show({
        title: 'Success',
        message: `Workflow "${name}" exported successfully`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error exporting workflow:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to export workflow',
        color: 'red',
      });
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
      <Table.Td>
        <Stack gap={0}>
          <Text fw={500}>{workflow.name}</Text>
          {workflow.description && (
            <Text size="sm" c="dimmed">
              {workflow.description}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <Badge color="blue" variant="light">
          {TRIGGER_LABELS[workflow.triggerType] || workflow.triggerType}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Badge
          color={workflow.isActive ? 'green' : 'gray'}
          variant="light"
        >
          {workflow.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{workflow.executionCount}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{workflow.version}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{workflow.createdBy.name}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color={workflow.isActive ? 'orange' : 'green'}
            onClick={() => handleToggleActive(workflow.id, workflow.isActive)}
            disabled={toggling === workflow.id || !canManageWorkflows}
            title={workflow.isActive ? 'Disable' : 'Enable'}
          >
            <IconPower size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
            disabled={!canManageWorkflows}
            title="Edit"
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="cyan"
            onClick={() => handleClone(workflow.id, workflow.name)}
            disabled={cloning === workflow.id || !canManageWorkflows}
            title="Clone"
            loading={cloning === workflow.id}
          >
            <IconCopy size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="green"
            onClick={() => handleRun(workflow.id)}
            title="Run Now"
            disabled={!canManageWorkflows}
          >
            <IconPlayerPlay size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="grape"
            onClick={() => handleViewExecutions(workflow.id)}
            title="View Executions"
          >
            <IconHistory size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="violet"
            onClick={() => handleExport(workflow.id, workflow.name)}
            disabled={exporting === workflow.id}
            title="Export"
            loading={exporting === workflow.id}
          >
            <IconDownload size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDelete(workflow.id, workflow.name)}
            disabled={deleting === workflow.id || user?.role !== 'ADMIN'}
            title="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
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
          <Group gap="sm">
            <TextInput
              placeholder="Search workflows..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Status"
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={isActiveFilter}
              onChange={(value) => setIsActiveFilter(value || 'all')}
              width={150}
            />
            <Select
              placeholder="Trigger Type"
              data={[
                { value: 'all', label: 'All Types' },
                { value: 'CLIENT_CREATED', label: 'Client Created' },
                { value: 'CLIENT_STATUS_CHANGED', label: 'Status Changed' },
                { value: 'DOCUMENT_UPLOADED', label: 'Document Uploaded' },
                { value: 'DOCUMENT_STATUS_CHANGED', label: 'Document Status Changed' },
                { value: 'TASK_DUE', label: 'Task Due' },
                { value: 'TASK_COMPLETED', label: 'Task Completed' },
                { value: 'MANUAL', label: 'Manual' },
              ]}
              value={triggerTypeFilter}
              onChange={(value) => setTriggerTypeFilter(value || 'all')}
              width={200}
            />
            <Button onClick={handleSearch}>Search</Button>
          </Group>
        </Paper>

        <Paper p="md" withBorder>
          <LoadingOverlay visible={loading} />
          <Box pos="relative">
            {workflows.length === 0 && !loading ? (
              <Text c="dimmed" ta="center" py="xl">
                No workflows found. Create your first workflow to get started.
              </Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Trigger</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Executions</Table.Th>
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Created By</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            )}
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

        <Text size="sm" c="dimmed" ta="center">
          Showing {workflows.length} of {pagination.total} workflows
        </Text>
      </Stack>

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
    </Container>
  );
}
