import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Title,
  Stack,
  Paper,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Text,
  Badge,
  Container,
  LoadingOverlay,
  Alert,
  Box,
  Chip,
  MultiSelect,
  Switch,
  Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconArrowLeft,
  IconTemplate,
  IconInfoCircle,
  IconTag,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

interface CommunicationTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  subject: string | null;
  body: string;
  placeholders: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MetaOption {
  value: string;
  label: string;
  description: string;
}

interface MetaResponse {
  data: MetaOption[];
}

// Available placeholder descriptions
const PLACEHOLDER_INFO: Record<string, { description: string; example: string }> = {
  '{{client_name}}': {
    description: 'Full name of the client',
    example: 'John Smith',
  },
  '{{client_email}}': {
    description: 'Email address of the client',
    example: 'john@example.com',
  },
  '{{client_phone}}': {
    description: 'Phone number of the client',
    example: '(555) 123-4567',
  },
  '{{client_status}}': {
    description: 'Current status of the client',
    example: 'Active',
  },
  '{{loan_amount}}': {
    description: 'Loan amount',
    example: '$350,000',
  },
  '{{loan_officer_name}}': {
    description: 'Name of the loan officer',
    example: 'Jane Doe',
  },
  '{{company_name}}': {
    description: 'Name of your company',
    example: 'ABC Mortgage',
  },
  '{{due_date}}': {
    description: 'Due date for documents/tasks',
    example: 'January 15, 2026',
  },
  '{{date}}': {
    description: 'Current date',
    example: 'February 2, 2026',
  },
  '{{time}}': {
    description: 'Current time',
    example: '2:30 PM',
  },
  '{{property_address}}': {
    description: 'Property address',
    example: '123 Main St, City, State 12345',
  },
  '{{trigger_type}}': {
    description: 'Type of trigger that initiated the communication',
    example: 'Document Uploaded',
  },
};

const PLACEHOLDER_KEYS = Object.keys(PLACEHOLDER_INFO);

export function CommunicationTemplateEditor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const isEditing = !!id;
  const isDuplicate = new URLSearchParams(window.location.search).has('duplicate');

  const [loading, setLoading] = useState(isEditing || isDuplicate);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<CommunicationTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>('EMAIL');
  const [category, setCategory] = useState<string | null>('WELCOME');
  const [customCategory, setCustomCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedPlaceholders, setSelectedPlaceholders] = useState<string[]>([]);

  const canManageTemplates = true; // Already checked in routing

  // Fetch meta options (shared query key with CommunicationTemplates)
  const { data: metaData } = useQuery({
    queryKey: ['comm-template-meta'],
    queryFn: async () => {
      const [typesRes, categoriesRes] = await Promise.all([
        api.get('/communication-templates/meta/types'),
        api.get('/communication-templates/meta/categories'),
      ]);
      const typeOpts = typesRes.ok ? ((await typesRes.json() as MetaResponse).data || []) : [];
      const categoryOpts = categoriesRes.ok ? ((await categoriesRes.json() as MetaResponse).data || []) : [];
      return { typeOptions: typeOpts, categoryOptions: categoryOpts };
    },
    staleTime: 300_000,
  });

  const typeOptions = metaData?.typeOptions ?? [];
  const categoryOptions = metaData?.categoryOptions ?? [];

  // Fetch existing template for editing/duplicating
  useQuery({
    queryKey: ['comm-template', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/communication-templates/${id}`);
        if (!response.ok) throw new Error('Failed to fetch template');
        const data: CommunicationTemplate = await response.json();
        setTemplate(data);
        setName(isDuplicate ? `Copy of ${data.name}` : data.name);
        setType(data.type);
        setCategory(data.category);
        setSubject(data.subject || '');
        setBody(data.body);
        setIsActive(isDuplicate ? true : data.isActive);
        setSelectedPlaceholders(data.placeholders || []);
        setLoading(false);
        return data;
      } catch (error) {
        setLoading(false);
        notifications.show({
          title: 'Error',
          message: 'Failed to load template',
          color: 'red',
        });
        navigate('/communication-templates');
        throw error;
      }
    },
    enabled: isEditing || isDuplicate,
    retry: false,
  });

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = body;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newBody = before + placeholder + after;
    setBody(newBody);

    // Update selected placeholders if not already present
    if (!selectedPlaceholders.includes(placeholder)) {
      setSelectedPlaceholders([...selectedPlaceholders, placeholder]);
    }

    // Set cursor position after inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const extractPlaceholdersFromBody = (text: string): string[] => {
    const placeholderRegex = /\{\{[^}]+\}\}/g;
    const found = text.match(placeholderRegex) || [];
    return [...new Set(found)];
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Template name is required',
        color: 'red',
      });
      return;
    }

    if (!type) {
      notifications.show({
        title: 'Validation Error',
        message: 'Template type is required',
        color: 'red',
      });
      return;
    }

    if (!category && !customCategory.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Template category is required',
        color: 'red',
      });
      return;
    }

    if (type === 'EMAIL' || type === 'LETTER') {
      if (!subject.trim()) {
        notifications.show({
          title: 'Validation Error',
          message: 'Subject is required for Email and Letter templates',
          color: 'red',
        });
        return;
      }
    }

    if (!body.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Template body is required',
        color: 'red',
      });
      return;
    }

    // Auto-detect placeholders from body
    const detectedPlaceholders = extractPlaceholdersFromBody(body);
    const finalPlaceholders = [...new Set([...selectedPlaceholders, ...detectedPlaceholders])];

    setSaving(true);
    try {
      const finalCategory = customCategory.trim() || category;

      const payload = {
        name: name.trim(),
        type,
        category: finalCategory,
        subject: (type === 'EMAIL' || type === 'LETTER') ? subject.trim() : null,
        body: body.trim(),
        placeholders: finalPlaceholders,
        isActive,
      };

      const response = isEditing
        ? await api.put(`/communication-templates/${id}`, payload)
        : await api.post('/communication-templates', payload);

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseBody.message || 'Failed to save template');
      }

      notifications.show({
        title: 'Success',
        message: isEditing ? 'Template updated successfully' : 'Template created successfully',
        color: 'green',
      });

      navigate('/communication-templates');
    } catch (error: any) {
      console.error('Error saving template:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save template',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container size="xl">
        <Paper p="xl" withBorder>
          <LoadingOverlay visible />
          <Box h={300} />
        </Paper>
      </Container>
    );
  }

  const categoryData = [
    ...categoryOptions.map(opt => ({ value: opt.value, label: opt.label })),
    { value: '__custom__', label: 'Custom Category...' },
  ];

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/communication-templates')}
            >
              Back to Templates
            </Button>
            <Title order={2}>
              {isEditing ? 'Edit Template' : isDuplicate ? 'Duplicate Template' : 'Create Template'}
            </Title>
          </Group>
          <Group>
            <Button
              variant="default"
              onClick={() => navigate('/communication-templates')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              {isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
          </Group>
        </Group>

        <Alert icon={<IconInfoCircle size={16} aria-hidden="true" />} color="blue" title="Template Editor">
          <Text size="sm">
            Create communication templates with placeholders that will be automatically replaced when sending.
            Use the placeholder buttons below or type them manually.
          </Text>
        </Alert>

        <Paper p="md" withBorder>
          <Stack gap="md">
            {/* Basic Information */}
            <Stack gap="sm">
              <Title order={4}>Basic Information</Title>

              <TextInput
                label="Template Name"
                placeholder="e.g., Welcome Email"
                required
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={100}
              />

              <Group grow>
                <Select
                  label="Type"
                  placeholder="Select type"
                  required
                  data={typeOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                  value={type}
                  onChange={setValue => {
                    setType(setValue);
                    // Clear subject if switching to SMS
                    if (setValue === 'SMS') {
                      setSubject('');
                    }
                  }}
                  description={typeOptions.find(t => t.value === type)?.description}
                />

                <Select
                  label="Category"
                  placeholder="Select category"
                  required
                  data={categoryData}
                  value={category}
                  onChange={setValue => {
                    setCategory(setValue);
                    setCustomCategory('');
                  }}
                  description={
                    category === '__custom__'
                      ? 'Enter a custom category name below'
                      : categoryOptions.find(c => c.value === category)?.description
                  }
                />
              </Group>

              {category === '__custom__' && (
                <TextInput
                  label="Custom Category"
                  placeholder="e.g., Holiday Greeting"
                  required
                  value={customCategory}
                  onChange={event => setCustomCategory(event.target.value)}
                  maxLength={50}
                />
              )}

              {(type === 'EMAIL' || type === 'LETTER') && (
                <TextInput
                  label="Subject"
                  placeholder="e.g., Welcome to Our Mortgage Team!"
                  required={type === 'EMAIL' || type === 'LETTER'}
                  value={subject}
                  onChange={event => setSubject(event.target.value)}
                  maxLength={200}
                  description="Subject line for email or letter"
                />
              )}

              <Switch
                label="Active"
                description="Inactive templates will not be available for use"
                checked={isActive}
                onChange={event => setIsActive(event.currentTarget.checked)}
              />
            </Stack>

            {/* Template Body */}
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>Template Body</Title>
                <Text size="sm" c="dimmed">
                  Type your message or use placeholders below
                </Text>
              </Group>

              {/* Placeholder Insertion Toolbar */}
              <Paper withBorder p="sm" bg="gray.0">
                <Stack gap="xs">
                  <Group gap="xs" wrap="wrap">
                    <IconTag size={16} color="var(--mantine-color-blue-6)" />
                    <Text size="sm" fw={500}>
                      Insert Placeholder:
                    </Text>
                  </Group>
                  <Group gap="xs" wrap="wrap">
                    {PLACEHOLDER_KEYS.map(key => (
                      <Button
                        key={key}
                        variant="light"
                        size="xs"
                        onClick={() => insertPlaceholder(key)}
                      >
                        {key}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              </Paper>

              <Textarea
                id="template-body"
                label="Message Body"
                placeholder="Dear {{client_name}},&#10;&#10;Thank you for choosing our services..."
                required
                value={body}
                onChange={event => {
                  setBody(event.target.value);
                  // Auto-detect placeholders
                  const detected = extractPlaceholdersFromBody(event.target.value);
                  setSelectedPlaceholders(prev => [...new Set([...prev, ...detected])]);
                }}
                minRows={10}
                autosize
                description="Use double curly braces for placeholders: {{placeholder_name}}"
              />

              {/* Detected Placeholders */}
              {selectedPlaceholders.length > 0 && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">
                    Detected Placeholders:
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    {selectedPlaceholders.map(ph => (
                      <Badge key={ph} variant="outline" leftSection={<IconTag size={10} />}>
                        {ph}
                      </Badge>
                    ))}
                  </Group>
                </Box>
              )}
            </Stack>

            {/* Placeholder Reference */}
            <Paper withBorder p="md" bg="blue.0">
              <Stack gap="sm">
                <Title order={5}>Placeholder Reference</Title>
                <Text size="sm" c="dimmed">
                  Available placeholders you can use in your templates:
                </Text>
                <Stack gap="xs">
                  {PLACEHOLDER_KEYS.map(key => (
                    <Paper key={key} p="xs" withBorder bg="white">
                      <Group justify="space-between" align="flex-start">
                        <Box style={{ flex: 1 }}>
                          <Group gap="xs" mb={4}>
                            <Badge size="sm">{key}</Badge>
                            <Text size="sm" fw={500}>
                              {PLACEHOLDER_INFO[key].description}
                            </Text>
                          </Group>
                          <Text size="xs" c="dimmed">
                            Example: {PLACEHOLDER_INFO[key].example}
                          </Text>
                        </Box>
                        <Anchor
                          size="sm"
                          onClick={() => insertPlaceholder(key)}
                          style={{ cursor: 'pointer' }}
                        >
                          Insert
                        </Anchor>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
