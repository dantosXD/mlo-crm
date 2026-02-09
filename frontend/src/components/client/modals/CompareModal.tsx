import { Modal, Stack, Paper, SimpleGrid, Text, Table, Badge, Group, Button } from '@mantine/core';
import type { LoanScenario } from '../../../types';

interface CompareModalProps {
  opened: boolean;
  onClose: () => void;
  scenarios: LoanScenario[];
}

const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
};

const formatPercent = (value: number | undefined | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
};

export function CompareModal({ opened, onClose, scenarios }: CompareModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Compare Loan Scenarios" size="xl">
      <Stack>
        {scenarios.length >= 2 && (() => {
          const minPayment = Math.min(...scenarios.map(s => s.monthlyPayment || 0));
          const maxPayment = Math.max(...scenarios.map(s => s.monthlyPayment || 0));
          const minInterest = Math.min(...scenarios.map(s => s.totalInterest || 0));
          const maxInterest = Math.max(...scenarios.map(s => s.totalInterest || 0));
          const paymentDiff = maxPayment - minPayment;
          const interestDiff = maxInterest - minInterest;

          return (
            <>
              <Paper p="md" withBorder bg="blue.0" mb="md">
                <SimpleGrid cols={2}>
                  <div>
                    <Text size="sm" c="dimmed">Monthly Payment Difference</Text>
                    <Text fw={700} size="xl" c="blue">{formatCurrency(paymentDiff)}/mo</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">Total Interest Difference</Text>
                    <Text fw={700} size="xl" c="red">{formatCurrency(interestDiff)}</Text>
                  </div>
                </SimpleGrid>
              </Paper>

              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Metric</Table.Th>
                    {scenarios.map(s => (
                      <Table.Th key={s.id}>{s.name}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td fw={500}>Loan Type</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>
                        <Badge color={s.loanType === 'PURCHASE' ? 'blue' : 'green'}>{s.loanType}</Badge>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>Loan Amount</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>{formatCurrency(s.amount)}</Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>Interest Rate</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>{formatPercent(s.interestRate)}</Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>Term</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>{s.termYears} years</Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>Down Payment</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>{formatCurrency(s.downPayment)}</Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>Property Value</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>{formatCurrency(s.propertyValue)}</Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>LTV Ratio</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>{formatPercent(s.loanToValue)}</Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr bg="blue.0">
                    <Table.Td fw={700}>Monthly P&I</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>
                        <Text fw={700} c={s.monthlyPayment === minPayment ? 'green' : s.monthlyPayment === maxPayment ? 'red' : undefined}>
                          {formatCurrency(s.monthlyPayment)}
                          {s.monthlyPayment === minPayment && <Badge ml="xs" size="xs" color="green">Lowest</Badge>}
                        </Text>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr bg="blue.0">
                    <Table.Td fw={700}>Total Monthly (PITI)</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>
                        <Text fw={700}>{formatCurrency(s.totalMonthlyPayment)}</Text>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                  <Table.Tr bg="red.0">
                    <Table.Td fw={700}>Total Interest</Table.Td>
                    {scenarios.map(s => (
                      <Table.Td key={s.id}>
                        <Text fw={700} c={s.totalInterest === minInterest ? 'green' : s.totalInterest === maxInterest ? 'red' : undefined}>
                          {formatCurrency(s.totalInterest)}
                          {s.totalInterest === minInterest && <Badge ml="xs" size="xs" color="green">Lowest</Badge>}
                        </Text>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </>
          );
        })()}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
