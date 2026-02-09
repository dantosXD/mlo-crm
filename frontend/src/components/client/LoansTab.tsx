import { Stack, Card, Group, Text, Title, Button, Badge, Checkbox, ActionIcon, SimpleGrid, Divider, ThemeIcon } from '@mantine/core';
import { IconPlus, IconScale, IconStar, IconDownload, IconCalendar, IconTrash } from '@tabler/icons-react';
import { EmptyState } from '../EmptyState';
import type { LoanScenario } from '../../types';

interface LoansTabProps {
  loanScenarios: LoanScenario[];
  loadingScenarios: boolean;
  onAddScenario: () => void;
  onCompare: () => void;
  onToggleSelection: (scenarioId: string) => void;
  onSetPreferred: (scenarioId: string) => void;
  onDelete: (scenarioId: string) => void;
  onExportPDF: (scenario: LoanScenario) => void;
  onExportAmortization: (scenario: LoanScenario) => void;
  selectedScenarios: string[];
  formatCurrency: (value: number | undefined | null) => string;
  formatPercent: (value: number | undefined | null) => string;
}

export function LoansTab({
  loanScenarios,
  loadingScenarios,
  onAddScenario,
  onCompare,
  onToggleSelection,
  onSetPreferred,
  onDelete,
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
            Add Scenario
          </Button>
        </Group>
      </Group>
      {loadingScenarios ? (
        <Text c="dimmed">Loading loan scenarios...</Text>
      ) : loanScenarios.length === 0 ? (
        <EmptyState
          iconType="scenarios"
          title="No loan scenarios yet"
          description="Create loan scenarios to compare different financing options for this client."
          ctaLabel="Add Scenario"
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
            {loanScenarios.map((scenario) => (
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
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <Checkbox
                      checked={selectedScenarios.includes(scenario.id)}
                      onChange={() => onToggleSelection(scenario.id)}
                    />
                    {scenario.isPreferred && (
                      <ThemeIcon color="yellow" size="sm" variant="light">
                        <IconStar
                          size={14}
                          aria-hidden="true"
                          fill="currentColor"
                          stroke="currentColor"
                        />
                      </ThemeIcon>
                    )}
                    <Text fw={600} size="lg">{scenario.name}</Text>
                  </Group>
                  <Badge color={scenario.loanType === 'PURCHASE' ? 'blue' : 'green'}>
                    {scenario.loanType}
                  </Badge>
                </Group>

                <Divider mb="sm" />

                <SimpleGrid cols={2} spacing="xs" mb="md">
                  <div>
                    <Text size="xs" c="dimmed">Loan Amount</Text>
                    <Text fw={500}>{formatCurrency(scenario.amount)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Property Value</Text>
                    <Text fw={500}>{formatCurrency(scenario.propertyValue)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Interest Rate</Text>
                    <Text fw={500}>{formatPercent(scenario.interestRate)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Term</Text>
                    <Text fw={500}>{scenario.termYears} years</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Down Payment</Text>
                    <Text fw={500}>{formatCurrency(scenario.downPayment)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">LTV Ratio</Text>
                    <Text fw={500}>{formatPercent(scenario.loanToValue)}</Text>
                  </div>
                </SimpleGrid>

                <Divider mb="sm" />

                <SimpleGrid cols={2} spacing="xs" mb="md">
                  <div>
                    <Text size="xs" c="dimmed">Monthly P&I</Text>
                    <Text fw={600} c="blue" size="lg">{formatCurrency(scenario.monthlyPayment)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Total Monthly (PITI)</Text>
                    <Text fw={600} c="green" size="lg">{formatCurrency(scenario.totalMonthlyPayment)}</Text>
                  </div>
                </SimpleGrid>

                <Text size="xs" c="dimmed" mb="md">
                  Total Interest: {formatCurrency(scenario.totalInterest)} over {scenario.termYears} years
                </Text>

                <Group justify="flex-end" gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => onExportPDF(scenario)}
                    title="Export to PDF"
                    aria-label={`Export ${scenario.name} to PDF`}
                  >
                    <IconDownload size={16} aria-hidden="true" />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="teal"
                    onClick={() => onExportAmortization(scenario)}
                    title="Export Amortization Schedule"
                    aria-label={`Export amortization schedule for ${scenario.name}`}
                  >
                    <IconCalendar size={16} aria-hidden="true" />
                  </ActionIcon>
                  {!scenario.isPreferred && (
                    <ActionIcon
                      variant="subtle"
                      color="yellow"
                      onClick={() => onSetPreferred(scenario.id)}
                      title="Set as preferred"
                      aria-label={`Set ${scenario.name} as preferred scenario`}
                    >
                      <IconStar size={16} aria-hidden="true" />
                    </ActionIcon>
                  )}
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(scenario.id)}
                    title="Delete scenario"
                    aria-label={`Delete scenario: ${scenario.name}`}
                  >
                    <IconTrash size={16} aria-hidden="true" />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </>
      )}
    </>
  );
}
