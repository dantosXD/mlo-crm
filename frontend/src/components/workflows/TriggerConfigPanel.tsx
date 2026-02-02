import React, { useState } from 'react';
import {
  Stack,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Text,
  Paper,
  Alert,
  Badge,
  Group,
  Code,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconClock,
  IconCalendar,
  IconUsers,
  IconFile,
  IconCheck,
  IconAlertTriangle,
  IconWebhook,
} from '@tabler/icons-react';

interface TriggerConfigPanelProps {
  triggerType: string;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export default function TriggerConfigPanel({
  triggerType,
  config,
  onChange,
}: TriggerConfigPanelProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Trigger type definitions
  const triggerInfo: Record<string, { description: string; icon: any; color: string }> = {
    MANUAL: {
      description: 'Manually triggered by user action',
      icon: IconCheck,
      color: 'gray',
    },
    CLIENT_CREATED: {
      description: 'Fires when a new client is created',
      icon: IconUsers,
      color: 'blue',
    },
    CLIENT_UPDATED: {
      description: 'Fires when client information is updated',
      icon: IconUsers,
      color: 'cyan',
    },
    CLIENT_STATUS_CHANGED: {
      description: 'Fires when a client status changes',
      icon: IconCheck,
      color: 'green',
    },
    CLIENT_INACTIVITY: {
      description: 'Fires when a client has been inactive for a specified period',
      icon: IconClock,
      color: 'orange',
    },
    PIPELINE_STAGE_ENTRY: {
      description: 'Fires when a client enters a pipeline stage',
      icon: IconCheck,
      color: 'blue',
    },
    PIPELINE_STAGE_EXIT: {
      description: 'Fires when a client exits a pipeline stage',
      icon: IconCheck,
      color: 'blue',
    },
    TIME_IN_STAGE_THRESHOLD: {
      description: 'Fires when a client has been in a stage too long',
      icon: IconClock,
      color: 'red',
    },
    DOCUMENT_UPLOADED: {
      description: 'Fires when a document is uploaded',
      icon: IconFile,
      color: 'green',
    },
    DOCUMENT_STATUS_CHANGED: {
      description: 'Fires when a document status changes',
      icon: IconFile,
      color: 'cyan',
    },
    DOCUMENT_DUE_DATE: {
      description: 'Fires when a document due date is approaching',
      icon: IconCalendar,
      color: 'orange',
    },
    DOCUMENT_EXPIRED: {
      description: 'Fires when a document expires',
      icon: IconAlertTriangle,
      color: 'red',
    },
    TASK_CREATED: {
      description: 'Fires when a task is created',
      icon: IconCheck,
      color: 'blue',
    },
    TASK_COMPLETED: {
      description: 'Fires when a task is marked complete',
      icon: IconCheck,
      color: 'green',
    },
    TASK_OVERDUE: {
      description: 'Fires when a task becomes overdue',
      icon: IconAlertTriangle,
      color: 'red',
    },
    TASK_DUE: {
      description: 'Fires when a task due date is approaching',
      icon: IconCalendar,
      color: 'orange',
    },
    TASK_ASSIGNED: {
      description: 'Fires when a task is assigned to a user',
      icon: IconUsers,
      color: 'blue',
    },
    NOTE_CREATED: {
      description: 'Fires when a note is created',
      icon: IconFile,
      color: 'blue',
    },
    NOTE_WITH_TAG: {
      description: 'Fires when a note is created with a specific tag',
      icon: IconFile,
      color: 'purple',
    },
    WEBHOOK: {
      description: 'Triggered by an external webhook call',
      icon: IconWebhook,
      color: 'grape',
    },
    SCHEDULED: {
      description: 'Runs on a schedule (hourly, daily, weekly, monthly)',
      icon: IconClock,
      color: 'indigo',
    },
  };

  const info = triggerInfo[triggerType] || {
    description: 'Custom trigger',
    icon: IconInfoCircle,
    color: 'gray',
  };

  const IconComponent = info.icon;

  // Update config value
  const updateConfig = (key: string, value: any) => {
    onChange({
      ...config,
      [key]: value,
    });
    // Clear error for this field if it exists
    if (errors[key]) {
      setErrors({
        ...errors,
        [key]: '',
      });
    }
  };

  // Render configuration fields based on trigger type
  const renderConfigFields = () => {
    switch (triggerType) {
      case 'CLIENT_STATUS_CHANGED':
        return (
          <Stack gap="sm">
            <Select
              label="From Status"
              placeholder="Any previous status"
              data={[
                { value: '', label: 'Any Status' },
                { value: 'LEAD', label: 'Lead' },
                { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PROCESSING', label: 'Processing' },
                { value: 'UNDERWRITING', label: 'Underwriting' },
                { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
                { value: 'CLOSED', label: 'Closed' },
                { value: 'DENIED', label: 'Denied' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={config.fromStatus || ''}
              onChange={(value) => updateConfig('fromStatus', value)}
              clearable
            />
            <Select
              label="To Status"
              placeholder="Any new status"
              data={[
                { value: '', label: 'Any Status' },
                { value: 'LEAD', label: 'Lead' },
                { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PROCESSING', label: 'Processing' },
                { value: 'UNDERWRITING', label: 'Underwriting' },
                { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
                { value: 'CLOSED', label: 'Closed' },
                { value: 'DENIED', label: 'Denied' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={config.toStatus || ''}
              onChange={(value) => updateConfig('toStatus', value)}
              clearable
            />
          </Stack>
        );

      case 'CLIENT_INACTIVITY':
        return (
          <Stack gap="sm">
            <NumberInput
              label="Inactive Days Threshold"
              description="Trigger fires after client has been inactive for this many days"
              placeholder="7"
              min={1}
              max={365}
              value={config.inactiveDays || 7}
              onChange={(value) => updateConfig('inactiveDays', value || 7)}
            />
            <Text size="xs" c="dimmed">
              Example: Set to 7 to trigger workflows for clients who haven't been updated in 7+ days
            </Text>
          </Stack>
        );

      case 'PIPELINE_STAGE_ENTRY':
      case 'PIPELINE_STAGE_EXIT':
        return (
          <Stack gap="sm">
            <Select
              label="Pipeline Stage"
              description={`Trigger fires when a client ${
                triggerType === 'PIPELINE_STAGE_ENTRY' ? 'enters' : 'exits'
              } this stage`}
              placeholder="Select stage"
              data={[
                { value: 'LEAD', label: 'Lead' },
                { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PROCESSING', label: 'Processing' },
                { value: 'UNDERWRITING', label: 'Underwriting' },
                { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
              value={config.stage || ''}
              onChange={(value) => updateConfig('stage', value)}
              required
            />
          </Stack>
        );

      case 'TIME_IN_STAGE_THRESHOLD':
        return (
          <Stack gap="sm">
            <Select
              label="Target Stage"
              placeholder="All stages"
              data={[
                { value: '', label: 'All Stages' },
                { value: 'LEAD', label: 'Lead' },
                { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PROCESSING', label: 'Processing' },
                { value: 'UNDERWRITING', label: 'Underwriting' },
                { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
              ]}
              value={config.stage || ''}
              onChange={(value) => updateConfig('stage', value)}
              clearable
            />
            <NumberInput
              label="Threshold (Days)"
              description="Number of days in stage before triggering"
              placeholder="30"
              min={1}
              max={365}
              value={config.thresholdDays || 30}
              onChange={(value) => updateConfig('thresholdDays', value || 30)}
            />
          </Stack>
        );

      case 'DOCUMENT_STATUS_CHANGED':
        return (
          <Stack gap="sm">
            <Select
              label="From Status"
              placeholder="Any previous status"
              data={[
                { value: '', label: 'Any Status' },
                { value: 'REQUIRED', label: 'Required' },
                { value: 'REQUESTED', label: 'Requested' },
                { value: 'UPLOADED', label: 'Uploaded' },
                { value: 'UNDER_REVIEW', label: 'Under Review' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
              value={config.fromStatus || ''}
              onChange={(value) => updateConfig('fromStatus', value)}
              clearable
            />
            <Select
              label="To Status"
              placeholder="Any new status"
              data={[
                { value: '', label: 'Any Status' },
                { value: 'REQUIRED', label: 'Required' },
                { value: 'REQUESTED', label: 'Requested' },
                { value: 'UPLOADED', label: 'Uploaded' },
                { value: 'UNDER_REVIEW', label: 'Under Review' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
              value={config.toStatus || ''}
              onChange={(value) => updateConfig('toStatus', value)}
              clearable
            />
            <Select
              label="Document Category"
              placeholder="All categories"
              data={[
                { value: '', label: 'All Categories' },
                { value: 'Income', label: 'Income' },
                { value: 'Employment', label: 'Employment' },
                { value: 'Assets', label: 'Assets' },
                { value: 'Property', label: 'Property' },
                { value: 'Insurance', label: 'Insurance' },
                { value: 'Credit', label: 'Credit' },
                { value: 'Other', label: 'Other' },
              ]}
              value={config.category || ''}
              onChange={(value) => updateConfig('category', value)}
              clearable
            />
          </Stack>
        );

      case 'DOCUMENT_DUE_DATE':
        return (
          <Stack gap="sm">
            <NumberInput
              label="Days Before Due Date"
              description="Trigger fires this many days before the due date"
              placeholder="3"
              min={0}
              max={30}
              value={config.daysBefore || 3}
              onChange={(value) => updateConfig('daysBefore', value || 3)}
            />
            <NumberInput
              label="Days After Due Date"
              description="Also trigger this many days after the due date"
              placeholder="0"
              min={0}
              max={30}
              value={config.daysAfter || 0}
              onChange={(value) => updateConfig('daysAfter', value || 0)}
            />
            <Text size="xs" c="dimmed">
              Example: Days Before: 3, Days After: 0 will trigger 3 days before due date only
            </Text>
          </Stack>
        );

      case 'TASK_OVERDUE':
        return (
          <Stack gap="sm">
            <NumberInput
              label="Days Threshold"
              description="Trigger only for tasks overdue by this many days or more"
              placeholder="0"
              min={0}
              max={365}
              value={config.daysThreshold || 0}
              onChange={(value) => updateConfig('daysThreshold', value || 0)}
            />
            <Text size="xs" c="dimmed">
              Set to 0 to trigger for all overdue tasks. Set to 7 to only trigger for tasks 7+ days overdue.
            </Text>
          </Stack>
        );

      case 'TASK_DUE':
        return (
          <Stack gap="sm">
            <NumberInput
              label="Days Before Due Date"
              description="Trigger fires this many days before the task due date"
              placeholder="1"
              min={0}
              max={30}
              value={config.daysBefore || 1}
              onChange={(value) => updateConfig('daysBefore', value || 1)}
            />
          </Stack>
        );

      case 'NOTE_WITH_TAG':
        return (
          <Stack gap="sm">
            <TextInput
              label="Tag"
              description="Trigger fires when a note is created with this tag"
              placeholder="e.g., follow-up, urgent"
              value={config.tag || ''}
              onChange={(e) => updateConfig('tag', e.currentTarget.value)}
              required
            />
            <Text size="xs" c="dimmed">
              Case-sensitive. The note must have this exact tag to trigger the workflow.
            </Text>
          </Stack>
        );

      case 'WEBHOOK':
        return (
          <Stack gap="sm">
            <Alert color="blue" icon={<IconInfoCircle size={16} />}>
              <Text size="sm">
                <strong>Webhook URL:</strong>{' '}
                <Code>{`${window.location.origin}/api/workflows/webhook/{workflow_id}`}</Code>
              </Text>
              <Text size="sm" mt="xs">
                This endpoint will accept POST requests with JSON payload.
              </Text>
            </Alert>
            <TextInput
              label="Webhook Secret"
              description="Optional secret for verifying webhook signatures"
              placeholder="Leave blank to auto-generate"
              value={config.webhookSecret || ''}
              onChange={(e) => updateConfig('webhookSecret', e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              If provided, webhooks must include an X-Webhook-Signature header with HMAC-SHA256 signature.
            </Text>
          </Stack>
        );

      case 'SCHEDULED':
        return (
          <Stack gap="sm">
            <Select
              label="Schedule"
              description="How often this workflow should run"
              data={[
                { value: 'hourly', label: 'Hourly' },
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              value={config.schedule || 'daily'}
              onChange={(value) => updateConfig('schedule', value)}
              required
            />
            {(config.schedule === 'daily' || config.schedule === 'weekly' || config.schedule === 'monthly') && (
              <TextInput
                label="Time"
                description="What time to run (24-hour format)"
                placeholder="00:00"
                value={config.time || '00:00'}
                onChange={(e) => updateConfig('time', e.currentTarget.value)}
                pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
              />
            )}
            {config.schedule === 'weekly' && (
              <Select
                label="Day of Week"
                data={[
                  { value: '0', label: 'Sunday' },
                  { value: '1', label: 'Monday' },
                  { value: '2', label: 'Tuesday' },
                  { value: '3', label: 'Wednesday' },
                  { value: '4', label: 'Thursday' },
                  { value: '5', label: 'Friday' },
                  { value: '6', label: 'Saturday' },
                ]}
                value={config.dayOfWeek || '1'}
                onChange={(value) => updateConfig('dayOfWeek', value)}
              />
            )}
            {config.schedule === 'monthly' && (
              <NumberInput
                label="Day of Month"
                description="Day of the month to run (1-31)"
                min={1}
                max={31}
                value={config.dayOfMonth || 1}
                onChange={(value) => updateConfig('dayOfMonth', value || 1)}
              />
            )}
          </Stack>
        );

      case 'MANUAL':
      case 'CLIENT_CREATED':
      case 'CLIENT_UPDATED':
      case 'DOCUMENT_UPLOADED':
      case 'DOCUMENT_EXPIRED':
      case 'TASK_CREATED':
      case 'TASK_COMPLETED':
      case 'TASK_ASSIGNED':
      case 'NOTE_CREATED':
      default:
        return (
          <Text size="sm" c="dimmed">
            This trigger type has no additional configuration options. It will fire automatically
            when the corresponding event occurs.
          </Text>
        );
    }
  };

  return (
    <Stack gap="md">
      {/* Trigger Description */}
      <Paper withBorder p="sm" bg="gray.0">
        <Group gap="sm">
          <IconComponent size={20} color={`var(--mantine-color-${info.color}-filled)`} />
          <div>
            <Text size="sm" fw={600}>
              {triggerType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
            </Text>
            <Text size="xs" c="dimmed">
              {info.description}
            </Text>
          </div>
        </Group>
      </Paper>

      {/* Configuration Fields */}
      {renderConfigFields()}

      {/* Example Usage */}
      {triggerType !== 'MANUAL' && (
        <Alert color="blue" icon={<IconInfoCircle size={16} />}>
          <Text size="sm" fw={600}>
            Example Usage:
          </Text>
          <Text size="xs" mt="xs">
            {triggerType === 'CLIENT_STATUS_CHANGED' &&
              'Create a workflow that sends a welcome email when a client status changes to ACTIVE.'}
            {triggerType === 'DOCUMENT_DUE_DATE' &&
              'Send a reminder email 3 days before documents are due.'}
            {triggerType === 'TASK_OVERDUE' &&
              'Notify the manager when tasks are 7+ days overdue.'}
            {triggerType === 'SCHEDULED' &&
              'Generate a daily report of all active clients at 9:00 AM.'}
            {triggerType === 'WEBHOOK' &&
              'Integrate with external services by calling this webhook URL.'}
            {triggerType === 'CLIENT_INACTIVITY' &&
              'Send a follow-up email to clients who haven been inactive for 14+ days.'}
            {triggerType === 'TIME_IN_STAGE_THRESHOLD' &&
              'Alert when clients have been in UNDERWRITING stage for 30+ days.'}
            {![
              'CLIENT_STATUS_CHANGED',
              'DOCUMENT_DUE_DATE',
              'TASK_OVERDUE',
              'SCHEDULED',
              'WEBHOOK',
              'CLIENT_INACTIVITY',
              'TIME_IN_STAGE_THRESHOLD',
            ].includes(triggerType) &&
              `Use this trigger to automate actions when a ${triggerType
                .replace(/_/g, ' ')
                .toLowerCase()} event occurs.`}
          </Text>
        </Alert>
      )}
    </Stack>
  );
}
