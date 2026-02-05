import { useState, useCallback } from 'react';
import {
  Container,
  Title,
  Paper,
  TextInput,
  NumberInput,
  Button,
  Group,
  Stack,
  Text,
  Grid,
  Card,
  Divider,
  SegmentedControl,
  Slider,
  Table,
  Badge,
  Accordion,
  ThemeIcon,
} from '@mantine/core';
import {
  IconCalculator,
  IconCurrencyDollar,
  IconPercentage,
  IconCalendar,
  IconTrendingUp,
  IconHome,
  IconReceipt,
  IconWallet,
  IconAlertTriangle,
} from '@tabler/icons-react';

interface CalculationResult {
  monthlyPayment: number;
  totalMonthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  loanToValue: number | null;
  dti: number | null;
}

interface AmortizationEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

const parseNumberInput = (value: number | string) => {
  if (typeof value === 'number') return value;
  const normalized = value.replace(/[^0-9.-]/g, '');
  if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function Calculator() {
  // Form state
  const [loanAmount, setLoanAmount] = useState<number | string>(300000);
  const [interestRate, setInterestRate] = useState<number | string>(7);
  const [termYears, setTermYears] = useState<number>(30);
  const [downPayment, setDownPayment] = useState<number | string>(60000);
  const [propertyValue, setPropertyValue] = useState<number | string>(375000);
  const [propertyTaxes, setPropertyTaxes] = useState<number | string>(3600);
  const [homeInsurance, setHomeInsurance] = useState<number | string>(1200);
  const [hoaFees, setHoaFees] = useState<number | string>(0);

  // DTI calculation inputs
  const [monthlyIncome, setMonthlyIncome] = useState<number | string>(0);
  const [existingDebts, setExistingDebts] = useState<number | string>(0);

  // Results
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [amortization, setAmortization] = useState<AmortizationEntry[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate loan payment
  const calculateLoan = useCallback(() => {
    const principal = parseNumberInput(loanAmount);
    const rate = parseNumberInput(interestRate);
    const propertyValueValue = parseNumberInput(propertyValue);
    const propertyTaxesValue = parseNumberInput(propertyTaxes);
    const homeInsuranceValue = parseNumberInput(homeInsurance);
    const hoaFeesValue = parseNumberInput(hoaFees);
    const monthlyIncomeValue = parseNumberInput(monthlyIncome);
    const existingDebtsValue = parseNumberInput(existingDebts);
    const monthlyRate = rate / 100 / 12;
    const numPayments = termYears * 12;

    // Calculate monthly mortgage payment (P&I)
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                       (Math.pow(1 + monthlyRate, numPayments) - 1);
    } else {
      monthlyPayment = principal / numPayments;
    }

    // Calculate LTV (Loan to Value)
    let loanToValue: number | null = null;
    if (propertyValueValue > 0) {
      loanToValue = (principal / propertyValueValue) * 100;
    }

    // Calculate total monthly payment (PITI + HOA)
    const monthlyPropertyTaxes = propertyTaxesValue / 12;
    const monthlyInsurance = homeInsuranceValue / 12;
    const monthlyHOA = hoaFeesValue;

    const totalMonthlyPayment = monthlyPayment + monthlyPropertyTaxes + monthlyInsurance + monthlyHOA;

    // Calculate total interest over life of loan
    const totalInterest = (monthlyPayment * numPayments) - principal;
    const totalCost = monthlyPayment * numPayments;

    // Calculate DTI (Debt-to-Income) ratio
    let dti: number | null = null;
    if (monthlyIncomeValue > 0) {
      const totalMonthlyDebt = totalMonthlyPayment + existingDebtsValue;
      dti = (totalMonthlyDebt / monthlyIncomeValue) * 100;
    }

    setResult({
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalMonthlyPayment: Math.round(totalMonthlyPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      loanToValue: loanToValue ? Math.round(loanToValue * 100) / 100 : null,
      dti: dti ? Math.round(dti * 100) / 100 : null,
    });

    // Generate amortization schedule (first 12 months + yearly summaries)
    const schedule: AmortizationEntry[] = [];
    let balance = principal;

    for (let month = 1; month <= numPayments && month <= 360; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance = Math.max(0, balance - principalPayment);

      // Show first 12 months, then yearly (every 12th month)
      if (month <= 12 || month % 12 === 0) {
        schedule.push({
          month,
          payment: Math.round(monthlyPayment * 100) / 100,
          principal: Math.round(principalPayment * 100) / 100,
          interest: Math.round(interestPayment * 100) / 100,
          balance: Math.round(balance * 100) / 100,
        });
      }
    }

    setAmortization(schedule);
  }, [loanAmount, interestRate, termYears, propertyValue, propertyTaxes, homeInsurance, hoaFees, monthlyIncome, existingDebts]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format percent
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const principalValue = parseNumberInput(loanAmount);
  const interestRateValue = parseNumberInput(interestRate);

  return (
    <Container size="xl" py="md">
      <Group mb="lg">
        <ThemeIcon size="xl" variant="light" color="blue">
          <IconCalculator size={24} aria-hidden="true" />
        </ThemeIcon>
        <Title order={2}>Loan Calculator</Title>
      </Group>

      <Grid gutter="lg">
        {/* Input Section */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper shadow="xs" p="lg" withBorder>
            <Title order={4} mb="md">Loan Details</Title>

            <Stack gap="md">
              <NumberInput
                label="Loan Amount"
                description="The amount you want to borrow"
                value={loanAmount}
                onChange={(val) => setLoanAmount(val)}
                min={1000}
                max={10000000}
                step={10000}
                prefix="$"
                thousandSeparator=","
                leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
              />

              <NumberInput
                label="Interest Rate"
                description="Annual interest rate"
                value={interestRate}
                onChange={(val) => setInterestRate(val)}
                min={0.1}
                max={30}
                step={0.125}
                decimalScale={3}
                suffix="%"
                leftSection={<IconPercentage size={16} aria-hidden="true" />}
              />

              <div>
                <Text size="sm" fw={500} mb={4}>Loan Term</Text>
                <Text size="xs" c="dimmed" mb={8}>Number of years to repay</Text>
                <SegmentedControl
                  fullWidth
                  value={String(termYears)}
                  onChange={(val) => setTermYears(Number(val))}
                  data={[
                    { label: '15 years', value: '15' },
                    { label: '20 years', value: '20' },
                    { label: '30 years', value: '30' },
                  ]}
                />
              </div>

              <Divider my="sm" />

              <Accordion variant="contained" radius="md">
                <Accordion.Item value="advanced">
                  <Accordion.Control icon={<IconHome size={18} aria-hidden="true" />}>
                    Additional Costs (Optional)
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <NumberInput
                        label="Property Value"
                        description="For LTV calculation"
                        value={propertyValue}
                        onChange={(val) => setPropertyValue(val)}
                        min={0}
                        prefix="$"
                        thousandSeparator=","
                      />

                      <NumberInput
                        label="Down Payment"
                        description="Amount paid upfront"
                        value={downPayment}
                        onChange={(val) => setDownPayment(val)}
                        min={0}
                        prefix="$"
                        thousandSeparator=","
                      />

                      <NumberInput
                        label="Annual Property Taxes"
                        value={propertyTaxes}
                        onChange={(val) => setPropertyTaxes(val)}
                        min={0}
                        prefix="$"
                        thousandSeparator=","
                      />

                      <NumberInput
                        label="Annual Home Insurance"
                        value={homeInsurance}
                        onChange={(val) => setHomeInsurance(val)}
                        min={0}
                        prefix="$"
                        thousandSeparator=","
                      />

                      <NumberInput
                        label="Monthly HOA Fees"
                        value={hoaFees}
                        onChange={(val) => setHoaFees(val)}
                        min={0}
                        prefix="$"
                        thousandSeparator=","
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="dti">
                  <Accordion.Control icon={<IconWallet size={18} aria-hidden="true" />}>
                    DTI Calculation (Optional)
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <NumberInput
                        label="Monthly Income"
                        description="Gross monthly income before taxes"
                        value={monthlyIncome}
                        onChange={(val) => setMonthlyIncome(val)}
                        min={0}
                        prefix="$"
                        thousandSeparator=","
                        leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
                      />

                      <NumberInput
                        label="Existing Monthly Debts"
                        description="Car payments, credit cards, student loans, etc."
                        value={existingDebts}
                        onChange={(val) => setExistingDebts(val)}
                        min={0}
                        prefix="$"
                        thousandSeparator=","
                        leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>

              <Button
                size="lg"
                fullWidth
                leftSection={<IconCalculator size={20} aria-hidden="true" />}
                onClick={calculateLoan}
              >
                Calculate
              </Button>
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Results Section */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          {result ? (
            <Stack gap="md">
              {/* Primary Result */}
              <Paper shadow="xs" p="lg" withBorder style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="sm" c="dimmed">Monthly Payment (P&I)</Text>
                    <Text size="xl" fw={700} style={{ fontSize: '2.5rem', color: 'var(--mantine-color-blue-7)' }}>
                      {formatCurrency(result.monthlyPayment)}
                    </Text>
                    <Text size="sm" c="dimmed">per month</Text>
                  </div>
                  <ThemeIcon size={60} variant="light" color="blue" radius="xl">
                    <IconReceipt size={32} aria-hidden="true" />
                  </ThemeIcon>
                </Group>
              </Paper>

              {/* Secondary Results */}
              <Grid gutter="md">
                <Grid.Col span={6}>
                  <Card padding="md" withBorder>
                    <Text size="sm" c="dimmed">Total Monthly (PITI)</Text>
                    <Text size="lg" fw={600}>
                      {formatCurrency(result.totalMonthlyPayment)}
                    </Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card padding="md" withBorder>
                    <Text size="sm" c="dimmed">Total Interest</Text>
                    <Text size="lg" fw={600} c="orange">
                      {formatCurrency(result.totalInterest)}
                    </Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card padding="md" withBorder>
                    <Text size="sm" c="dimmed">Total Cost of Loan</Text>
                    <Text size="lg" fw={600}>
                      {formatCurrency(result.totalCost)}
                    </Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card padding="md" withBorder>
                    <Text size="sm" c="dimmed">Loan-to-Value (LTV)</Text>
                    <Group gap="xs">
                      <Text size="lg" fw={600}>
                        {result.loanToValue ? formatPercent(result.loanToValue) : 'N/A'}
                      </Text>
                      {result.loanToValue && result.loanToValue > 80 && (
                        <Badge color="yellow" size="xs">PMI likely</Badge>
                      )}
                    </Group>
                  </Card>
                </Grid.Col>
                {result.dti !== null && (
                  <Grid.Col span={12}>
                    <Card
                      padding="md"
                      withBorder
                      style={{
                        borderColor: result.dti > 43 ? 'var(--mantine-color-red-5)' : undefined,
                        backgroundColor: result.dti > 43 ? 'var(--mantine-color-red-0)' : undefined,
                      }}
                    >
                      <Group justify="space-between" align="center">
                        <div>
                          <Text size="sm" c="dimmed">Debt-to-Income Ratio (DTI)</Text>
                          <Group gap="xs">
                            <Text size="lg" fw={600} c={result.dti > 43 ? 'red' : undefined}>
                              {formatPercent(result.dti)}
                            </Text>
                            {result.dti > 43 ? (
                              <Badge color="red" size="sm" leftSection={<IconAlertTriangle size={12} aria-hidden="true" />}>
                                High DTI
                              </Badge>
                            ) : result.dti > 36 ? (
                              <Badge color="yellow" size="sm">Moderate</Badge>
                            ) : (
                              <Badge color="green" size="sm">Good</Badge>
                            )}
                          </Group>
                        </div>
                        {result.dti > 43 && (
                          <Text size="xs" c="red" style={{ maxWidth: 200 }}>
                            DTI above 43% may make loan approval difficult. Consider reducing debt or increasing income.
                          </Text>
                        )}
                      </Group>
                    </Card>
                  </Grid.Col>
                )}
              </Grid>

              {/* Loan Summary */}
              <Paper shadow="xs" p="lg" withBorder>
                <Title order={5} mb="md">Loan Summary</Title>
                <Grid gutter="xs">
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Principal</Text>
                    <Text fw={500}>{formatCurrency(principalValue)}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Interest Rate</Text>
                    <Text fw={500}>{formatPercent(interestRateValue)} APR</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Term</Text>
                    <Text fw={500}>{termYears} years ({termYears * 12} payments)</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Interest / Principal Ratio</Text>
                    <Text fw={500}>
                      {(principalValue > 0
                        ? ((result.totalInterest / principalValue) * 100)
                        : 0
                      ).toFixed(1)}%
                    </Text>
                  </Grid.Col>
                </Grid>
              </Paper>

              {/* Amortization Schedule */}
              {amortization.length > 0 && (
                <Paper shadow="xs" p="lg" withBorder>
                  <Group justify="space-between" mb="md">
                    <Title order={5}>Amortization Schedule</Title>
                    <Badge color="gray">First year + yearly</Badge>
                  </Group>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Month</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Payment</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Principal</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Interest</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {amortization.slice(0, 24).map((entry) => (
                        <Table.Tr key={entry.month}>
                          <Table.Td>
                            {entry.month <= 12 ? entry.month : `Year ${entry.month / 12}`}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(entry.payment)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(entry.principal)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(entry.interest)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(entry.balance)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}
            </Stack>
          ) : (
            <Paper shadow="xs" p="xl" withBorder style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Stack align="center" gap="md">
                <ThemeIcon size={80} variant="light" color="gray" radius="xl">
                  <IconCalculator size={40} aria-hidden="true" />
                </ThemeIcon>
                <Text size="lg" c="dimmed" ta="center">
                  Enter loan details and click Calculate<br />to see your payment breakdown
                </Text>
              </Stack>
            </Paper>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
}
