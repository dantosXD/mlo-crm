import React, { useEffect, useState } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Checkbox,
  Button,
  Text,
  Group,
  Paper,
  Alert,
  MultiSelect,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../utils/api';

interface ActionConfigPanelProps {
  actionType: string;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

// Action type categories and their configurations
const ACTION_CATEGORIES = {
  Communication: ['SEND_EMAIL', 'SEND_SMS', 'GENERATE_LETTER'],
  Task: ['CREATE_TASK', 'COMPLETE_TASK', 'ASSIGN_TASK'],
  Client: ['UPDATE_CLIENT_STATUS', 'ADD_TAG', 'REMOVE_TAG', 'ASSIGN_CLIENT'],
  Document: ['UPDATE_DOCUMENT_STATUS', 'REQUEST_DOCUMENT'],
  Note: ['CREATE_NOTE'],
  Notification: ['SEND_NOTIFICATION', 'LOG_ACTIVITY'],
  FlowControl: ['WAIT', 'BRANCH', 'PARALLEL'],
  Webhook: ['CALL_WEBHOOK'],
};

// Template selections for communication actions
const COMMUNICATION_TEMPLATE_PLACEHOLDERS = {
  SEND_EMAIL: 'Select an email template',
  SEND_SMS: 'Select an SMS template',
  GENERATE_LETTER: 'Select a letter template',
};

export default function ActionConfigPanel({ actionType, config, onChange }: ActionConfigPanelProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch communication templates for communication actions
  const { data: emailTemplates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const response = await apiRequest('/communications/templates/email');
      if (!response.ok) throw new Error('Failed to fetch email templates');
      return response.json();
    },
    enabled: actionType === 'SEND_EMAIL',
  });

  const { data: smsTemplates } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: async () => {
      const response = await apiRequest('/communications/templates/sms');
      if (!response.ok) throw new Error('Failed to fetch SMS templates');
      return response.json();
    },
    enabled: actionType === 'SEND_SMS',
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiRequest('/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: ['CREATE_TASK', 'ASSIGN_TASK', 'ASSIGN_CLIENT', 'SEND_NOTIFICATION'].includes(actionType),
  });

  // Validate configuration based on action type
  useEffect(() => {
    const errors: Record<string, string> = {};

    switch (actionType) {
      case 'SEND_EMAIL':
        if (!config.templateId) errors.templateId = 'Email template is required';
        break;
      case 'SEND_SMS':
        if (!config.templateId) errors.templateId = 'SMS template is required';
        break;
      case 'CREATE_TASK':
        if (!config.text) errors.text = 'Task description is required';
        break;
      case 'UPDATE_CLIENT_STATUS':
        if (!config.status) errors.status = 'Status is required';
        break;
      case 'CALL_WEBHOOK':
        if (!config.url) errors.url = 'Webhook URL is required';
        break;
    }

    setValidationErrors(errors);
  }, [actionType, config]);

  const updateConfig = (key: string, value: any) => {
    onChange({ ...config, [key]: value });
  };

  // Render action-specific configuration fields
  const renderConfigFields = () => {
    switch (actionType) {
      case 'SEND_EMAIL':
      case 'SEND_SMS':
        return (
          <Stack gap="sm">
            <Select
              label={actionType === 'SEND_EMAIL' ? 'Email Template' : 'SMS Template'}
              placeholder={COMMUNICATION_TEMPLATE_PLACEHOLDERS[actionType as keyof typeof COMMUNICATION_TEMPLATE_PLACEHOLDERS]}
              data={
                actionType === 'SEND_EMAIL'
                  ? emailTemplates?.templates?.map((t: any) => ({ value: t.id, label: t.name })) || []
                  : smsTemplates?.templates?.map((t: any) => ({ value: t.id, label: t.name })) || []
              }
              value={config.templateId || ''}
              onChange={(value) => updateConfig('templateId', value)}
              error={validationErrors.templateId}
              required
            />
            <TextInput
              label={actionType === 'SEND_EMAIL' ? 'To Email' : 'To Phone'}
              placeholder={actionType === 'SEND_EMAIL' ? 'Leave blank to use client email' : 'Leave blank to use client phone'}
              value={config.to || ''}
              onChange={(e) => updateConfig('to', e.currentTarget.value)}
            />
          </Stack>
        );

      case 'CREATE_TASK':
        return (
          <Stack gap="sm">
            <Textarea
              label="Task Description"
              placeholder="Enter task description"
              value={config.text || ''}
              onChange={(e) => updateConfig('text', e.currentTarget.value)}
              error={validationErrors.text}
              required
              minRows={2}
            />
            <Select
              label="Priority"
              data={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
              ]}
              value={config.priority || 'MEDIUM'}
              onChange={(value) => updateConfig('priority', value)}
            />
            <NumberInput
              label="Due In (Days)"
              placeholder="7"
              value={config.dueDays || 7}
              onChange={(value) => updateConfig('dueDays', value)}
              min={0}
            />
            <Select
              label="Assign To"
              placeholder="Leave blank to assign to workflow creator"
              data={users?.users?.map((u: any) => ({ value: u.id, label: u.name })) || []}
              value={config.assignedToId || ''}
              onChange={(value) => updateConfig('assignedToId', value)}
              clearable
            />
          </Stack>
        );

      case 'UPDATE_CLIENT_STATUS':
        return (
          <Stack gap="sm">
            <Select
              label="Status"
              data={[
                { value: 'LEAD', label: 'Lead' },
                { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PROCESSING', label: 'Processing' },
                { value: 'UNDERWRITING', label: 'Underwriting' },
                { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
                { value: 'CLOSED', label: 'Closed' },
                { value: 'DENIED', label: 'Denied' },
              ]}
              value={config.status || ''}
              onChange={(value) => updateConfig('status', value)}
              error={validationErrors.status}
              required
            />
          </Stack>
        );

      case 'ADD_TAG':
      case 'REMOVE_TAG':
        return (
          <Stack gap="sm">
            <TextInput
              label="Tags"
              placeholder="tag1, tag2, tag3"
              value={config.tags || ''}
              onChange={(e) => updateConfig('tags', e.currentTarget.value)}
              required
            />
            <Text size="xs" c="dimmed">
              Enter comma-separated tags
            </Text>
          </Stack>
        );

      case 'ASSIGN_CLIENT':
        return (
          <Stack gap="sm">
            <Select
              label="Assign To"
              data={users?.users?.map((u: any) => ({ value: u.id, label: u.name })) || []}
              value={config.assignedToId || ''}
              onChange={(value) => updateConfig('assignedToId', value)}
              error={validationErrors.assignedToId}
              required
            />
          </Stack>
        );

      case 'REQUEST_DOCUMENT':
        return (
          <Stack gap="sm">
            <Select
              label="Document Category"
              data={[
                { value: 'INCOME', label: 'Income' },
                { value: 'EMPLOYMENT', label: 'Employment' },
                { value: 'ASSETS', label: 'Assets' },
                { value: 'PROPERTY', label: 'Property' },
                { value: 'INSURANCE', label: 'Insurance' },
                { value: 'CREDIT', label: 'Credit' },
                { value: 'OTHER', label: 'Other' },
              ]}
              value={config.category || ''}
              onChange={(value) => updateConfig('category', value)}
              required
            />
            <TextInput
              label="Document Name"
              placeholder="e.g., Pay Stub, Bank Statement"
              value={config.name || ''}
              onChange={(e) => updateConfig('name', e.currentTarget.value)}
              required
            />
            <NumberInput
              label="Due In (Days)"
              placeholder="7"
              value={config.dueDays || 7}
              onChange={(value) => updateConfig('dueDays', value)}
              min={0}
            />
          </Stack>
        );

      case 'CREATE_NOTE':
        return (
          <Stack gap="sm">
            <Textarea
              label="Note Text"
              placeholder="Enter note content"
              value={config.text || ''}
              onChange={(e) => updateConfig('text', e.currentTarget.value)}
              required
              minRows={3}
            />
            <TextInput
              label="Tags"
              placeholder="tag1, tag2"
              value={config.tags || ''}
              onChange={(e) => updateConfig('tags', e.currentTarget.value)}
            />
          </Stack>
        );

      case 'SEND_NOTIFICATION':
        return (
          <Stack gap="sm">
            <Select
              label="User"
              placeholder="Leave blank to notify workflow creator"
              data={users?.users?.map((u: any) => ({ value: u.id, label: u.name })) || []}
              value={config.userId || ''}
              onChange={(value) => updateConfig('userId', value)}
              clearable
            />
            <TextInput
              label="Title"
              placeholder="Notification title"
              value={config.title || ''}
              onChange={(e) => updateConfig('title', e.currentTarget.value)}
              required
            />
            <Textarea
              label="Message"
              placeholder="Notification message"
              value={config.message || ''}
              onChange={(e) => updateConfig('message', e.currentTarget.value)}
              required
              minRows={2}
            />
            <TextInput
              label="Link"
              placeholder="Optional link URL"
              value={config.link || ''}
              onChange={(e) => updateConfig('link', e.currentTarget.value)}
            />
          </Stack>
        );

      case 'CALL_WEBHOOK':
        return (
          <Stack gap="sm">
            <TextInput
              label="Webhook URL"
              placeholder="https://api.example.com/webhook"
              value={config.url || ''}
              onChange={(e) => updateConfig('url', e.currentTarget.value)}
              error={validationErrors.url}
              required
            />
            <Select
              label="HTTP Method"
              data={[
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
                { value: 'PATCH', label: 'PATCH' },
                { value: 'DELETE', label: 'DELETE' },
              ]}
              value={config.method || 'POST'}
              onChange={(value) => updateConfig('method', value)}
            />
            <Textarea
              label="Headers (JSON)"
              placeholder='{"Authorization": "Bearer token"}'
              value={config.headers || ''}
              onChange={(e) => updateConfig('headers', e.currentTarget.value)}
              minRows={2}
            />
            <Textarea
              label="Body Template"
              placeholder='{"client_name": "{{client_name}}"}'
              value={config.bodyTemplate || ''}
              onChange={(e) => updateConfig('bodyTemplate', e.currentTarget.value)}
              minRows={3}
            />
            <Checkbox
              label="Retry on Failure"
              checked={config.retryOnFailure !== false}
              onChange={(e) => updateConfig('retryOnFailure', e.currentTarget.checked)}
            />
            {config.retryOnFailure !== false && (
              <>
                <NumberInput
                  label="Max Retries"
                  value={config.maxRetries || 3}
                  onChange={(value) => updateConfig('maxRetries', value)}
                  min={1}
                  max={10}
                />
                <NumberInput
                  label="Retry Delay (Seconds)"
                  value={config.retryDelaySeconds || 5}
                  onChange={(value) => updateConfig('retryDelaySeconds', value)}
                  min={1}
                />
                <NumberInput
                  label="Timeout (Seconds)"
                  value={config.timeoutSeconds || 30}
                  onChange={(value) => updateConfig('timeoutSeconds', value)}
                  min={5}
                  max={300}
                />
              </>
            )}
          </Stack>
        );

      case 'WAIT':
        return (
          <Stack gap="sm">
            <NumberInput
              label="Duration"
              value={config.duration || 1}
              onChange={(value) => updateConfig('duration', value)}
              min={1}
              required
            />
            <Select
              label="Unit"
              data={[
                { value: 'minutes', label: 'Minutes' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
              ]}
              value={config.unit || 'hours'}
              onChange={(value) => updateConfig('unit', value)}
              required
            />
          </Stack>
        );

      case 'BRANCH':
        return (
          <Stack gap="sm">
            <TextInput
              label="Variable"
              placeholder="e.g., client.status"
              value={config.variable || ''}
              onChange={(e) => updateConfig('variable', e.currentTarget.value)}
              required
            />
            <Select
              label="Operator"
              data={[
                { value: 'equals', label: 'Equals' },
                { value: 'notEquals', label: 'Not Equals' },
                { value: 'greaterThan', label: 'Greater Than' },
                { value: 'lessThan', label: 'Less Than' },
                { value: 'contains', label: 'Contains' },
              ]}
              value={config.operator || 'equals'}
              onChange={(value) => updateConfig('operator', value)}
              required
            />
            <TextInput
              label="Value"
              placeholder="Value to compare against"
              value={config.value || ''}
              onChange={(e) => updateConfig('value', e.currentTarget.value)}
              required
            />
          </Stack>
        );

      default:
        return (
          <Text size="sm" c="dimmed">
            No configuration options available for this action type.
          </Text>
        );
    }
  };

  return (
    <Stack gap="md">
      {Object.keys(validationErrors).length > 0 && (
        <Alert icon={<IconAlertCircle size="1rem" />} color="red" title="Validation Errors">
          {Object.values(validationErrors).map((error, idx) => (
            <div key={idx}>{error}</div>
          ))}
        </Alert>
      )}

      <Paper withBorder p="sm" bg="gray.0">
        <Group>
          <Text fw={600} size="sm">
            Action Type:
          </Text>
          <Text size="sm">{actionType}</Text>
        </Group>
      </Paper>

      {renderConfigFields()}
    </Stack>
  );
}
