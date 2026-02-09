import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, Text, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';
import type { LoanScenario } from '../../../types';

interface DeleteScenarioModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
  scenario: LoanScenario | null;
}

export function DeleteScenarioModal({ opened, onClose, clientId, scenario }: DeleteScenarioModalProps) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!scenario) {
      onClose();
      return;
    }

    setDeleting(true);
    try {
      const response = await api.delete(`/loan-scenarios/${scenario.id}`);

      if (!response.ok) {
        throw new Error('Failed to delete loan scenario');
      }

      queryClient.setQueryData(['client-loan-scenarios', clientId], (old: LoanScenario[] = []) => old.filter(s => s.id !== scenario.id));
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      onClose();

      notifications.show({
        title: 'Success',
        message: 'Loan scenario deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting loan scenario:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete loan scenario',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Delete Loan Scenario" centered>
      <Stack>
        <Text>
          Are you sure you want to delete the scenario <strong>{scenario?.name}</strong>? This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete} loading={deleting}>
            Delete Scenario
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
