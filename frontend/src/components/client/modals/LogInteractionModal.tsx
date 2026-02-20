import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  Stack,
  Select,
  Textarea,
  Button,
  Group,
  NumberInput,
  Checkbox,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { INTERACTION_TYPES, INTERACTION_OUTCOMES } from '../../../utils/constants';
import { useLogInteraction } from '../../../hooks/useClientData';
import { api } from '../../../utils/api';

interface LogInteractionModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: string;
}

export function LogInteractionModal({ opened, onClose, clientId }: LogInteractionModalProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number | string>('');
  const [outcome, setOutcome] = useState<string | null>(null);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [followUpKind, setFollowUpKind] = useState<'TASK' | 'REMINDER'>('TASK');
  const [followUpText, setFollowUpText] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpPriority, setFollowUpPriority] = useState('MEDIUM');
  const [followUpCategory, setFollowUpCategory] = useState('FOLLOW_UP');
  const [followUpOffsetValue, setFollowUpOffsetValue] = useState<number | string>(1);
  const [followUpOffsetUnit, setFollowUpOffsetUnit] = useState<string | null>('days');
  const [followUpOffsetTime, setFollowUpOffsetTime] = useState('09:00');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const logInteraction = useLogInteraction(clientId);
  const { data: activityTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['activity-templates'],
    queryFn: async () => {
      const response = await api.get('/activities/templates');
      if (!response.ok) throw new Error('Failed to fetch activity templates');
      return response.json() as Promise<Array<{
        id: string;
        name: string;
        config: any;
        autoFollowUp?: any;
      }>>;
    },
    enabled: opened,
  });

  const resetForm = () => {
    setType(null);
    setDescription('');
    setOccurredAt(null);
    setDuration('');
    setOutcome(null);
    setFollowUpNeeded(false);
    setSelectedTemplate(null);
    setFollowUpKind('TASK');
    setFollowUpText('');
    setFollowUpTitle('');
    setFollowUpPriority('MEDIUM');
    setFollowUpCategory('FOLLOW_UP');
    setFollowUpOffsetValue(1);
    setFollowUpOffsetUnit('days');
    setFollowUpOffsetTime('09:00');
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
    const followUpOffset = {
      value: Number(followUpOffsetValue) || 0,
      unit: followUpOffsetUnit || 'days',
      ...(followUpOffsetTime ? { atTime: followUpOffsetTime } : {}),
    };

    const followUp = followUpNeeded
      ? (followUpKind === 'TASK'
          ? {
              kind: 'TASK',
              ...(followUpText.trim() ? { text: followUpText.trim() } : {}),
              priority: followUpPriority,
              dueOffset: followUpOffset,
            }
          : {
              kind: 'REMINDER',
              ...(followUpTitle.trim() ? { title: followUpTitle.trim() } : {}),
              priority: followUpPriority,
              category: followUpCategory,
              remindOffset: followUpOffset,
            })
      : undefined;

    try {
      await logInteraction.mutateAsync({
        type,
        description: description.trim(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        occurredAt: occurredAt ? occurredAt.toISOString() : undefined,
        ...(selectedTemplate ? { templateId: selectedTemplate } : {}),
        ...(followUp ? { followUp } : {}),
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

  const handleSaveTemplate = async () => {
    if (!type || !description.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Type and description are required to save a template',
        color: 'red',
      });
      return;
    }
    const name = window.prompt('Template name');
    if (!name || !name.trim()) return;

    const metadata: Record<string, any> = {};
    if (duration) metadata.duration = Number(duration);
    if (outcome) metadata.outcome = outcome;

    const followUpOffset = {
      value: Number(followUpOffsetValue) || 0,
      unit: followUpOffsetUnit || 'days',
      ...(followUpOffsetTime ? { atTime: followUpOffsetTime } : {}),
    };

    const autoFollowUp = followUpNeeded
      ? (followUpKind === 'TASK'
          ? {
              kind: 'TASK',
              ...(followUpText.trim() ? { text: followUpText.trim() } : {}),
              priority: followUpPriority,
              dueOffset: followUpOffset,
            }
          : {
              kind: 'REMINDER',
              ...(followUpTitle.trim() ? { title: followUpTitle.trim() } : {}),
              priority: followUpPriority,
              category: followUpCategory,
              remindOffset: followUpOffset,
            })
      : null;

    setSavingTemplate(true);
    try {
      const response = await api.post('/activities/templates', {
        name: name.trim(),
        description: description.trim(),
        config: {
          type,
          description: description.trim(),
          ...(Object.keys(metadata).length ? { metadata } : {}),
        },
        autoFollowUp,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save activity template');
      }

      queryClient.invalidateQueries({ queryKey: ['activity-templates'] });
      notifications.show({
        title: 'Template Saved',
        message: 'Activity template saved successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save activity template',
        color: 'red',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const showDuration = type && ['CALL_PLACED', 'CALL_RECEIVED', 'MEETING'].includes(type);

  return (
    <Modal opened={opened} onClose={handleClose} title="Log Interaction" size="md">
      <Stack gap="md">
        <Select
          label="Use Template (optional)"
          placeholder={loadingTemplates ? 'Loading templates...' : 'Select a template'}
          data={activityTemplates.map((template) => ({ value: template.id, label: template.name }))}
          value={selectedTemplate}
          onChange={(value) => {
            setSelectedTemplate(value);
            const template = activityTemplates.find((item) => item.id === value);
            if (!template) return;
            if (template.config?.type) setType(template.config.type);
            if (template.config?.description) setDescription(template.config.description);
            if (template.config?.metadata?.duration) setDuration(template.config.metadata.duration as number);
            if (template.config?.metadata?.outcome) setOutcome(template.config.metadata.outcome as string);
            if (template.autoFollowUp) {
              setFollowUpNeeded(true);
              setFollowUpKind(template.autoFollowUp.kind || 'TASK');
              setFollowUpText(template.autoFollowUp.text || '');
              setFollowUpTitle(template.autoFollowUp.title || '');
              setFollowUpPriority(template.autoFollowUp.priority || 'MEDIUM');
              setFollowUpCategory(template.autoFollowUp.category || 'FOLLOW_UP');
              setFollowUpOffsetValue(template.autoFollowUp.dueOffset?.value ?? template.autoFollowUp.remindOffset?.value ?? 1);
              setFollowUpOffsetUnit(template.autoFollowUp.dueOffset?.unit ?? template.autoFollowUp.remindOffset?.unit ?? 'days');
              setFollowUpOffsetTime(template.autoFollowUp.dueOffset?.atTime ?? template.autoFollowUp.remindOffset?.atTime ?? '09:00');
            }
          }}
          clearable
          disabled={loadingTemplates}
        />
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
          <Stack gap="xs">
            <Select
              label="Follow-up Type"
              value={followUpKind}
              data={[
                { value: 'TASK', label: 'Task' },
                { value: 'REMINDER', label: 'Reminder' },
              ]}
              onChange={(value) => setFollowUpKind((value as 'TASK' | 'REMINDER') || 'TASK')}
            />
            {followUpKind === 'TASK' ? (
              <TextInput
                label="Default Task Text"
                placeholder="Optional"
                value={followUpText}
                onChange={(event) => setFollowUpText(event.currentTarget.value)}
              />
            ) : (
              <TextInput
                label="Default Reminder Title"
                placeholder="Optional"
                value={followUpTitle}
                onChange={(event) => setFollowUpTitle(event.currentTarget.value)}
              />
            )}
            <Group grow>
              <Select
                label="Priority"
                value={followUpPriority}
                data={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'URGENT', label: 'Urgent' },
                ]}
                onChange={(value) => setFollowUpPriority(value || 'MEDIUM')}
              />
              {followUpKind === 'REMINDER' && (
                <Select
                  label="Reminder Category"
                  value={followUpCategory}
                  data={[
                    { value: 'GENERAL', label: 'General' },
                    { value: 'CLIENT', label: 'Client' },
                    { value: 'COMPLIANCE', label: 'Compliance' },
                    { value: 'CLOSING', label: 'Closing' },
                    { value: 'FOLLOW_UP', label: 'Follow-up' },
                  ]}
                  onChange={(value) => setFollowUpCategory(value || 'FOLLOW_UP')}
                />
              )}
            </Group>
            <Group grow>
              <NumberInput
                label="Offset Value"
                value={followUpOffsetValue}
                onChange={setFollowUpOffsetValue}
                min={0}
              />
              <Select
                label="Offset Unit"
                value={followUpOffsetUnit}
                data={[
                  { value: 'minutes', label: 'Minutes' },
                  { value: 'hours', label: 'Hours' },
                  { value: 'days', label: 'Days' },
                ]}
                onChange={setFollowUpOffsetUnit}
              />
              <TextInput
                label="At Time (HH:MM)"
                value={followUpOffsetTime}
                onChange={(event) => setFollowUpOffsetTime(event.currentTarget.value)}
              />
            </Group>
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleSaveTemplate} loading={savingTemplate}>
            Save as Template
          </Button>
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
