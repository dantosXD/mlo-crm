import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Modal, Stack, TextInput, Select, SimpleGrid, NumberInput,
  Divider, Paper, Text, Group, Button,
} from '@mantine/core';
import { IconCurrencyDollar, IconPercentage, IconCalendar } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { LoanScenario } from '../../../types';

interface AddScenarioModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
}

const defaultForm = {
  name: '',
  loanType: 'PURCHASE' as 'PURCHASE' | 'REFINANCE',
  amount: 400000,
  interestRate: 6.5,
  termYears: 30,
  downPayment: 80000,
  propertyValue: 500000,
  propertyTaxes: 0,
  homeInsurance: 0,
  hoaFees: 0,
};

export function AddScenarioModal({ opened, onClose, clientId }: AddScenarioModalProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState<{
    monthlyPayment?: number;
    totalMonthlyPayment?: number;
    totalInterest?: number;
    loanToValue?: number;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<{ name?: string; amount?: string; interestRate?: string; termYears?: string }>({});

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '-';
    return `${value.toFixed(2)}%`;
  };

  const handleClose = () => {
    setForm({ ...defaultForm });
    setCalculatedValues(null);
    setFormErrors({});
    onClose();
  };

  const handleCalculate = async () => {
    const errors: { name?: string; amount?: string; interestRate?: string; termYears?: string } = {};

    if (form.amount <= 0) errors.amount = 'Loan amount must be greater than 0';
    if (form.interestRate <= 0) errors.interestRate = 'Interest rate must be greater than 0%';
    else if (form.interestRate > 30) errors.interestRate = 'Interest rate cannot exceed 30%';
    if (!form.termYears || form.termYears <= 0) errors.termYears = 'Term is required and must be greater than 0';
    else if (form.termYears > 40) errors.termYears = 'Term cannot exceed 40 years';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      const response = await api.post('/loan-scenarios/calculate', {
        amount: form.amount,
        interestRate: form.interestRate,
        termYears: form.termYears,
        downPayment: form.downPayment,
        propertyValue: form.propertyValue,
        propertyTaxes: form.propertyTaxes,
        homeInsurance: form.homeInsurance,
        hoaFees: form.hoaFees,
      });

      if (!response.ok) throw new Error('Failed to calculate');
      const result = await response.json();
      setCalculatedValues(result);

      notifications.show({
        title: 'Calculated',
        message: `Monthly Payment: $${result.monthlyPayment?.toLocaleString()}`,
        color: 'blue',
      });
    } catch (error) {
      console.error('Error calculating scenario:', error);
      notifications.show({ title: 'Error', message: 'Failed to calculate loan scenario', color: 'red' });
    }
  };

  const handleCreate = async () => {
    const errors: { name?: string; amount?: string; interestRate?: string; termYears?: string } = {};
    if (!form.name.trim()) errors.name = 'Scenario name is required';
    if (form.amount <= 0) errors.amount = 'Loan amount must be greater than 0';
    if (form.interestRate <= 0) errors.interestRate = 'Interest rate must be greater than 0%';
    else if (form.interestRate > 30) errors.interestRate = 'Interest rate cannot exceed 30%';
    if (!form.termYears || form.termYears <= 0) errors.termYears = 'Term is required and must be greater than 0';
    else if (form.termYears > 40) errors.termYears = 'Term cannot exceed 40 years';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);

    try {
      const response = await api.post('/loan-scenarios', { clientId, ...form });
      if (!response.ok) throw new Error('Failed to create loan scenario');

      const createdScenario = await response.json();
      queryClient.setQueryData(['client-loan-scenarios', clientId], (old: LoanScenario[] = []) => [createdScenario, ...old]);
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      handleClose();

      notifications.show({ title: 'Success', message: 'Loan scenario created successfully', color: 'green' });
    } catch (error) {
      console.error('Error creating loan scenario:', error);
      notifications.show({ title: 'Error', message: 'Failed to create loan scenario', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Loan Scenario" size="lg">
      <Stack>
        <TextInput
          label="Scenario Name"
          placeholder="e.g., 30-Year Fixed 6.5%"
          required
          value={form.name}
          onChange={(e) => {
            setForm({ ...form, name: e.target.value });
            if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
          }}
          error={formErrors.name}
        />

        <Select
          label="Loan Type"
          data={[
            { value: 'PURCHASE', label: 'Purchase' },
            { value: 'REFINANCE', label: 'Refinance' },
          ]}
          value={form.loanType}
          onChange={(value) => setForm({ ...form, loanType: (value as 'PURCHASE' | 'REFINANCE') || 'PURCHASE' })}
        />

        <SimpleGrid cols={2}>
          <NumberInput
            label="Loan Amount"
            placeholder="400000"
            required
            value={form.amount}
            onChange={(value) => {
              setForm({ ...form, amount: Number(value) || 0 });
              if (formErrors.amount) setFormErrors({ ...formErrors, amount: undefined });
            }}
            leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
            thousandSeparator=","
            error={formErrors.amount}
          />
          <NumberInput
            label="Property Value"
            placeholder="500000"
            min={0}
            value={form.propertyValue}
            onChange={(value) => setForm({ ...form, propertyValue: Number(value) || 0 })}
            leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
            thousandSeparator=","
          />
        </SimpleGrid>

        <SimpleGrid cols={3}>
          <NumberInput
            label="Interest Rate (%)"
            placeholder="6.5"
            required
            min={0}
            step={0.125}
            decimalScale={3}
            value={form.interestRate}
            onChange={(value) => {
              setForm({ ...form, interestRate: Number(value) || 0 });
              if (formErrors.interestRate) setFormErrors({ ...formErrors, interestRate: undefined });
            }}
            leftSection={<IconPercentage size={16} aria-hidden="true" />}
            error={formErrors.interestRate}
          />
          <NumberInput
            label="Term (Years)"
            placeholder="30"
            required
            min={1}
            max={40}
            value={form.termYears}
            onChange={(value) => {
              setForm({ ...form, termYears: Number(value) || 0 });
              if (formErrors.termYears) setFormErrors({ ...formErrors, termYears: undefined });
            }}
            leftSection={<IconCalendar size={16} aria-hidden="true" />}
            error={formErrors.termYears}
          />
          <NumberInput
            label="Down Payment"
            placeholder="80000"
            min={0}
            value={form.downPayment}
            onChange={(value) => setForm({ ...form, downPayment: Number(value) || 0 })}
            leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
            thousandSeparator=","
          />
        </SimpleGrid>

        <Divider label="Additional Costs (Annual)" labelPosition="center" />

        <SimpleGrid cols={3}>
          <NumberInput
            label="Property Taxes"
            placeholder="0"
            min={0}
            value={form.propertyTaxes}
            onChange={(value) => setForm({ ...form, propertyTaxes: Number(value) || 0 })}
            leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
            thousandSeparator=","
          />
          <NumberInput
            label="Home Insurance"
            placeholder="0"
            min={0}
            value={form.homeInsurance}
            onChange={(value) => setForm({ ...form, homeInsurance: Number(value) || 0 })}
            leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
            thousandSeparator=","
          />
          <NumberInput
            label="HOA Fees (Monthly)"
            placeholder="0"
            min={0}
            value={form.hoaFees}
            onChange={(value) => setForm({ ...form, hoaFees: Number(value) || 0 })}
            leftSection={<IconCurrencyDollar size={16} aria-hidden="true" />}
            thousandSeparator=","
          />
        </SimpleGrid>

        {calculatedValues && (
          <>
            <Divider label="Calculated Values" labelPosition="center" />
            <Paper p="md" withBorder bg="gray.0">
              <SimpleGrid cols={2}>
                <div>
                  <Text size="xs" c="dimmed">Monthly P&I</Text>
                  <Text fw={600} size="lg" c="blue">{formatCurrency(calculatedValues.monthlyPayment)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Total Monthly (PITI)</Text>
                  <Text fw={600} size="lg" c="green">{formatCurrency(calculatedValues.totalMonthlyPayment)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Total Interest</Text>
                  <Text fw={500}>{formatCurrency(calculatedValues.totalInterest)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">LTV Ratio</Text>
                  <Text fw={500}>{formatPercent(calculatedValues.loanToValue)}</Text>
                </div>
              </SimpleGrid>
            </Paper>
          </>
        )}

        <Group justify="space-between" mt="md">
          <Button variant="light" onClick={handleCalculate}>
            Calculate
          </Button>
          <Group>
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
