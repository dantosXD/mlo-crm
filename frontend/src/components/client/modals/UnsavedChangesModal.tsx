import { Modal, Stack, Alert, Group, Button } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface UnsavedChangesModalProps {
  opened: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export function UnsavedChangesModal({ opened, onStay, onLeave }: UnsavedChangesModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onStay}
      title="Unsaved Changes"
      centered
    >
      <Stack>
        <Alert color="yellow" icon={<IconAlertCircle size={16} aria-hidden="true" />}>
          You have unsaved changes in the edit form. Are you sure you want to leave? Your changes will be lost.
        </Alert>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onStay}>
            Stay
          </Button>
          <Button color="red" onClick={onLeave}>
            Leave
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
