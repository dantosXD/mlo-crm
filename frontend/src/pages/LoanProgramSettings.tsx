import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Button,
  TextInput,
  NumberInput,
  NativeSelect,
  Switch,
  ActionIcon,
  Tooltip,
  Badge,
  Card,
  Modal,
  Loader,
  Center,
  Alert,
  Divider,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconAlertCircle,
  IconSettings,
  IconArrowUp,
  IconArrowDown,
  IconCopy,
  IconSparkles,
} from '@tabler/icons-react';
import api from '../utils/api';
import type { LoanProgramTemplate, ARMConfig } from '../utils/loanTypes';
import { parseARMConfig, formatARMDescription } from '../utils/loanTypes';

// ── Default seed programs matching user's offerings ────────────────────
const DEFAULT_SEED_PROGRAMS = [
  // Fixed programs
  { name: 'Conventional 15yr Fixed', category: 'FIXED', termYears: 15, loanType: 'conventional', defaultRate: 6.25 },
  { name: 'Conventional 20yr Fixed', category: 'FIXED', termYears: 20, loanType: 'conventional', defaultRate: 6.50 },
  { name: 'Conventional 30yr Fixed', category: 'FIXED', termYears: 30, loanType: 'conventional', defaultRate: 6.75 },
  { name: 'FHA 15yr Fixed', category: 'FIXED', termYears: 15, loanType: 'fha', defaultRate: 6.00 },
  { name: 'FHA 20yr Fixed', category: 'FIXED', termYears: 20, loanType: 'fha', defaultRate: 6.25 },
  { name: 'FHA 30yr Fixed', category: 'FIXED', termYears: 30, loanType: 'fha', defaultRate: 6.50 },
  { name: 'VA 15yr Fixed', category: 'FIXED', termYears: 15, loanType: 'va', defaultRate: 5.75 },
  { name: 'VA 20yr Fixed', category: 'FIXED', termYears: 20, loanType: 'va', defaultRate: 6.00 },
  { name: 'VA 30yr Fixed', category: 'FIXED', termYears: 30, loanType: 'va', defaultRate: 6.25 },
  // ARM programs — 2-2-5 caps
  { name: '3/1 ARM 15yr', category: 'ARM', termYears: 15, loanType: 'conventional', defaultRate: 5.75, armConfig: { initialPeriod: 3, adjustmentPeriod: 1, initialCap: 2, periodicCap: 2, lifetimeCap: 5 } },
  { name: '3/1 ARM 30yr', category: 'ARM', termYears: 30, loanType: 'conventional', defaultRate: 5.75, armConfig: { initialPeriod: 3, adjustmentPeriod: 1, initialCap: 2, periodicCap: 2, lifetimeCap: 5 } },
  { name: '5/1 ARM 15yr', category: 'ARM', termYears: 15, loanType: 'conventional', defaultRate: 6.00, armConfig: { initialPeriod: 5, adjustmentPeriod: 1, initialCap: 2, periodicCap: 2, lifetimeCap: 5 } },
  { name: '5/1 ARM 30yr', category: 'ARM', termYears: 30, loanType: 'conventional', defaultRate: 6.00, armConfig: { initialPeriod: 5, adjustmentPeriod: 1, initialCap: 2, periodicCap: 2, lifetimeCap: 5 } },
  { name: '7/1 ARM 15yr', category: 'ARM', termYears: 15, loanType: 'conventional', defaultRate: 6.25, armConfig: { initialPeriod: 7, adjustmentPeriod: 1, initialCap: 2, periodicCap: 2, lifetimeCap: 5 } },
  { name: '7/1 ARM 30yr', category: 'ARM', termYears: 30, loanType: 'conventional', defaultRate: 6.25, armConfig: { initialPeriod: 7, adjustmentPeriod: 1, initialCap: 2, periodicCap: 2, lifetimeCap: 5 } },
];

// ── Form state ─────────────────────────────────────────────────────────
interface ProgramForm {
  name: string;
  category: string;
  termYears: number;
  defaultRate: number | null;
  loanType: string;
  isActive: boolean;
  notes: string;
  // ARM fields
  armInitialPeriod: number;
  armAdjustmentPeriod: number;
  armInitialCap: number;
  armPeriodicCap: number;
  armLifetimeCap: number;
  armIndexName: string;
  armMargin: number | null;
}

const emptyForm: ProgramForm = {
  name: '',
  category: 'FIXED',
  termYears: 30,
  defaultRate: null,
  loanType: 'conventional',
  isActive: true,
  notes: '',
  armInitialPeriod: 5,
  armAdjustmentPeriod: 1,
  armInitialCap: 2,
  armPeriodicCap: 2,
  armLifetimeCap: 5,
  armIndexName: 'SOFR',
  armMargin: null,
};

function templateToForm(t: LoanProgramTemplate): ProgramForm {
  const arm = parseARMConfig(t.armConfig);
  return {
    name: t.name,
    category: t.category,
    termYears: t.termYears,
    defaultRate: t.defaultRate,
    loanType: t.loanType,
    isActive: t.isActive,
    notes: t.notes || '',
    armInitialPeriod: arm?.initialPeriod ?? 5,
    armAdjustmentPeriod: arm?.adjustmentPeriod ?? 1,
    armInitialCap: arm?.initialCap ?? 2,
    armPeriodicCap: arm?.periodicCap ?? 2,
    armLifetimeCap: arm?.lifetimeCap ?? 5,
    armIndexName: arm?.indexName ?? 'SOFR',
    armMargin: arm?.margin ?? null,
  };
}

function formToPayload(form: ProgramForm) {
  const armConfig: ARMConfig | null = form.category === 'ARM' ? {
    initialPeriod: form.armInitialPeriod,
    adjustmentPeriod: form.armAdjustmentPeriod,
    initialCap: form.armInitialCap,
    periodicCap: form.armPeriodicCap,
    lifetimeCap: form.armLifetimeCap,
    indexName: form.armIndexName || undefined,
    margin: form.armMargin ?? undefined,
  } : null;

  return {
    name: form.name,
    category: form.category,
    termYears: form.termYears,
    defaultRate: form.defaultRate,
    loanType: form.loanType,
    isActive: form.isActive,
    notes: form.notes || null,
    armConfig,
  };
}

// ── Component ──────────────────────────────────────────────────────────
export default function LoanProgramSettings() {
  const [templates, setTemplates] = useState<LoanProgramTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramForm>({ ...emptyForm });

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/loan-program-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        setError(null);
      } else {
        setError('Failed to load programs');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Seed defaults ────────────────────────────────────────────────────
  const seedDefaults = async () => {
    setSaving(true);
    try {
      const res = await api.post('/loan-program-templates/bulk', { templates: DEFAULT_SEED_PROGRAMS });
      if (res.ok) {
        await fetchTemplates();
      }
    } catch {
      setError('Failed to seed default programs');
    } finally {
      setSaving(false);
    }
  };

  // ── Create / Update ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = formToPayload(form);
      let res;
      if (editingId) {
        res = await api.put(`/loan-program-templates/${editingId}`, payload);
      } else {
        res = await api.post('/loan-program-templates', payload);
      }
      if (res.ok) {
        closeModal();
        setEditingId(null);
        setForm({ ...emptyForm });
        await fetchTemplates();
      }
    } catch {
      setError('Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const res = await api.delete(`/loan-program-templates/${id}`);
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id));
      }
    } catch {
      setError('Failed to delete program');
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────
  const handleToggleActive = async (t: LoanProgramTemplate) => {
    try {
      const res = await api.put(`/loan-program-templates/${t.id}`, { isActive: !t.isActive });
      if (res.ok) {
        setTemplates(prev => prev.map(p => p.id === t.id ? { ...p, isActive: !p.isActive } : p));
      }
    } catch {
      // Ignore
    }
  };

  // ── Reorder ──────────────────────────────────────────────────────────
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newTemplates = [...templates];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newTemplates.length) return;

    [newTemplates[index], newTemplates[swapIndex]] = [newTemplates[swapIndex], newTemplates[index]];
    setTemplates(newTemplates);

    const order = newTemplates.map((t, i) => ({ id: t.id, sortOrder: i }));
    try {
      await api.put('/loan-program-templates/reorder/batch', { order });
    } catch {
      // Revert on failure
      await fetchTemplates();
    }
  };

  // ── Duplicate ────────────────────────────────────────────────────────
  const handleDuplicate = (t: LoanProgramTemplate) => {
    const f = templateToForm(t);
    f.name = `${f.name} (Copy)`;
    setEditingId(null);
    setForm(f);
    openModal();
  };

  // ── Open edit ────────────────────────────────────────────────────────
  const handleEdit = (t: LoanProgramTemplate) => {
    setEditingId(t.id);
    setForm(templateToForm(t));
    openModal();
  };

  // ── Open create ──────────────────────────────────────────────────────
  const handleCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    openModal();
  };

  // ── Helpers ──────────────────────────────────────────────────────────
  const updateForm = (updates: Partial<ProgramForm>) => setForm(prev => ({ ...prev, ...updates }));

  const fixedTemplates = templates.filter(t => t.category === 'FIXED');
  const armTemplates = templates.filter(t => t.category === 'ARM');

  const loanTypeColor: Record<string, string> = {
    conventional: 'blue',
    fha: 'orange',
    va: 'green',
    usda: 'teal',
    jumbo: 'grape',
    portfolio: 'gray',
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Center py={60}><Loader size="lg" /></Center>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>
            <Group gap="xs">
              <IconSettings size={24} />
              Loan Programs
            </Group>
          </Title>
          <Text c="dimmed" size="sm">
            Configure the loan programs available in your scenario builder
          </Text>
        </div>
        <Group>
          {templates.length === 0 && (
            <Tooltip label="Seed with your standard Fixed + ARM programs">
              <Button
                leftSection={<IconSparkles size={16} />}
                variant="light"
                color="violet"
                onClick={seedDefaults}
                loading={saving}
              >
                Load Defaults
              </Button>
            </Tooltip>
          )}
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
            Add Program
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle />} color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {templates.length === 0 && !loading && (
        <Paper p="xl" withBorder ta="center">
          <Stack align="center" gap="sm">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconSettings size={24} />
            </ThemeIcon>
            <Text fw={500}>No loan programs configured</Text>
            <Text c="dimmed" size="sm">
              Click "Load Defaults" to set up your standard Fixed and ARM programs, or add programs manually.
            </Text>
          </Stack>
        </Paper>
      )}

      {/* Fixed Rate Programs */}
      {fixedTemplates.length > 0 && (
        <>
          <Group mb="xs" mt="md">
            <Badge size="lg" variant="light" color="blue">Fixed Rate</Badge>
            <Text c="dimmed" size="sm">{fixedTemplates.length} programs</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {fixedTemplates.map((t) => {
              const globalIdx = templates.indexOf(t);
              return (
                <Card key={t.id} withBorder padding="sm" radius="md" opacity={t.isActive ? 1 : 0.5}>
                  <Group justify="space-between" mb={4}>
                    <Group gap={6}>
                      <Text fw={600} size="sm" lineClamp={1}>{t.name}</Text>
                      <Badge size="xs" color={loanTypeColor[t.loanType] || 'gray'} variant="light">
                        {t.loanType.toUpperCase()}
                      </Badge>
                    </Group>
                    <Switch
                      size="xs"
                      checked={t.isActive}
                      onChange={() => handleToggleActive(t)}
                      label={t.isActive ? 'Active' : 'Off'}
                    />
                  </Group>
                  <Group gap={4} mb="xs">
                    <Badge size="xs" variant="outline">{t.termYears}yr</Badge>
                    {t.defaultRate && <Badge size="xs" variant="outline" color="teal">{t.defaultRate}%</Badge>}
                  </Group>
                  <Group gap={4}>
                    <Tooltip label="Edit"><ActionIcon variant="subtle" size="sm" onClick={() => handleEdit(t)}><IconEdit size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Duplicate"><ActionIcon variant="subtle" size="sm" onClick={() => handleDuplicate(t)}><IconCopy size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Move up"><ActionIcon variant="subtle" size="sm" onClick={() => handleMove(globalIdx, 'up')} disabled={globalIdx === 0}><IconArrowUp size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Move down"><ActionIcon variant="subtle" size="sm" onClick={() => handleMove(globalIdx, 'down')} disabled={globalIdx === templates.length - 1}><IconArrowDown size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Delete"><ActionIcon variant="subtle" size="sm" color="red" onClick={() => handleDelete(t.id)}><IconTrash size={14} /></ActionIcon></Tooltip>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </>
      )}

      {/* ARM Programs */}
      {armTemplates.length > 0 && (
        <>
          <Group mb="xs" mt="lg">
            <Badge size="lg" variant="light" color="orange">Adjustable Rate (ARM)</Badge>
            <Text c="dimmed" size="sm">{armTemplates.length} programs</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {armTemplates.map((t) => {
              const globalIdx = templates.indexOf(t);
              const armCfg = parseARMConfig(t.armConfig);
              return (
                <Card key={t.id} withBorder padding="sm" radius="md" opacity={t.isActive ? 1 : 0.5}>
                  <Group justify="space-between" mb={4}>
                    <Group gap={6}>
                      <Text fw={600} size="sm" lineClamp={1}>{t.name}</Text>
                      <Badge size="xs" color={loanTypeColor[t.loanType] || 'gray'} variant="light">
                        {t.loanType.toUpperCase()}
                      </Badge>
                    </Group>
                    <Switch
                      size="xs"
                      checked={t.isActive}
                      onChange={() => handleToggleActive(t)}
                      label={t.isActive ? 'Active' : 'Off'}
                    />
                  </Group>
                  <Group gap={4} mb="xs">
                    <Badge size="xs" variant="outline">{t.termYears}yr</Badge>
                    {t.defaultRate && <Badge size="xs" variant="outline" color="teal">{t.defaultRate}%</Badge>}
                    {armCfg && <Badge size="xs" variant="outline" color="orange">{formatARMDescription(armCfg)}</Badge>}
                  </Group>
                  <Group gap={4}>
                    <Tooltip label="Edit"><ActionIcon variant="subtle" size="sm" onClick={() => handleEdit(t)}><IconEdit size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Duplicate"><ActionIcon variant="subtle" size="sm" onClick={() => handleDuplicate(t)}><IconCopy size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Move up"><ActionIcon variant="subtle" size="sm" onClick={() => handleMove(globalIdx, 'up')} disabled={globalIdx === 0}><IconArrowUp size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Move down"><ActionIcon variant="subtle" size="sm" onClick={() => handleMove(globalIdx, 'down')} disabled={globalIdx === templates.length - 1}><IconArrowDown size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Delete"><ActionIcon variant="subtle" size="sm" color="red" onClick={() => handleDelete(t.id)}><IconTrash size={14} /></ActionIcon></Tooltip>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => { closeModal(); setEditingId(null); }}
        title={<Text fw={600}>{editingId ? 'Edit' : 'Add'} Loan Program</Text>}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Program Name"
            placeholder="e.g. Conventional 30yr Fixed"
            value={form.name}
            onChange={(e) => updateForm({ name: e.currentTarget.value })}
            required
          />

          <Group grow>
            <NativeSelect
              label="Category"
              value={form.category}
              onChange={(e) => updateForm({ category: e.currentTarget.value })}
              data={[
                { value: 'FIXED', label: 'Fixed Rate' },
                { value: 'ARM', label: 'Adjustable Rate (ARM)' },
              ]}
            />
            <NativeSelect
              label="Loan Type"
              value={form.loanType}
              onChange={(e) => updateForm({ loanType: e.currentTarget.value })}
              data={[
                { value: 'conventional', label: 'Conventional' },
                { value: 'fha', label: 'FHA' },
                { value: 'va', label: 'VA' },
                { value: 'usda', label: 'USDA' },
                { value: 'jumbo', label: 'Jumbo' },
                { value: 'portfolio', label: 'Portfolio' },
              ]}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Term (years)"
              value={form.termYears}
              onChange={(v) => updateForm({ termYears: typeof v === 'number' ? v : 30 })}
              min={1}
              max={50}
            />
            <NumberInput
              label="Default Rate (%)"
              value={form.defaultRate ?? ''}
              onChange={(v) => updateForm({ defaultRate: typeof v === 'number' ? v : null })}
              decimalScale={3}
              step={0.125}
              min={0}
              max={20}
              placeholder="Optional"
            />
          </Group>

          {/* ARM Configuration */}
          {form.category === 'ARM' && (
            <>
              <Divider label="ARM Configuration" labelPosition="center" />
              <Group grow>
                <NumberInput
                  label="Initial Period (yrs)"
                  value={form.armInitialPeriod}
                  onChange={(v) => updateForm({ armInitialPeriod: typeof v === 'number' ? v : 5 })}
                  min={1}
                  max={10}
                />
                <NumberInput
                  label="Adjustment Period (yrs)"
                  value={form.armAdjustmentPeriod}
                  onChange={(v) => updateForm({ armAdjustmentPeriod: typeof v === 'number' ? v : 1 })}
                  min={1}
                  max={5}
                />
              </Group>
              <Group grow>
                <NumberInput
                  label="Initial Cap (%)"
                  value={form.armInitialCap}
                  onChange={(v) => updateForm({ armInitialCap: typeof v === 'number' ? v : 2 })}
                  decimalScale={1}
                  min={0}
                  max={10}
                />
                <NumberInput
                  label="Periodic Cap (%)"
                  value={form.armPeriodicCap}
                  onChange={(v) => updateForm({ armPeriodicCap: typeof v === 'number' ? v : 2 })}
                  decimalScale={1}
                  min={0}
                  max={10}
                />
                <NumberInput
                  label="Lifetime Cap (%)"
                  value={form.armLifetimeCap}
                  onChange={(v) => updateForm({ armLifetimeCap: typeof v === 'number' ? v : 5 })}
                  decimalScale={1}
                  min={0}
                  max={15}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Index"
                  placeholder="e.g. SOFR"
                  value={form.armIndexName}
                  onChange={(e) => updateForm({ armIndexName: e.currentTarget.value })}
                />
                <NumberInput
                  label="Margin (%)"
                  value={form.armMargin ?? ''}
                  onChange={(v) => updateForm({ armMargin: typeof v === 'number' ? v : null })}
                  decimalScale={3}
                  step={0.125}
                  placeholder="Optional"
                />
              </Group>
              <Text size="xs" c="dimmed">
                Caps: {form.armInitialCap}-{form.armPeriodicCap}-{form.armLifetimeCap} →
                {' '}{form.armInitialPeriod}/{form.armAdjustmentPeriod} ARM
              </Text>
            </>
          )}

          <Divider />

          <Group grow>
            <Switch
              label="Active"
              checked={form.isActive}
              onChange={(e) => updateForm({ isActive: e.currentTarget.checked })}
              description="Inactive programs won't appear in the scenario builder"
            />
          </Group>

          <TextInput
            label="Notes"
            placeholder="Internal notes about this program..."
            value={form.notes}
            onChange={(e) => updateForm({ notes: e.currentTarget.value })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { closeModal(); setEditingId(null); }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              {editingId ? 'Save Changes' : 'Add Program'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
