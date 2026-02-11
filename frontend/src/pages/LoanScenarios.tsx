import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Paper,
  Group,
  Stack,
  Text,
  Button,
  TextInput,
  Select,
  NativeSelect,
  Badge,
  Card,
  ActionIcon,
  Tooltip,
  Modal,
  Loader,
  Center,
  Alert,
  Menu,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconTrash,
  IconEdit,
  IconDotsVertical,
  IconCopy,
  IconStarFilled,
  IconScale,
  IconAlertCircle,
} from '@tabler/icons-react';
import api from '../utils/api';
import type { LoanScenarioEntity, LoanScenarioData, LoanProgramTemplate } from '../utils/loanTypes';
import { createDefaultScenarioData } from '../utils/loanTypes';
import { LoanScenarioBuilder } from '../components/LoanScenarioBuilder';

// ── Helpers ──────────────────────────────────────────────────────────────

function parseScenarioData(entity: LoanScenarioEntity): LoanScenarioData | null {
  if (!entity.scenarioData) return null;
  try {
    return typeof entity.scenarioData === 'string'
      ? JSON.parse(entity.scenarioData)
      : entity.scenarioData;
  } catch {
    return null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'gray',
  PROPOSED: 'blue',
  SHARED: 'green',
  ARCHIVED: 'dimmed',
};

// ── Main Component ───────────────────────────────────────────────────────

export default function LoanScenarios() {
  const [scenarios, setScenarios] = useState<LoanScenarioEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [programTemplates, setProgramTemplates] = useState<LoanProgramTemplate[]>([]);

  // Builder modal state
  const [builderOpened, { open: openBuilder, close: closeBuilder }] = useDisclosure(false);
  const [editingScenario, setEditingScenario] = useState<LoanScenarioEntity | null>(null);
  const [builderData, setBuilderData] = useState<LoanScenarioData>(createDefaultScenarioData());
  const [builderName, setBuilderName] = useState('');
  const [builderClientId, setBuilderClientId] = useState<string | null>(null);
  const [builderPreferred, setBuilderPreferred] = useState<string | null>(null);
  const [builderNotes, setBuilderNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<LoanScenarioEntity | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch Data ─────────────────────────────────────────────────────────

  const fetchScenarios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/loan-scenarios');
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
      } else {
        setError('Failed to fetch loan scenarios');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/clients');
      if (res.ok) {
        const data = await res.json();
        const clientList = (data.clients || data || []).map((c: any) => ({
          id: c.id,
          name: c.name || c.nameEncrypted || 'Unknown',
        }));
        setClients(clientList);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchProgramTemplates = useCallback(async () => {
    try {
      const res = await api.get('/loan-program-templates/active');
      if (res.ok) {
        const data = await res.json();
        setProgramTemplates(data);
      }
    } catch {
      // Non-critical — will fall back to hardcoded defaults
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
    fetchClients();
    fetchProgramTemplates();
  }, [fetchScenarios, fetchClients, fetchProgramTemplates]);

  // ── Builder Actions ────────────────────────────────────────────────────

  const handleNewScenario = useCallback(() => {
    setEditingScenario(null);
    setBuilderData(createDefaultScenarioData(programTemplates.length > 0 ? programTemplates : undefined));
    setBuilderName('New Loan Comparison');
    setBuilderClientId(null);
    setBuilderPreferred(null);
    setBuilderNotes('');
    openBuilder();
  }, [openBuilder, programTemplates]);

  const handleEditScenario = useCallback(
    (scenario: LoanScenarioEntity) => {
      setEditingScenario(scenario);
      const data = parseScenarioData(scenario);
      setBuilderData(data || createDefaultScenarioData());
      setBuilderName(scenario.name);
      setBuilderClientId(scenario.clientId);
      setBuilderPreferred(scenario.preferredProgramId);
      setBuilderNotes(scenario.recommendationNotes || '');
      openBuilder();
    },
    [openBuilder],
  );

  const handleDuplicate = useCallback(
    async (scenario: LoanScenarioEntity) => {
      try {
        const data = parseScenarioData(scenario);
        const body: any = {
          clientId: scenario.clientId,
          name: `${scenario.name} (copy)`,
          loanType: scenario.loanType,
          amount: scenario.amount,
          interestRate: scenario.interestRate,
          termYears: scenario.termYears,
          scenarioData: data,
          status: 'DRAFT',
        };
        const res = await api.post('/loan-scenarios', body);
        if (res.ok) {
          fetchScenarios();
        }
      } catch {
        // ignore
      }
    },
    [fetchScenarios],
  );

  const handleDeleteRequest = useCallback((scenario: LoanScenarioEntity) => {
    setScenarioToDelete(scenario);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!scenarioToDelete) {
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await api.delete(`/loan-scenarios/${scenarioToDelete.id}`);
      if (!res.ok) {
        throw new Error('Failed to delete loan scenario');
      }

      setScenarioToDelete(null);
      await fetchScenarios();
      notifications.show({
        title: 'Success',
        message: 'Loan scenario deleted successfully',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete loan scenario',
        color: 'red',
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [fetchScenarios, scenarioToDelete]);

  const handleSave = useCallback(async () => {
    if (!builderClientId) return;
    setSaving(true);
    try {
      const body: any = {
        clientId: builderClientId,
        name: builderName,
        loanType: builderData.inputs.scenarioType === 'purchase' ? 'PURCHASE' : 'REFINANCE',
        amount: builderData.inputs.purchasePrice
          ? (builderData.inputs.purchasePrice - (builderData.inputs.downPayment ?? 0))
          : (builderData.inputs.refinanceLoanAmount ?? 0),
        interestRate: builderData.programs[0]?.ratePercent ?? 0,
        termYears: builderData.programs[0]?.termYears ?? 30,
        scenarioData: builderData,
        preferredProgramId: builderPreferred,
        recommendationNotes: builderNotes || null,
        status: editingScenario?.status || 'DRAFT',
      };

      let res: Response;
      if (editingScenario) {
        res = await api.put(`/loan-scenarios/${editingScenario.id}`, body);
      } else {
        res = await api.post('/loan-scenarios', body);
      }

      if (res.ok) {
        closeBuilder();
        fetchScenarios();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [builderClientId, builderName, builderData, builderPreferred, builderNotes, editingScenario, closeBuilder, fetchScenarios]);

  // ── Filters ────────────────────────────────────────────────────────────

  const filtered = scenarios.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ThemeIcon size="xl" variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }} radius="md">
            <IconScale size={28} />
          </ThemeIcon>
          <div>
            <Title order={2}>Loan Scenarios</Title>
            <Text size="sm" c="dimmed">Compare loan programs and build recommendations for clients</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={18} />} onClick={handleNewScenario}>
          New Comparison
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper p="sm" mb="md" withBorder radius="md">
        <Group>
          <TextInput
            placeholder="Search scenarios..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PROPOSED', label: 'Proposed' },
              { value: 'SHARED', label: 'Shared' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
            clearable
            w={150}
          />
        </Group>
      </Paper>

      {/* Scenario Cards */}
      {filtered.length === 0 ? (
        <Paper p="xl" withBorder radius="md" ta="center">
          <Stack align="center" gap="sm">
            <IconScale size={48} color="var(--mantine-color-gray-4)" />
            <Text size="lg" fw={500} c="dimmed">No loan scenarios yet</Text>
            <Text size="sm" c="dimmed">
              Create a comparison to start analyzing loan programs for your clients.
            </Text>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNewScenario} mt="sm">
              Create First Comparison
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="sm">
          {filtered.map((scenario) => {
            const scenarioData = parseScenarioData(scenario);
            const programCount = scenarioData?.programs.length ?? 0;
            const clientName = clients.find((c) => c.id === scenario.clientId)?.name;

            return (
              <Card key={scenario.id} withBorder radius="md" padding="md">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap">
                      {scenario.preferredProgramId && (
                        <IconStarFilled size={16} color="var(--mantine-color-yellow-5)" />
                      )}
                      <Text fw={600} truncate>{scenario.name}</Text>
                      <Badge size="sm" color={STATUS_COLORS[scenario.status] || 'gray'} variant="light">
                        {scenario.status}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      {clientName && (
                        <Text size="xs" c="dimmed">Client: {clientName}</Text>
                      )}
                      {programCount > 0 && (
                        <Badge size="xs" variant="dot">{programCount} programs</Badge>
                      )}
                      <Text size="xs" c="dimmed">
                        {new Date(scenario.updatedAt).toLocaleDateString()}
                      </Text>
                    </Group>
                  </Stack>

                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="Edit">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleEditScenario(scenario)}
                        aria-label="Edit scenario"
                      >
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Menu shadow="md" width={160} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" aria-label="Scenario actions">
                          <IconDotsVertical size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => handleDuplicate(scenario)}>
                          Duplicate
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => handleDeleteRequest(scenario)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Builder Modal */}
      <Modal
        opened={builderOpened}
        onClose={closeBuilder}
        title={
          <Group gap="xs">
            <IconScale size={20} />
            <Text fw={600}>{editingScenario ? 'Edit' : 'New'} Loan Comparison</Text>
          </Group>
        }
        size="95%"
        centered
        styles={{ body: { padding: 'var(--mantine-spacing-md)', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' } }}
      >
        <div>
          {/* Header controls */}
          <Paper p="md" mb="md" withBorder radius="md">
            <Group>
              <TextInput
                label="Scenario Name"
                value={builderName}
                onChange={(e) => setBuilderName(e.currentTarget.value)}
                style={{ flex: 1 }}
                required
              />
              <NativeSelect
                label="Client"
                value={builderClientId ?? ''}
                onChange={(e) => setBuilderClientId(e.currentTarget.value || null)}
                data={[
                  { value: '', label: 'Select client...' },
                  ...clients.map((c) => ({ value: c.id, label: c.name })),
                ]}
                required
                w={300}
              />
            </Group>
          </Paper>

          {/* Builder */}
          <LoanScenarioBuilder
            data={builderData}
            onChange={setBuilderData}
            preferredProgramId={builderPreferred}
            onPreferredChange={setBuilderPreferred}
            recommendationNotes={builderNotes}
            onRecommendationNotesChange={setBuilderNotes}
          />

          {/* Save bar */}
          <Paper p="md" mt="md" withBorder radius="md">
            <Group justify="flex-end">
              <Button variant="subtle" onClick={closeBuilder}>Cancel</Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={!builderClientId || !builderName.trim()}
              >
                {editingScenario ? 'Save Changes' : 'Create Comparison'}
              </Button>
            </Group>
          </Paper>
        </div>
      </Modal>

      <Modal
        opened={!!scenarioToDelete}
        onClose={() => setScenarioToDelete(null)}
        title="Delete Loan Scenario"
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to delete the scenario <strong>{scenarioToDelete?.name}</strong>? This action cannot
            be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setScenarioToDelete(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={() => void handleConfirmDelete()} loading={deleteLoading}>
              Delete Scenario
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
