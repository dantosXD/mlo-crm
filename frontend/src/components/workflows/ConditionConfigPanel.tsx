import React, { useState } from 'react';
import {
  Stack,
  TextInput,
  Select,
  NumberInput,
  Text,
  Paper,
  Alert,
  Badge,
  Group,
  Button,
  Cards,
  Card,
  Accordion,
  ColorInput,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconTag,
  IconUser,
  IconClock,
  IconCalendar,
  IconFile,
  IconCheck,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';

interface ConditionConfigPanelProps {
  condition: any;
  onChange: (condition: any) => void;
}

export default function ConditionConfigPanel({
  condition,
  onChange,
}: ConditionConfigPanelProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Condition type definitions
  const conditionTypes = [
    {
      group: 'Client Conditions',
      types: [
        { value: 'CLIENT_STATUS_EQUALS', label: 'Client Status Equals', icon: IconCheck, color: 'blue' },
        { value: 'CLIENT_HAS_TAG', label: 'Client Has Tag', icon: IconTag, color: 'grape' },
        { value: 'CLIENT_AGE_DAYS', label: 'Client Age (Days)', icon: IconCalendar, color: 'orange' },
        { value: 'CLIENT_MISSING_DOCUMENTS', label: 'Client Missing Documents', icon: IconFile, color: 'red' },
      ],
    },
    {
      group: 'Document Conditions',
      types: [
        { value: 'DOCUMENT_COUNT', label: 'Document Count', icon: IconFile, color: 'cyan' },
        { value: 'DOCUMENT_MISSING', label: 'Document Missing', icon: IconFile, color: 'red' },
      ],
    },
    {
      group: 'Task Conditions',
      types: [
        { value: 'TASK_COUNT', label: 'Task Count', icon: IconCheck, color: 'blue' },
        { value: 'TASK_OVERDUE_EXISTS', label: 'Task Overdue Exists', icon: IconClock, color: 'orange' },
      ],
    },
    {
      group: 'Loan Conditions',
      types: [
        { value: 'LOAN_AMOUNT_THRESHOLD', label: 'Loan Amount Threshold', icon: IconCheck, color: 'green' },
      ],
    },
    {
      group: 'User Conditions',
      types: [
        { value: 'USER_ROLE_EQUALS', label: 'User Role Equals', icon: IconUser, color: 'indigo' },
      ],
    },
    {
      group: 'Time Conditions',
      types: [
        { value: 'TIME_OF_DAY', label: 'Time of Day', icon: IconClock, color: 'cyan' },
        { value: 'DAY_OF_WEEK', label: 'Day of Week', icon: IconCalendar, color: 'purple' },
      ],
    },
    {
      group: 'Logic Conditions',
      types: [
        { value: 'AND', label: 'AND (All conditions must match)', icon: IconCheck, color: 'green' },
        { value: 'OR', label: 'OR (Any condition must match)', icon: IconCheck, color: 'yellow' },
      ],
    },
  ];

  // Get current condition type info
  const getCurrentTypeInfo = () => {
    for (const group of conditionTypes) {
      const type = group.types.find((t) => t.value === condition.type);
      if (type) return type;
    }
    return null;
  };

  const typeInfo = getCurrentTypeInfo();

  // Update condition value
  const updateCondition = (key: string, value: any) => {
    onChange({
      ...condition,
      [key]: value,
    });
    if (errors[key]) {
      setErrors({
        ...errors,
        [key]: '',
      });
    }
  };

  // Add nested condition
  const addNestedCondition = () => {
    const newCondition = {
      type: 'CLIENT_STATUS_EQUALS',
      value: 'LEAD',
    };
    onChange({
      ...condition,
      conditions: [...(condition.conditions || []), newCondition],
    });
  };

  // Remove nested condition
  const removeNestedCondition = (index: number) => {
    onChange({
      ...condition,
      conditions: condition.conditions?.filter((_: any, i: number) => i !== index) || [],
    });
  };

  // Update nested condition
  const updateNestedCondition = (index: number, nestedCondition: any) => {
    const newConditions = [...(condition.conditions || [])];
    newConditions[index] = nestedCondition;
    onChange({
      ...condition,
      conditions: newConditions,
    });
  };

  // Render configuration fields based on condition type
  const renderConfigFields = () => {
    switch (condition.type) {
      case 'CLIENT_STATUS_EQUALS':
        return (
          <Stack gap="sm">
            <Select
              label="Status"
              description="Client must have this status"
              data={[
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
              value={condition.value || ''}
              onChange={(value) => updateCondition('value', value)}
              required
            />
          </Stack>
        );

      case 'CLIENT_HAS_TAG':
        return (
          <Stack gap="sm">
            <TextInput
              label="Tag"
              description="Client must have this tag"
              placeholder="e.g., vip, hot-lead, follow-up"
              value={condition.value || ''}
              onChange={(e) => updateCondition('value', e.currentTarget.value)}
              required
            />
            <Text size="xs" c="dimmed">
              Case-sensitive. The client must have this exact tag.
            </Text>
          </Stack>
        );

      case 'CLIENT_AGE_DAYS':
        return (
          <Stack gap="sm">
            <Select
              label="Operator"
              data={[
                { value: 'greater_than', label: 'Greater than (>)' },
                { value: 'less_than', label: 'Less than (<)' },
                { value: 'equals', label: 'Equals (=)' },
              ]}
              value={condition.operator || 'greater_than'}
              onChange={(value) => updateCondition('operator', value)}
              required
            />
            <NumberInput
              label="Days"
              description="Client age in days"
              placeholder="30"
              min={0}
              value={condition.value || 0}
              onChange={(value) => updateCondition('value', value || 0)}
              required
            />
            <Text size="xs" c="dimmed">
              Example: Greater than 30 days means the client was created more than 30 days ago.
            </Text>
          </Stack>
        );

      case 'CLIENT_MISSING_DOCUMENTS':
        return (
          <Stack gap="sm">
            <Select
              label="Document Category"
              description="Check if client is missing documents of this category"
              data={[
                { value: 'Income', label: 'Income' },
                { value: 'Employment', label: 'Employment' },
                { value: 'Assets', label: 'Assets' },
                { value: 'Property', label: 'Property' },
                { value: 'Insurance', label: 'Insurance' },
                { value: 'Credit', label: 'Credit' },
                { value: '', label: 'Any Category' },
              ]}
              value={condition.value || ''}
              onChange={(value) => updateCondition('value', value)}
              clearable
            />
          </Stack>
        );

      case 'DOCUMENT_COUNT':
        return (
          <Stack gap="sm">
            <Select
              label="Operator"
              data={[
                { value: 'greater_than', label: 'Greater than (>)' },
                { value: 'less_than', label: 'Less than (<)' },
                { value: 'equals', label: 'Equals (=)' },
              ]}
              value={condition.operator || 'greater_than'}
              onChange={(value) => updateCondition('operator', value)}
              required
            />
            <NumberInput
              label="Count"
              description="Number of documents"
              placeholder="5"
              min={0}
              value={condition.value || 0}
              onChange={(value) => updateCondition('value', value || 0)}
              required
            />
            <Select
              label="Category (Optional)"
              description="Only count documents in this category"
              data={[
                { value: 'Income', label: 'Income' },
                { value: 'Employment', label: 'Employment' },
                { value: 'Assets', label: 'Assets' },
                { value: 'Property', label: 'Property' },
                { value: 'Insurance', label: 'Insurance' },
                { value: 'Credit', label: 'Credit' },
              ]}
              value={condition.field || ''}
              onChange={(value) => updateCondition('field', value)}
              clearable
            />
          </Stack>
        );

      case 'DOCUMENT_MISSING':
        return (
          <Stack gap="sm">
            <TextInput
              label="Document Name"
              description="Client must be missing this specific document"
              placeholder="e.g., W-2 Form, Bank Statement"
              value={condition.value || ''}
              onChange={(e) => updateCondition('value', e.currentTarget.value)}
              required
            />
          </Stack>
        );

      case 'TASK_COUNT':
        return (
          <Stack gap="sm">
            <Select
              label="Operator"
              data={[
                { value: 'greater_than', label: 'Greater than (>)' },
                { value: 'less_than', label: 'Less than (<)' },
                { value: 'equals', label: 'Equals (=)' },
              ]}
              value={condition.operator || 'greater_than'}
              onChange={(value) => updateCondition('operator', value)}
              required
            />
            <NumberInput
              label="Count"
              description="Number of tasks"
              placeholder="5"
              min={0}
              value={condition.value || 0}
              onChange={(value) => updateCondition('value', value || 0)}
              required
            />
            <Select
              label="Task Status (Optional)"
              description="Only count tasks with this status"
              data={[
                { value: 'TODO', label: 'To Do' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'COMPLETE', label: 'Complete' },
              ]}
              value={condition.field || ''}
              onChange={(value) => updateCondition('field', value)}
              clearable
            />
          </Stack>
        );

      case 'TASK_OVERDUE_EXISTS':
        return (
          <Stack gap="sm">
            <Text size="sm">
              Evaluates to <strong>TRUE</strong> if the client has any overdue tasks.
            </Text>
          </Stack>
        );

      case 'LOAN_AMOUNT_THRESHOLD':
        return (
          <Stack gap="sm">
            <Select
              label="Operator"
              data={[
                { value: 'greater_than', label: 'Greater than (>)' },
                { value: 'less_than', label: 'Less than (<)' },
                { value: 'equals', label: 'Equals (=)' },
              ]}
              value={condition.operator || 'greater_than'}
              onChange={(value) => updateCondition('operator', value)}
              required
            />
            <NumberInput
              label="Loan Amount"
              description="Threshold amount in dollars"
              placeholder="350000"
              min={0}
              value={condition.value || 0}
              onChange={(value) => updateCondition('value', value || 0)}
              required
            />
          </Stack>
        );

      case 'USER_ROLE_EQUALS':
        return (
          <Stack gap="sm">
            <Select
              label="Role"
              description="User must have this role"
              data={[
                { value: 'ADMIN', label: 'Admin' },
                { value: 'MANAGER', label: 'Manager' },
                { value: 'MLO', label: 'MLO' },
                { value: 'PROCESSOR', label: 'Processor' },
                { value: 'UNDERWRITER', label: 'Underwriter' },
                { value: 'VIEWER', label: 'Viewer' },
              ]}
              value={condition.value || ''}
              onChange={(value) => updateCondition('value', value)}
              required
            />
          </Stack>
        );

      case 'TIME_OF_DAY':
        return (
          <Stack gap="sm">
            <Select
              label="Operator"
              data={[
                { value: 'after', label: 'After' },
                { value: 'before', label: 'Before' },
                { value: 'between', label: 'Between' },
              ]}
              value={condition.operator || 'after'}
              onChange={(value) => updateCondition('operator', value)}
              required
            />
            {condition.operator === 'between' ? (
              <Group>
                <TextInput
                  label="Start Time"
                  placeholder="09:00"
                  value={condition.value?.start || ''}
                  onChange={(e) =>
                    updateCondition('value', {
                      ...(condition.value || {}),
                      start: e.currentTarget.value,
                    })
                  }
                  required
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                />
                <TextInput
                  label="End Time"
                  placeholder="17:00"
                  value={condition.value?.end || ''}
                  onChange={(e) =>
                    updateCondition('value', {
                      ...(condition.value || {}),
                      end: e.currentTarget.value,
                    })
                  }
                  required
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                />
              </Group>
            ) : (
              <TextInput
                label="Time"
                placeholder="09:00"
                value={typeof condition.value === 'string' ? condition.value : condition.value?.time || ''}
                onChange={(e) =>
                  updateCondition('value', e.currentTarget.value)
                }
                required
                pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
              />
            )}
            <Text size="xs" c="dimmed">
              Format: HH:MM in 24-hour format. Example: 09:00 for 9 AM, 17:00 for 5 PM.
            </Text>
          </Stack>
        );

      case 'DAY_OF_WEEK':
        return (
          <Stack gap="sm">
            <Select
              label="Day"
              description="Current day must match"
              data={[
                { value: '0', label: 'Sunday' },
                { value: '1', label: 'Monday' },
                { value: '2', label: 'Tuesday' },
                { value: '3', label: 'Wednesday' },
                { value: '4', label: 'Thursday' },
                { value: '5', label: 'Friday' },
                { value: '6', label: 'Saturday' },
              ]}
              value={condition.value || ''}
              onChange={(value) => updateCondition('value', value)}
              required
            />
          </Stack>
        );

      case 'AND':
      case 'OR':
        return (
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              {condition.type === 'AND' ? 'All' : 'Any'} of these conditions must be true:
            </Text>
            {(condition.conditions || []).map((nestedCond: any, index: number) => (
              <Paper key={index} withBorder p="sm" bg="gray.0">
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={600}>
                    Condition {index + 1}
                  </Text>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => removeNestedCondition(index)}
                  >
                    Remove
                  </Button>
                </Group>
                <Select
                  label="Type"
                  data={conditionTypes.flatMap((g) =>
                    g.types
                      .filter((t) => t.value !== 'AND' && t.value !== 'OR')
                      .map((t) => ({ value: t.value, label: t.label }))
                  )}
                  value={nestedCond.type || ''}
                  onChange={(value) => updateNestedCondition(index, { ...nestedCond, type: value })}
                  mb="xs"
                />
                {nestedCond.type && (
                  <ConditionConfigPanel
                    condition={nestedCond}
                    onChange={(newCond) => updateNestedCondition(index, newCond)}
                  />
                )}
              </Paper>
            ))}
            <Button
              size="sm"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={addNestedCondition}
            >
              Add Condition
            </Button>
          </Stack>
        );

      default:
        return (
          <Text size="sm" c="dimmed">
            Select a condition type to configure it.
          </Text>
        );
    }
  };

  return (
    <Stack gap="md">
      {/* Condition Type Selector */}
      {!condition.type && (
        <Stack gap="sm">
          {conditionTypes.map((group) => (
            <Stack key={group.group} gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                {group.group}
              </Text>
              {group.types.map((type) => {
                const IconComponent = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant="light"
                    color={type.color}
                    leftSection={<IconComponent size={16} />}
                    onClick={() => updateCondition('type', type.value)}
                    fullWidth
                    styles={{
                      inner: { justifyContent: 'flex-start' },
                    }}
                  >
                    {type.label}
                  </Button>
                );
              })}
            </Stack>
          ))}
        </Stack>
      )}

      {/* Configuration Fields */}
      {condition.type && (
        <>
          <Paper withBorder p="sm" bg="gray.0">
            <Group gap="sm">
              {typeInfo && <typeInfo.icon size={20} color={`var(--mantine-color-${typeInfo.color}-filled)`} />}
              <div>
                <Text size="sm" fw={600}>
                  {typeInfo?.label || condition.type}
                </Text>
                <Text size="xs" c="dimmed">
                  {condition.type.replace(/_/g, ' ').toLowerCase()}
                </Text>
              </div>
            </Group>
          </Paper>

          {renderConfigFields()}

          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => onChange({})}
          >
            Change Condition Type
          </Button>
        </>
      )}
    </Stack>
  );
}
