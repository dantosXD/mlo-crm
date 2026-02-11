import { useState } from 'react';
import {
  Modal,
  Stack,
  Select,
  Textarea,
  Button,
  Group,
  NumberInput,
  Checkbox,
  Text,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { INTERACTION_TYPES, INTERACTION_OUTCOMES } from '../../../utils/constants';
import { useLogInteraction } from '../../../hooks/useClientData';

interface LogInteractionModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
}

export function LogInteractionModal({ opened, onClose, clientId }: LogInteractionModalProps) {
  const [type, setType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number | string>('');
  const [outcome, setOutcome] = useState<string | null>(null);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);

  const logInteraction = useLogInteraction(clientId);

  const resetForm = () => {
    setType(null);
    setDescription('');
    setOccurredAt(null);
    setDuration('');
    setOutcome(null);
    setFollowUpNeeded(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!type || !description.trim()) {
      notifications.show({
        title: 'Missing Fields',
        message: 'Please select a type and enter a description.',
        color: 'orange',
      });
      return;
    }

    const metadata: Record<string, any> = {};
    if (duration) metadata.duration = Number(duration);
    if (outcome) metadata.outcome = outcome;
    if (followUpNeeded) metadata.followUpNeeded = true;

    try {
      await logInteraction.mutateAsync({
        type,
        description: description.trim(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        occurredAt: occurredAt ? occurredAt.toISOString() : undefined,
      });

      notifications.show({
        title: 'Interaction Logged',
        message: 'The interaction has been recorded in the activity timeline.',
        color: 'green',
      });

      handleClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to log interaction. Please try again.',
        color: 'red',
      });
    }
  };

  const showDuration = type && ['CALL_PLACED', 'CALL_RECEIVED', 'MEETING'].includes(type);

  return (
    <Modal opened={opened} onClose={handleClose} title="Log Interaction" size="md">
      <Stack gap="md">
        <Select
          label="Interaction Type"
          placeholder="Select type..."
          data={INTERACTION_TYPES}
          value={type}
          onChange={setType}
          required
        />

        <Textarea
          label="Description"
          placeholder="Describe the interaction..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={3}
          maxLength={2000}
          required
          description={description.length > 1800 ? `${description.length}/2000 characters` : undefined}
        />

        <DateTimePicker
          label="Date & Time"
          placeholder="Defaults to now"
          value={occurredAt}
          onChange={setOccurredAt}
          clearable
          maxDate={new Date()}
        />

        {showDuration && (
          <NumberInput
            label="Duration (minutes)"
            placeholder="Optional"
            value={duration}
            onChange={setDuration}
            min={0}
            max={480}
          />
        )}

        <Select
          label="Outcome"
          placeholder="Optional"
          data={INTERACTION_OUTCOMES}
          value={outcome}
          onChange={setOutcome}
          clearable
        />

        <Checkbox
          label="Follow-up needed"
          checked={followUpNeeded}
          onChange={(e) => setFollowUpNeeded(e.currentTarget.checked)}
        />

        {followUpNeeded && (
          <Text size="xs" c="dimmed">
            After logging, you can create a follow-up task or reminder from the activity timeline.
          </Text>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={logInteraction.isPending}>
            Log Interaction
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
