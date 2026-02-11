import { useState, useMemo, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Grid,
  NumberInput,
  TextInput,
  Select,
  Button,
  ActionIcon,
  Table,
  Badge,
  Card,
  Divider,
  Tooltip,
  SegmentedControl,
  Textarea,
  Alert,
  Collapse,
  ThemeIcon,
  Box,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconCopy,
  IconStar,
  IconStarFilled,
  IconChevronDown,
  IconChevronUp,
  IconHome,
  IconCurrencyDollar,
  IconTrendingDown,
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import type {
  LoanProgram,
  LoanInputs,
  LoanScenarioData,
  LoanProgramType,
  LoanScenarioType,
  ProgramComputedMetrics,
} from '../utils/loanTypes';
import {
  uid,
  createDefaultProgram,
} from '../utils/loanTypes';
import {
  computeAllMetrics,
  getSelectedPrograms,
  findBestProgram,
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
} from '../utils/loanCalculations';

// ── Props ────────────────────────────────────────────────────────────────

interface LoanScenarioBuilderProps {
  data: LoanScenarioData;
  onChange: (data: LoanScenarioData) => void;
  preferredProgramId?: string | null;
  onPreferredChange?: (programId: string | null) => void;
  recommendationNotes?: string;
  onRecommendationNotesChange?: (notes: string) => void;
  readOnly?: boolean;
}

// ── Program Type Options ─────────────────────────────────────────────────

const PROGRAM_TYPE_OPTIONS: { value: LoanProgramType; label: string }[] = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'usda', label: 'USDA' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'portfolio', label: 'Portfolio' },
];

const TERM_OPTIONS = [
  { value: '10', label: '10 yr' },
  { value: '15', label: '15 yr' },
  { value: '20', label: '20 yr' },
  { value: '25', label: '25 yr' },
  { value: '30', label: '30 yr' },
];

// ── Component ────────────────────────────────────────────────────────────

export function LoanScenarioBuilder({
  data,
  onChange,
  preferredProgramId,
  onPreferredChange,
  recommendationNotes,
  onRecommendationNotesChange,
  readOnly = false,
}: LoanScenarioBuilderProps) {
  // ── Derived calculations ───────────────────────────────────────────────
  const metrics = useMemo(() => computeAllMetrics(data), [data]);
  const selectedPrograms = useMemo(() => getSelectedPrograms(data.programs), [data.programs]);

  const bestPaymentId = useMemo(
    () => findBestProgram(metrics, 'lowestPayment'),
    [metrics],
  );
  const bestCostId = useMemo(
    () => findBestProgram(metrics, 'lowestTotalCost'),
    [metrics],
  );

  // ── Updaters ───────────────────────────────────────────────────────────

  const updateInputs = useCallback(
    (patch: Partial<LoanInputs>) => {
      const newInputs = { ...data.inputs, ...patch };

      // Sync down payment ↔ down payment percent
      if ('downPayment' in patch && newInputs.purchasePrice && newInputs.purchasePrice > 0) {
        newInputs.downPaymentPercent = ((patch.downPayment ?? 0) / newInputs.purchasePrice) * 100;
      } else if ('downPaymentPercent' in patch && newInputs.purchasePrice && newInputs.purchasePrice > 0) {
        newInputs.downPayment = (newInputs.purchasePrice * (patch.downPaymentPercent ?? 0)) / 100;
      } else if ('purchasePrice' in patch && newInputs.downPaymentPercent != null) {
        newInputs.downPayment = ((patch.purchasePrice ?? 0) * newInputs.downPaymentPercent) / 100;
      }

      onChange({ ...data, inputs: newInputs });
    },
    [data, onChange],
  );

  const updateProgram = useCallback(
    (id: string, patch: Partial<LoanProgram>) => {
      onChange({
        ...data,
        programs: data.programs.map(p => (p.id === id ? { ...p, ...patch } : p)),
      });
    },
    [data, onChange],
  );

  const addProgram = useCallback(() => {
    const newProg = createDefaultProgram({
      name: `Program ${data.programs.length + 1}`,
    });
    onChange({ ...data, programs: [...data.programs, newProg] });
  }, [data, onChange]);

  const duplicateProgram = useCallback(
    (id: string) => {
      const source = data.programs.find(p => p.id === id);
      if (!source) return;
      const copy: LoanProgram = { ...source, id: uid(), name: `${source.name} (copy)` };
      onChange({ ...data, programs: [...data.programs, copy] });
    },
    [data, onChange],
  );

  const removeProgram = useCallback(
    (id: string) => {
      if (data.programs.length <= 1) return;
      onChange({ ...data, programs: data.programs.filter(p => p.id !== id) });
      if (preferredProgramId === id) {
        onPreferredChange?.(null);
      }
    },
    [data, onChange, preferredProgramId, onPreferredChange],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Stack gap="lg">
      {/* ── SCENARIO INPUTS ────────────────────────────────────────────── */}
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <ThemeIcon variant="light" size="lg" color="blue">
              <IconHome size={20} />
            </ThemeIcon>
            <Title order={4}>Scenario Inputs</Title>
          </Group>
          <SegmentedControl
            value={data.inputs.scenarioType}
            onChange={(val) => updateInputs({ scenarioType: val as LoanScenarioType })}
            data={[
              { value: 'purchase', label: 'Purchase' },
              { value: 'refinance', label: 'Refinance' },
            ]}
            disabled={readOnly}
          />
        </Group>

        <Grid>
          {data.inputs.scenarioType === 'purchase' ? (
            <>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <NumberInput
                  label="Purchase Price"
                  value={data.inputs.purchasePrice ?? 0}
                  onChange={(val) => updateInputs({ purchasePrice: Number(val) || 0 })}
                  prefix="$"
                  thousandSeparator=","
                  min={0}
                  disabled={readOnly}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <NumberInput
                  label="Down Payment"
                  value={data.inputs.downPayment ?? 0}
                  onChange={(val) => updateInputs({ downPayment: Number(val) || 0 })}
                  prefix="$"
                  thousandSeparator=","
                  min={0}
                  disabled={readOnly}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <NumberInput
                  label="Down Payment %"
                  value={data.inputs.downPaymentPercent ?? 0}
                  onChange={(val) => updateInputs({ downPaymentPercent: Number(val) || 0 })}
                  suffix="%"
                  min={0}
                  max={100}
                  decimalScale={2}
                  disabled={readOnly}
                />
              </Grid.Col>
            </>
          ) : (
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Current Loan Balance"
                value={data.inputs.refinanceLoanAmount ?? 0}
                onChange={(val) => updateInputs({ refinanceLoanAmount: Number(val) || 0 })}
                prefix="$"
                thousandSeparator=","
                min={0}
                disabled={readOnly}
              />
            </Grid.Col>
          )}
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Gross Monthly Income"
              value={data.inputs.grossMonthlyIncome ?? 0}
              onChange={(val) => updateInputs({ grossMonthlyIncome: Number(val) || 0 })}
              prefix="$"
              thousandSeparator=","
              min={0}
              disabled={readOnly}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Annual Property Tax"
              value={data.inputs.annualPropertyTax ?? 0}
              onChange={(val) => updateInputs({ annualPropertyTax: Number(val) || 0 })}
              prefix="$"
              thousandSeparator=","
              min={0}
              disabled={readOnly}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Annual Home Insurance"
              value={data.inputs.annualHomeInsurance ?? 0}
              onChange={(val) => updateInputs({ annualHomeInsurance: Number(val) || 0 })}
              prefix="$"
              thousandSeparator=","
              min={0}
              disabled={readOnly}
            />
          </Grid.Col>
          {data.inputs.scenarioType === 'refinance' && (
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Previous Monthly PITI"
                value={data.inputs.previousMonthlyPITI ?? 0}
                onChange={(val) => updateInputs({ previousMonthlyPITI: Number(val) || 0 })}
                prefix="$"
                thousandSeparator=","
                min={0}
                disabled={readOnly}
              />
            </Grid.Col>
          )}
        </Grid>
      </Paper>

      {/* ── PROGRAMS ───────────────────────────────────────────────────── */}
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <ThemeIcon variant="light" size="lg" color="violet">
              <IconCurrencyDollar size={20} />
            </ThemeIcon>
            <Title order={4}>Loan Programs</Title>
            <Badge size="sm" variant="light">{data.programs.length} programs</Badge>
          </Group>
          {!readOnly && (
            <Button leftSection={<IconPlus size={16} />} size="xs" onClick={addProgram}>
              Add Program
            </Button>
          )}
        </Group>

        <Stack gap="sm">
          {data.programs.map((program, idx) => (
            <ProgramRow
              key={program.id}
              program={program}
              index={idx}
              isPreferred={preferredProgramId === program.id}
              onChange={(patch) => updateProgram(program.id, patch)}
              onDuplicate={() => duplicateProgram(program.id)}
              onRemove={() => removeProgram(program.id)}
              onSetPreferred={() => onPreferredChange?.(
                preferredProgramId === program.id ? null : program.id,
              )}
              canRemove={data.programs.length > 1}
              readOnly={readOnly}
            />
          ))}
        </Stack>
      </Paper>

      {/* ── COMPARISON TABLE ───────────────────────────────────────────── */}
      {selectedPrograms.length > 0 && (
        <Paper p="lg" withBorder radius="md">
          <Group gap="xs" mb="md">
            <ThemeIcon variant="light" size="lg" color="teal">
              <IconTrendingDown size={20} />
            </ThemeIcon>
            <Title order={4}>Comparison</Title>
          </Group>
          <ComparisonTable
            programs={selectedPrograms}
            metrics={metrics}
            bestPaymentId={bestPaymentId}
            bestCostId={bestCostId}
            preferredProgramId={preferredProgramId ?? null}
            isRefinance={data.inputs.scenarioType === 'refinance'}
          />
        </Paper>
      )}

      {/* ── RECOMMENDATION ─────────────────────────────────────────────── */}
      {onRecommendationNotesChange && (
        <Paper p="lg" withBorder radius="md">
          <Group gap="xs" mb="md">
            <ThemeIcon variant="light" size="lg" color="yellow">
              <IconStarFilled size={20} />
            </ThemeIcon>
            <Title order={4}>Recommendation</Title>
          </Group>
          {preferredProgramId ? (
            <Alert color="green" icon={<IconCheck size={18} />} mb="sm">
              <Text size="sm">
                <strong>
                  {data.programs.find(p => p.id === preferredProgramId)?.name ?? 'Selected program'}
                </strong>{' '}
                is set as the recommended option.
              </Text>
            </Alert>
          ) : (
            <Alert color="orange" icon={<IconInfoCircle size={18} />} mb="sm">
              <Text size="sm">
                Click the star icon on a program above to mark it as your recommendation.
              </Text>
            </Alert>
          )}
          <Textarea
            label="Recommendation Notes"
            placeholder="Explain why you recommend this option..."
            value={recommendationNotes ?? ''}
            onChange={(e) => onRecommendationNotesChange(e.currentTarget.value)}
            autosize
            minRows={3}
            maxRows={8}
            disabled={readOnly}
          />
        </Paper>
      )}
    </Stack>
  );
}

// ── Program Row ──────────────────────────────────────────────────────────

interface ProgramRowProps {
  program: LoanProgram;
  index: number;
  isPreferred: boolean;
  onChange: (patch: Partial<LoanProgram>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSetPreferred: () => void;
  canRemove: boolean;
  readOnly: boolean;
}

function ProgramRow({
  program,
  index: _index,
  isPreferred,
  onChange,
  onDuplicate,
  onRemove,
  onSetPreferred,
  canRemove,
  readOnly,
}: ProgramRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card withBorder radius="sm" p="sm" style={isPreferred ? { borderColor: 'var(--mantine-color-yellow-5)', borderWidth: 2 } : undefined}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Tooltip label={isPreferred ? 'Remove recommendation' : 'Set as recommended'}>
            <ActionIcon
              variant={isPreferred ? 'filled' : 'subtle'}
              color="yellow"
              size="sm"
              onClick={onSetPreferred}
              disabled={readOnly}
            >
              {isPreferred ? <IconStarFilled size={14} /> : <IconStar size={14} />}
            </ActionIcon>
          </Tooltip>
          <TextInput
            value={program.name}
            onChange={(e) => onChange({ name: e.currentTarget.value })}
            size="xs"
            variant="unstyled"
            fw={600}
            style={{ flex: 1, minWidth: 100 }}
            disabled={readOnly}
          />
        </Group>
        <Group gap={4} wrap="nowrap">
          <Select
            value={program.type}
            onChange={(val) => onChange({ type: (val as LoanProgramType) || 'conventional' })}
            data={PROGRAM_TYPE_OPTIONS}
            size="xs"
            w={120}
            disabled={readOnly}
          />
          <Select
            value={String(program.termYears)}
            onChange={(val) => onChange({ termYears: parseInt(val || '30') })}
            data={TERM_OPTIONS}
            size="xs"
            w={80}
            disabled={readOnly}
          />
          <NumberInput
            value={program.ratePercent}
            onChange={(val) => onChange({ ratePercent: Number(val) || 0 })}
            suffix="%"
            size="xs"
            w={85}
            decimalScale={3}
            step={0.125}
            min={0}
            max={15}
            disabled={readOnly}
          />
          {!readOnly && (
            <>
              <Tooltip label="Duplicate">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={onDuplicate}>
                  <IconCopy size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Remove">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={onRemove}
                  disabled={!canRemove}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      <Collapse in={expanded}>
        <Divider my="xs" />
        <Grid gutter="xs">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Rate Buydown (pts)"
              value={program.rateReductionPercent ?? 0}
              onChange={(val) => onChange({ rateReductionPercent: Number(val) || 0 })}
              suffix="%"
              size="xs"
              decimalScale={3}
              min={0}
              disabled={readOnly}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Buydown Cost"
              value={program.buydownCost ?? 0}
              onChange={(val) => onChange({ buydownCost: Number(val) || 0 })}
              prefix="$"
              thousandSeparator=","
              size="xs"
              min={0}
              disabled={readOnly}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Override Loan Amount"
              value={program.overrideLoanAmount ?? ''}
              onChange={(val) => onChange({ overrideLoanAmount: val ? Number(val) : undefined })}
              prefix="$"
              thousandSeparator=","
              size="xs"
              min={0}
              placeholder="Auto"
              disabled={readOnly}
            />
          </Grid.Col>
        </Grid>
      </Collapse>
    </Card>
  );
}

// ── Comparison Table ─────────────────────────────────────────────────────

interface ComparisonTableProps {
  programs: LoanProgram[];
  metrics: Map<string, ProgramComputedMetrics>;
  bestPaymentId: string | null;
  bestCostId: string | null;
  preferredProgramId: string | null;
  isRefinance: boolean;
}

function ComparisonTable({
  programs,
  metrics,
  bestPaymentId,
  bestCostId,
  preferredProgramId,
  isRefinance,
}: ComparisonTableProps) {
  type Row = { label: string; key: string; format: (m: ProgramComputedMetrics) => string; highlight?: (m: ProgramComputedMetrics, id: string) => boolean };

  const rows: Row[] = [
    { label: 'Loan Amount', key: 'loanAmount', format: (m) => formatCurrency(m.loanAmount) },
    { label: 'Rate', key: 'effectiveRate', format: (m) => formatPercent(m.effectiveRate, 3) },
    {
      label: 'Monthly P&I',
      key: 'monthlyPI',
      format: (m) => formatCurrencyFull(m.monthlyPI),
    },
    {
      label: 'Monthly Tax',
      key: 'monthlyPropertyTax',
      format: (m) => formatCurrencyFull(m.monthlyPropertyTax),
    },
    {
      label: 'Monthly Insurance',
      key: 'monthlyInsurance',
      format: (m) => formatCurrencyFull(m.monthlyInsurance),
    },
    {
      label: 'Monthly PMI/MIP',
      key: 'monthlyPMI',
      format: (m) => m.monthlyPMI > 0 ? formatCurrencyFull(m.monthlyPMI) : '—',
    },
    {
      label: 'Total Monthly (PITI)',
      key: 'totalMonthlyPITI',
      format: (m) => formatCurrencyFull(m.totalMonthlyPITI),
      highlight: (_m, id) => id === bestPaymentId,
    },
    { label: 'Total Interest', key: 'totalInterest', format: (m) => formatCurrency(m.totalInterest) },
    {
      label: 'Total Cost',
      key: 'totalCost',
      format: (m) => formatCurrency(m.totalCost),
      highlight: (_m, id) => id === bestCostId,
    },
    { label: 'LTV', key: 'ltv', format: (m) => formatPercent(m.ltv, 1) },
    {
      label: 'DTI',
      key: 'dti',
      format: (m) => m.dti > 0 ? formatPercent(m.dti, 1) : '—',
    },
  ];

  // Add ARM-specific rows if any program is an ARM
  const hasARM = programs.some(p => p.category === 'ARM' && p.armConfig);
  if (hasARM) {
    rows.push(
      {
        label: 'Max Rate (Worst Case)',
        key: 'armMaxRate',
        format: (m) => m.armMaxRate != null ? formatPercent(m.armMaxRate, 3) : '—',
      },
      {
        label: 'Worst-Case P&I',
        key: 'armWorstCasePI',
        format: (m) => m.armWorstCasePI != null ? formatCurrencyFull(m.armWorstCasePI) : '—',
      },
      {
        label: 'Worst-Case PITI',
        key: 'armWorstCasePITI',
        format: (m) => m.armWorstCasePITI != null ? formatCurrencyFull(m.armWorstCasePITI) : '—',
      },
    );
  }

  if (isRefinance) {
    rows.push({
      label: 'Monthly Savings',
      key: 'refinanceMonthlySavings',
      format: (m) => m.refinanceMonthlySavings != null
        ? formatCurrencyFull(m.refinanceMonthlySavings)
        : '—',
    });
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ minWidth: 150 }}>Metric</Table.Th>
            {programs.map((p) => (
              <Table.Th key={p.id} style={{ minWidth: 130, textAlign: 'right' }}>
                <Group gap={4} justify="flex-end" wrap="nowrap">
                  {p.id === preferredProgramId && (
                    <IconStarFilled size={14} color="var(--mantine-color-yellow-5)" />
                  )}
                  <Text size="sm" fw={600} truncate>
                    {p.name}
                  </Text>
                </Group>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.key}>
              <Table.Td>
                <Text size="sm" fw={500}>{row.label}</Text>
              </Table.Td>
              {programs.map((p) => {
                const m = metrics.get(p.id);
                if (!m) return <Table.Td key={p.id} />;
                const isHighlight = row.highlight?.(m, p.id);
                const isPreferred = p.id === preferredProgramId;
                return (
                  <Table.Td
                    key={p.id}
                    style={{
                      textAlign: 'right',
                      fontWeight: isHighlight ? 700 : undefined,
                      color: isHighlight ? 'var(--mantine-color-green-7)' : undefined,
                      backgroundColor: isPreferred ? 'var(--mantine-color-yellow-0)' : undefined,
                    }}
                  >
                    <Text size="sm">{row.format(m)}</Text>
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* DTI Warning */}
      {programs.some(p => {
        const m = metrics.get(p.id);
        return m && m.dti > 43;
      }) && (
        <Alert color="orange" icon={<IconAlertTriangle size={16} />} mt="sm">
          <Text size="sm">
            One or more programs have a DTI ratio above 43%, which may affect loan qualification.
          </Text>
        </Alert>
      )}
    </Box>
  );
}

export default LoanScenarioBuilder;
