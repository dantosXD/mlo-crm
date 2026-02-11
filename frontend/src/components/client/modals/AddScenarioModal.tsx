import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Modal, Stack, TextInput, Group, Button, ScrollArea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { LoanScenario } from '../../../types';
import type { LoanScenarioData, LoanProgramTemplate } from '../../../utils/loanTypes';
import { createDefaultScenarioData } from '../../../utils/loanTypes';
import { LoanScenarioBuilder } from '../../LoanScenarioBuilder';

interface AddScenarioModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
  editingScenario?: LoanScenario | null;
}

function parseScenarioData(entity: LoanScenario): LoanScenarioData | null {
  if (!entity.scenarioData) return null;
  try {
    return typeof entity.scenarioData === 'string'
      ? JSON.parse(entity.scenarioData)
      : entity.scenarioData;
  } catch {
    return null;
  }
}

export function AddScenarioModal({ opened, onClose, clientId, editingScenario }: AddScenarioModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingScenario;

  const [programTemplates, setProgramTemplates] = useState<LoanProgramTemplate[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [builderData, setBuilderData] = useState<LoanScenarioData>(createDefaultScenarioData());
  const [preferredProgramId, setPreferredProgramId] = useState<string | null>(null);
  const [recommendationNotes, setRecommendationNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch active program templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/loan-program-templates/active');
      if (res.ok) {
        const data = await res.json();
        setProgramTemplates(data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (opened) fetchTemplates();
  }, [opened, fetchTemplates]);

  // Reset form when opened/editing changes
  useEffect(() => {
    if (!opened) return;
    if (editingScenario) {
      setScenarioName(editingScenario.name);
      const data = parseScenarioData(editingScenario);
      setBuilderData(data || createDefaultScenarioData());
      setPreferredProgramId(editingScenario.preferredProgramId || null);
      setRecommendationNotes(editingScenario.recommendationNotes || '');
    } else {
      setScenarioName('New Loan Comparison');
      setBuilderData(createDefaultScenarioData(programTemplates.length > 0 ? programTemplates : undefined));
      setPreferredProgramId(null);
      setRecommendationNotes('');
    }
  }, [opened, editingScenario, programTemplates]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!scenarioName.trim()) {
      notifications.show({ title: 'Error', message: 'Scenario name is required', color: 'red' });
      return;
    }
    setSaving(true);

    try {
      const body: any = {
        clientId,
        name: scenarioName,
        loanType: builderData.inputs.scenarioType === 'purchase' ? 'PURCHASE' : 'REFINANCE',
        amount: builderData.inputs.purchasePrice
          ? (builderData.inputs.purchasePrice - (builderData.inputs.downPayment ?? 0))
          : (builderData.inputs.refinanceLoanAmount ?? 0),
        interestRate: builderData.programs[0]?.ratePercent ?? 0,
        termYears: builderData.programs[0]?.termYears ?? 30,
        scenarioData: builderData,
        preferredProgramId,
        recommendationNotes: recommendationNotes || null,
        status: editingScenario?.status || 'DRAFT',
      };

      let res: Response;
      if (isEditing) {
        res = await api.put(`/loan-scenarios/${editingScenario!.id}`, body);
      } else {
        res = await api.post('/loan-scenarios', body);
      }

      if (!res.ok) throw new Error('Failed to save');

      queryClient.invalidateQueries({ queryKey: ['client-loan-scenarios', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      handleClose();

      notifications.show({
        title: 'Success',
        message: isEditing ? 'Scenario updated' : 'Scenario created',
        color: 'green',
      });
    } catch (error) {
      console.error('Error saving scenario:', error);
      notifications.show({ title: 'Error', message: 'Failed to save loan scenario', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isEditing ? `Edit: ${editingScenario?.name}` : 'New Loan Comparison'}
      size="90vw"
      styles={{ body: { padding: 0 } }}
    >
      <ScrollArea.Autosize mah="80vh" p="md">
        <Stack>
          <TextInput
            label="Scenario Name"
            required
            value={scenarioName}
            onChange={(e) => setScenarioName(e.currentTarget.value)}
          />

          <LoanScenarioBuilder
            data={builderData}
            onChange={setBuilderData}
            preferredProgramId={preferredProgramId}
            onPreferredChange={setPreferredProgramId}
            recommendationNotes={recommendationNotes}
            onRecommendationNotesChange={setRecommendationNotes}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {isEditing ? 'Update Comparison' : 'Create Comparison'}
            </Button>
          </Group>
        </Stack>
      </ScrollArea.Autosize>
    </Modal>
  );
}
