import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, Select, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../utils/api';

interface AssignPackageModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
}

export function AssignPackageModal({ opened, onClose, clientId }: AssignPackageModalProps) {
  const queryClient = useQueryClient();

  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Fetch available packages when modal opens
  const { data: availablePackages = [], isLoading: loadingPackages } = useQuery({
    queryKey: ['document-packages'],
    queryFn: async () => {
      const response = await api.get('/document-packages');
      if (!response.ok) throw new Error('Failed to fetch packages');
      return response.json() as Promise<any[]>;
    },
    enabled: opened,
  });

  const handleClose = () => {
    setSelectedPackageId('');
    onClose();
  };

  const handleAssign = async () => {
    if (!selectedPackageId) return;

    setAssigning(true);
    try {
      const response = await api.post('/document-packages/assign', {
        clientId,
        packageId: selectedPackageId,
      });

      if (!response.ok) throw new Error('Failed to assign package');

      queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      handleClose();

      notifications.show({
        title: 'Success',
        message: 'Document package assigned successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error assigning package:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to assign document package',
        color: 'red',
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Assign Document Package">
      <Stack>
        <Select
          label="Select Package"
          placeholder={loadingPackages ? "Loading packages..." : "Choose a document package"}
          data={availablePackages.map((pkg: any) => ({
            value: pkg.id,
            label: `${pkg.name} (${pkg.documents?.length || 0} documents)`,
          }))}
          value={selectedPackageId}
          onChange={(value) => setSelectedPackageId(value || '')}
          disabled={loadingPackages}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} loading={assigning} disabled={!selectedPackageId}>
            Assign Package
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
