import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  Alert,
  Box,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconArrowLeft,
  IconSend,
  IconInfoCircle,
  IconTag,
  IconEye,
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { api } from '../utils/api';
import { AttachmentManager } from '../components/attachments/AttachmentManager';
import type { Attachment } from '../utils/attachments';
import { useAuthStore } from '../stores/authStore';
import { PLACEHOLDER_INFO, PLACEHOLDER_KEYS } from '../utils/constants';
import type { CommunicationTemplate } from '../types';

interface ComposerClient {
  id: string;
  nameEncrypted: string;
  name?: string;
}

interface RenderedCommunicationPreview {
  body: {
    original: string;
    filled: string;
    placeholders: string[];
    missing: string[];
  };
  subject: {
    original: string;
    filled: string;
    placeholders: string[];
    missing: string[];
  } | null;
  context: Record<string, unknown>;
}

function hasHtmlContent(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

export function CommunicationComposer() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const location = useLocation();
  const { accessToken, hasHydrated } = useAuthStore();

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Data
  const [clients, setClients] = useState<ComposerClient[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(clientId || null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Form fields
  const [type, setType] = useState<string>('EMAIL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [communicationId, setCommunicationId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Preview state
  const [renderedPreview, setRenderedPreview] = useState<RenderedCommunicationPreview | null>(null);
  const [loadingRenderedPreview, setLoadingRenderedPreview] = useState(false);
  const [renderedPreviewError, setRenderedPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || !accessToken) return;
    fetchClients();
    fetchTemplates();
    if (clientId) {
      setSelectedClient(clientId);
    }
  }, [accessToken, clientId, hasHydrated]);

  useEffect(() => {
    // Handle cloning from existing communication
    const cloneFrom = location.state as { cloneFrom?: any } | null;
    if (cloneFrom?.cloneFrom) {
      const comm = cloneFrom.cloneFrom;
      setType(comm.type);
      setSubject(comm.subject || '');
      setBody(comm.body);
      if (comm.followUpDate) {
        setFollowUpDate(new Date(comm.followUpDate));
      }
      // Clear scheduled date for cloned communications
      setScheduledAt(null);

      notifications.show({
        title: 'Communication Cloned',
        message: 'You can now edit and send this communication',
        color: 'blue',
      });
    }
  }, [location.state]);

  useEffect(() => {
    if (!previewMode) return;

    const resolvedClientId = selectedClient || clientId || null;
    if (!resolvedClientId || !body.trim()) {
      setRenderedPreview(null);
      setRenderedPreviewError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      void loadRenderedPreview(resolvedClientId, body, subject);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [previewMode, selectedClient, clientId, body, subject]);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      const normalized = Array.isArray(data) ? data : data.data || [];
      setClients(normalized);
    } catch (error) {
      console.error('Error fetching clients:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load clients',
        color: 'red',
      });
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/communication-templates?is_active=true');

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const loadRenderedPreview = async (resolvedClientId: string, messageBody: string, messageSubject: string) => {
    setLoadingRenderedPreview(true);
    setRenderedPreviewError(null);

    try {
      const response = await api.post('/communications/preview', {
        clientId: resolvedClientId,
        body: messageBody,
        subject: messageSubject || undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to generate rendered preview');
      }

      const data = await response.json() as RenderedCommunicationPreview;
      setRenderedPreview(data);
    } catch (error) {
      console.error('Error generating rendered preview:', error);
      setRenderedPreview(null);
      setRenderedPreviewError('Unable to generate rendered preview');
    } finally {
      setLoadingRenderedPreview(false);
    }
  };

  const handleTemplateChange = (templateId: string | null) => {
    setSelectedTemplate(templateId);

    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setType(template.type);
        setSubject(template.subject || '');
        setBody(template.body);
      }
    } else {
      // Clear form fields if no template selected
      setType('EMAIL');
      setSubject('');
      setBody('');
    }
  };

  const handleInsertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById('compose-body') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = body;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newBody = before + placeholder + after;
    setBody(newBody);

    // Set cursor position after inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const resolveClientId = (): string | null => selectedClient || clientId || null;

  const validateForm = (): string | null => {
    if (!resolveClientId()) {
      return 'Please select a client';
    }

    if (!type) {
      return 'Please select a communication type';
    }

    if ((type === 'EMAIL' || type === 'LETTER') && !subject.trim()) {
      return 'Subject is required for Email and Letter communications';
    }

    if (!body.trim()) {
      return 'Message body is required';
    }

    return null;
  };

  const handleSaveDraft = async () => {
    const error = validateForm();
    if (error) {
      notifications.show({
        title: 'Validation Error',
        message: error,
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        clientId: resolveClientId(),
        type,
        subject: (type === 'EMAIL' || type === 'LETTER') ? subject.trim() : null,
        body: body.trim(),
        templateId: selectedTemplate,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        followUpDate: followUpDate ? followUpDate.toISOString() : null,
      };

      const response = await api.post('/communications', payload);
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseBody.message || 'Failed to save communication');
      }
      const communicationId = responseBody.id || responseBody.data?.id;
      if (!communicationId) {
        throw new Error('Failed to save communication: missing response id');
      }

      notifications.show({
        title: 'Success',
        message: 'Communication saved as draft',
        color: 'green',
      });

      // Store communication ID for attachments
      setCommunicationId(communicationId);

      navigate('/communications');
    } catch (error: any) {
      console.error('Error saving communication:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save communication',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReady = async () => {
    const error = validateForm();
    if (error) {
      notifications.show({
        title: 'Validation Error',
        message: error,
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      // First create as draft
      const payload = {
        clientId: resolveClientId(),
        type,
        subject: (type === 'EMAIL' || type === 'LETTER') ? subject.trim() : null,
        body: body.trim(),
        templateId: selectedTemplate,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        followUpDate: followUpDate ? followUpDate.toISOString() : null,
      };

      const response = await api.post('/communications', payload);
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseBody.message || 'Failed to create communication');
      }
      const communicationId = responseBody.id || responseBody.data?.id;
      if (!communicationId) {
        throw new Error('Failed to create communication: missing response id');
      }

      // Then update status to READY
      const updateResponse = await api.patch(`/communications/${communicationId}/status`, { status: 'READY' });

      if (!updateResponse.ok) {
        throw new Error('Failed to mark communication as ready');
      }

      notifications.show({
        title: 'Success',
        message: 'Communication marked as ready to send',
        color: 'green',
      });

      navigate('/communications');
    } catch (error: any) {
      console.error('Error marking communication as ready:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to mark communication as ready',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    const error = validateForm();
    if (error) {
      notifications.show({
        title: 'Validation Error',
        message: error,
        color: 'red',
      });
      return;
    }

    setSending(true);
    try {
      // First create as draft
      const payload = {
        clientId: resolveClientId(),
        type,
        subject: (type === 'EMAIL' || type === 'LETTER') ? subject.trim() : null,
        body: body.trim(),
        templateId: selectedTemplate,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        followUpDate: followUpDate ? followUpDate.toISOString() : null,
      };

      const response = await api.post('/communications', payload);
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseBody.message || 'Failed to create communication');
      }
      const communicationId = responseBody.id || responseBody.data?.id;
      if (!communicationId) {
        throw new Error('Failed to create communication: missing response id');
      }

      // Then mark as sent
      const sendResponse = await api.post(`/communications/${communicationId}/send`);
      if (!sendResponse.ok) {
        const sendError = await sendResponse.json().catch(() => ({}));
        throw new Error(sendError.message || 'Failed to send communication');
      }

      navigate('/communications', {
        state: {
          toast: {
            title: 'Success',
            message: 'Communication sent successfully',
            color: 'green',
          },
        },
      });
    } catch (error: any) {
      console.error('Error sending communication:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to send communication',
        color: 'red',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/communications')}
            >
              Back to Communications
            </Button>
            <Title order={2}>Compose Communication</Title>
          </Group>
          <Group>
            <Button
              variant="default"
              onClick={() => navigate('/communications')}
              disabled={saving || sending}
            >
              Cancel
            </Button>
            <Button
              variant="light"
              leftSection={<IconEye size={16} />}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
            {!previewMode && (
              <>
                <Button
                  variant="default"
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveDraft}
                  loading={saving}
                  disabled={sending}
                >
                  Save Draft
                </Button>
                <Button
                  color="blue"
                  onClick={handleMarkReady}
                  loading={saving}
                  disabled={sending}
                >
                  Mark Ready
                </Button>
                <Button
                  color="green"
                  leftSection={<IconSend size={16} />}
                  onClick={handleSendNow}
                  loading={sending}
                  disabled={saving}
                >
                  Send Now
                </Button>
              </>
            )}
          </Group>
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          <Text size="sm">
            Create a new communication. Select a template to get started or compose from scratch.
          </Text>
        </Alert>

        <Paper p="md" withBorder>
          <Stack gap="md">
            {/* Client and Template Selection */}
            <Group grow>
              <Select
                label="Client"
                placeholder="Select a client"
                required
                data={clients.map(client => ({
                  value: client.id,
                  label: client.name ?? client.nameEncrypted ?? 'Unknown',
                }))}
                value={selectedClient}
                onChange={setSelectedClient}
                searchable
                nothingFoundMessage="No clients found"
              />

              <Select
                label="Template (Optional)"
                placeholder="Select a template"
                clearable
                data={templates
                  .filter(t => t.type === type || !type)
                  .map(template => ({
                    value: template.id,
                    label: template.name,
                  }))}
                value={selectedTemplate}
                onChange={handleTemplateChange}
                description="Template will auto-fill the fields below"
              />
            </Group>

            {/* Communication Type */}
            <Select
              label="Type"
              placeholder="Select communication type"
              required
              data={[
                { value: 'EMAIL', label: 'Email' },
                { value: 'SMS', label: 'SMS' },
                { value: 'LETTER', label: 'Letter' },
              ]}
              value={type}
              onChange={(value) => {
                const nextType = value ?? 'EMAIL';
                setType(nextType);
                if (nextType === 'SMS') {
                  setSubject('');
                }
              }}
              disabled={!!selectedTemplate}
            />

            {/* Subject (for EMAIL and LETTER) */}
            {(type === 'EMAIL' || type === 'LETTER') && (
              <TextInput
                label="Subject"
                placeholder="Enter subject line"
                required={type === 'EMAIL' || type === 'LETTER'}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            )}

            {/* Message Body or Preview */}
            {previewMode ? (
              <Stack gap="sm">
                <Text size="sm" fw={500} c="dimmed">
                  Final rendered preview (real client context):
                </Text>

                {!resolveClientId() ? (
                  <Alert color="yellow" title="Select a client">
                    Choose a client to generate the final rendered communication.
                  </Alert>
                ) : loadingRenderedPreview ? (
                  <Group justify="center" py="lg">
                    <Loader size="sm" />
                  </Group>
                ) : renderedPreviewError ? (
                  <Alert color="red" title="Preview Error">
                    {renderedPreviewError}
                  </Alert>
                ) : renderedPreview ? (
                  (() => {
                    const renderedSubject = renderedPreview.subject?.filled || subject;
                    const renderedBody = renderedPreview.body.filled || body;
                    const missing = Array.from(
                      new Set([
                        ...renderedPreview.body.missing,
                        ...(renderedPreview.subject?.missing || []),
                      ]),
                    );

                    return (
                      <Stack gap="md">
                        {missing.length > 0 && (
                          <Alert color="yellow" title="Missing Placeholder Values">
                            <Group gap="xs" mt="xs">
                              {missing.map((key) => (
                                <Badge key={key} variant="light" color="yellow">
                                  {key}
                                </Badge>
                              ))}
                            </Group>
                          </Alert>
                        )}

                        {renderedSubject && (
                          <Stack gap="xs">
                            <Text size="sm" fw={500} c="dimmed">
                              Final Subject:
                            </Text>
                            <Paper withBorder p="sm">
                              <Text>{renderedSubject}</Text>
                            </Paper>
                          </Stack>
                        )}

                        <Stack gap="xs">
                          <Text size="sm" fw={500} c="dimmed">
                            Final Message:
                          </Text>

                          {type === 'SMS' ? (
                            <Paper withBorder p="sm" style={{ whiteSpace: 'pre-wrap', minHeight: '180px' }}>
                              {renderedBody}
                            </Paper>
                          ) : hasHtmlContent(renderedBody) ? (
                            <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
                              <iframe
                                title="Rendered communication preview"
                                srcDoc={renderedBody}
                                sandbox="allow-popups allow-popups-to-escape-sandbox"
                                referrerPolicy="no-referrer"
                                style={{ width: '100%', minHeight: 360, border: 'none' }}
                              />
                            </Paper>
                          ) : (
                            <Paper withBorder p="md" bg="gray.0">
                              <Paper withBorder p="md" bg="white" style={{ minHeight: '220px' }}>
                                <Text style={{ whiteSpace: 'pre-wrap' }}>{renderedBody}</Text>
                              </Paper>
                            </Paper>
                          )}
                        </Stack>
                      </Stack>
                    );
                  })()
                ) : (
                  <Paper withBorder p="sm" style={{ whiteSpace: 'pre-wrap', minHeight: '200px' }}>
                    {body}
                  </Paper>
                )}
              </Stack>
            ) : (
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Message Body
                  </Text>
                  <Group gap="xs">
                    <IconTag size={14} color="var(--mantine-color-blue-6)" />
                    <Text size="xs" c="dimmed">
                      Insert:
                    </Text>
                    {PLACEHOLDER_KEYS.slice(0, 6).map(key => (
                      <Button
                        key={key}
                        variant="light"
                        size="xs"
                        onClick={() => handleInsertPlaceholder(key)}
                      >
                        {key}
                      </Button>
                    ))}
                  </Group>
                </Group>

                <Textarea
                  id="compose-body"
                  placeholder="Dear {{client_name}},&#10;&#10;Thank you for choosing our services..."
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  minRows={12}
                  autosize
                />
              </Stack>
            )}

            {/* Scheduling */}
            <Group grow>
              <DateInput
                label="Schedule For (Optional)"
                placeholder="Select date and time"
                value={scheduledAt}
                onChange={setScheduledAt}
                clearable
                description="Leave empty to send immediately"
              />

              <DateInput
                label="Follow-up Date (Optional)"
                placeholder="Select follow-up date"
                value={followUpDate}
                onChange={setFollowUpDate}
                clearable
                minDate={new Date()}
                description="Set a reminder to follow up"
              />
            </Group>

            {/* Attachments */}
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Attachments (Optional)
              </Text>
              <Text size="xs" c="dimmed">
                Save the draft first to enable file uploads
              </Text>
              <AttachmentManager
                communicationId={communicationId}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                disabled={!communicationId}
                maxFiles={10}
                maxSize={10 * 1024 * 1024} // 10MB
              />
            </Stack>

            {/* Detected Placeholders */}
            {!previewMode && body && (
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Detected Placeholders:
                </Text>
                <Group gap="xs" wrap="wrap">
                  {PLACEHOLDER_KEYS.filter(key => body.includes(key)).map(ph => (
                    <Badge key={ph} variant="outline" leftSection={<IconTag size={10} />}>
                      {ph}
                    </Badge>
                  ))}
                  {PLACEHOLDER_KEYS.filter(key => body.includes(key)).length === 0 && (
                    <Text size="xs" c="dimmed">
                      No placeholders detected
                    </Text>
                  )}
                </Group>
              </Box>
            )}
          </Stack>
        </Paper>

        {/* Placeholder Reference */}
        {!previewMode && (
          <Paper withBorder p="md" bg="blue.0">
            <Stack gap="sm">
              <Title order={5}>Placeholder Reference</Title>
              <Text size="sm" c="dimmed">
                Available placeholders you can use in your message:
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
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => handleInsertPlaceholder(key)}
                      >
                        Insert
                      </Button>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
