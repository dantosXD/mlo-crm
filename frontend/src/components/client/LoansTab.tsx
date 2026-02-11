import { Card, Group, Text, Title, Button, Badge, Checkbox, ActionIcon, SimpleGrid, Divider, ThemeIcon, Menu, Tooltip } from '@mantine/core';
import { IconPlus, IconScale, IconStar, IconDownload, IconCalendar, IconTrash, IconEdit, IconSend, IconArchive, IconDots, IconFileText, IconArrowBack } from '@tabler/icons-react';
import { EmptyState } from '../EmptyState';
import type { LoanScenario } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'gray',
  PROPOSED: 'blue',
  SHARED: 'green',
  ARCHIVED: 'dimmed',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PROPOSED: 'Proposed',
  SHARED: 'Shared',
  ARCHIVED: 'Archived',
};

interface LoansTabProps {
  loanScenarios: LoanScenario[];
  loadingScenarios: boolean;
  onAddScenario: () => void;
  onEditScenario: (scenario: LoanScenario) => void;
  onCompare: () => void;
  onToggleSelection: (scenarioId: string) => void;
  onSetPreferred: (scenarioId: string) => void;
  onDelete: (scenarioId: string) => void;
  onStatusChange: (scenarioId: string, status: string) => void;
  onExportPDF: (scenario: LoanScenario) => void;
  onExportAmortization: (scenario: LoanScenario) => void;
  selectedScenarios: string[];
  formatCurrency: (value: number | undefined | null) => string;
  formatPercent: (value: number | undefined | null) => string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getProgramCount(scenario: LoanScenario): number {
  if (!scenario.scenarioData) return 0;
  try {
    const data = typeof scenario.scenarioData === 'string'
      ? JSON.parse(scenario.scenarioData)
      : scenario.scenarioData;
    return data?.programs?.length || 0;
  } catch {
    return 0;
  }
}

export function LoansTab({
  loanScenarios,
  loadingScenarios,
  onAddScenario,
  onEditScenario,
  onCompare,
  onToggleSelection,
  onSetPreferred,
  onDelete,
  onStatusChange,
  onExportPDF,
  onExportAmortization,
  selectedScenarios,
  formatCurrency,
  formatPercent,
}: LoansTabProps) {
  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Loan Scenarios</Title>
        <Group>
          {selectedScenarios.length >= 2 && (
            <Button
              leftSection={<IconScale size={16} aria-hidden="true" />}
              variant="light"
              onClick={onCompare}
            >
              Compare ({selectedScenarios.length})
            </Button>
          )}
          <Button
            leftSection={<IconPlus size={16} aria-hidden="true" />}
            onClick={onAddScenario}
          >
            New Comparison
          </Button>
        </Group>
      </Group>
      {loadingScenarios ? (
        <Text c="dimmed">Loading loan scenarios...</Text>
      ) : loanScenarios.length === 0 ? (
        <EmptyState
          iconType="scenarios"
          title="No loan scenarios yet"
          description="Create loan comparisons with multiple programs to find the best option for this client."
          ctaLabel="New Comparison"
          onCtaClick={onAddScenario}
        />
      ) : (
        <>
          {loanScenarios.length > 1 && (
            <Text size="sm" c="dimmed" mb="md">
              Select 2 or more scenarios to compare them side-by-side
            </Text>
          )}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {loanScenarios.map((scenario) => {
              const programCount = getProgramCount(scenario);
              const isRich = !!scenario.scenarioData;
              return (
                <Card
                  key={scenario.id}
                  withBorder
                  shadow="sm"
                  padding="lg"
                  style={{
                    ...(scenario.isPreferred ? { borderColor: 'var(--mantine-color-yellow-5)', borderWidth: 2 } : {}),
                    ...(selectedScenarios.includes(scenario.id) ? { borderColor: 'var(--mantine-color-blue-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-blue-0)' } : {}),
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Checkbox
                        checked={selectedScenarios.includes(scenario.id)}
                        onChange={() => onToggleSelection(scenario.id)}
                      />
                      {scenario.isPreferred && (
                        <ThemeIcon color="yellow" size="sm" variant="light">
                          <IconStar size={14} aria-hidden="true" fill="currentColor" stroke="currentColor" />
                        </ThemeIcon>
                      )}
                      <Text fw={600} size="md" lineClamp={1}>{scenario.name}</Text>
                    </Group>
                    <Group gap={6}>
                      <Badge size="sm" color={STATUS_COLORS[scenario.status] || 'gray'} variant="light">
                        {STATUS_LABELS[scenario.status] || scenario.status}
                      </Badge>
                      <Badge size="sm" color={scenario.loanType === 'PURCHASE' ? 'blue' : 'green'} variant="outline">
                        {scenario.loanType}
                      </Badge>
                    </Group>
                  </Group>

                  <Divider mb="xs" />

                  {isRich && programCount > 0 ? (
                    <Group gap="xs" mb="xs">
                      <Badge size="xs" variant="dot" color="violet">{programCount} programs compared</Badge>
                      {scenario.preferredProgramId && (
                        <Badge size="xs" variant="dot" color="yellow">Recommended set</Badge>
                      )}
                    </Group>
                  ) : null}

                  <SimpleGrid cols={2} spacing="xs" mb="xs">
                    <div>
                      <Text size="xs" c="dimmed">Loan Amount</Text>
                      <Text fw={500} size="sm">{formatCurrency(scenario.amount)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Rate / Term</Text>
                      <Text fw={500} size="sm">{formatPercent(scenario.interestRate)} · {scenario.termYears}yr</Text>
                    </div>
                    {scenario.monthlyPayment != null && (
                      <div>
                        <Text size="xs" c="dimmed">Monthly P&I</Text>
                        <Text fw={600} c="blue" size="sm">{formatCurrency(scenario.monthlyPayment)}</Text>
                      </div>
                    )}
                    {scenario.totalMonthlyPayment != null && (
                      <div>
                        <Text size="xs" c="dimmed">Total Monthly (PITI)</Text>
                        <Text fw={600} c="green" size="sm">{formatCurrency(scenario.totalMonthlyPayment)}</Text>
                      </div>
                    )}
                  </SimpleGrid>

                  {/* Timestamps */}
                  <Group gap="xs" mb="xs">
                    <Text size="xs" c="dimmed">Created {formatDate(scenario.createdAt)}</Text>
                    {scenario.sharedAt && (
                      <>
                        <Text size="xs" c="dimmed">·</Text>
                        <Text size="xs" c="green" fw={500}>Shared {formatDate(scenario.sharedAt)}</Text>
                      </>
                    )}
                  </Group>

                  {scenario.recommendationNotes && (
                    <Text size="xs" c="dimmed" lineClamp={2} mb="xs" fs="italic">
                      {scenario.recommendationNotes}
                    </Text>
                  )}

                  <Divider mb="xs" />

                  <Group justify="space-between" gap="xs">
                    {/* Status actions */}
                    <Group gap={4}>
                      {scenario.status === 'DRAFT' && (
                        <Tooltip label="Mark as Proposed">
                          <Button size="compact-xs" variant="light" color="blue" leftSection={<IconFileText size={14} />}
                            onClick={() => onStatusChange(scenario.id, 'PROPOSED')}>
                            Propose
                          </Button>
                        </Tooltip>
                      )}
                      {(scenario.status === 'DRAFT' || scenario.status === 'PROPOSED') && (
                        <Tooltip label="Mark as Shared with Client">
                          <Button size="compact-xs" variant="light" color="green" leftSection={<IconSend size={14} />}
                            onClick={() => onStatusChange(scenario.id, 'SHARED')}>
                            Share
                          </Button>
                        </Tooltip>
                      )}
                      {scenario.status === 'SHARED' && (
                        <Tooltip label="Archive this scenario">
                          <Button size="compact-xs" variant="light" color="gray" leftSection={<IconArchive size={14} />}
                            onClick={() => onStatusChange(scenario.id, 'ARCHIVED')}>
                            Archive
                          </Button>
                        </Tooltip>
                      )}
                      {scenario.status === 'ARCHIVED' && (
                        <Tooltip label="Move back to Draft">
                          <Button size="compact-xs" variant="light" color="gray" leftSection={<IconArrowBack size={14} />}
                            onClick={() => onStatusChange(scenario.id, 'DRAFT')}>
                            Reopen
                          </Button>
                        </Tooltip>
                      )}
                    </Group>

                    {/* Action icons */}
                    <Group gap={4}>
                      <Tooltip label="Edit comparison">
                        <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => onEditScenario(scenario)}>
                          <IconEdit size={16} aria-hidden="true" />
                        </ActionIcon>
                      </Tooltip>
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="sm">
                            <IconDots size={16} aria-hidden="true" />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => onExportPDF(scenario)}>
                            Export PDF
                          </Menu.Item>
                          <Menu.Item leftSection={<IconCalendar size={14} />} onClick={() => onExportAmortization(scenario)}>
                            Amortization Schedule
                          </Menu.Item>
                          {!scenario.isPreferred && (
                            <Menu.Item leftSection={<IconStar size={14} />} onClick={() => onSetPreferred(scenario.id)}>
                              Set as Preferred
                            </Menu.Item>
                          )}
                          <Menu.Divider />
                          <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => onDelete(scenario.id)}>
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </>
      )}
    </>
  );
}
