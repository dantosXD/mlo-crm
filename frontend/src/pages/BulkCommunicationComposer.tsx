import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Stack,
  Paper,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Text,
  Badge,
  LoadingOverlay,
  Alert,
  Box,
  ScrollArea,
  Divider,
  Accordion,
  List,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconSend,
  IconTemplate,
  IconInfoCircle,
  IconEye,
  IconX,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { DateInput } from '@mantine/dates';
import { api } from '../utils/api';
import { PLACEHOLDER_INFO, PLACEHOLDER_KEYS } from '../utils/constants';
import type { CommunicationTemplate } from '../types';

interface BulkClient {
  id: string;
  nameEncrypted: string;
  emailEncrypted: string;
  phoneEncrypted: string;
}

interface BulkCommunicationComposerProps {
  opened: boolean;
  onClose: () => void;
  clientIds: string[];
}

export function BulkCommunicationComposer({
  opened,
  onClose,
  clientIds,
}: BulkCommunicationComposerProps) {
  const { accessToken, user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<BulkClient[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);


  // Fetch clients data
  useEffect(() => {
    if (!opened || clientIds.length === 0) return;

    const fetchClients = async () => {
      try {
        // Fetch clients by IDs
        const responses = await Promise.all(
          clientIds.map(id =>
            api.get(`/clients/${id}`)
          )
        );

        const clientsData = await Promise.all(
          responses.map(r => {
            if (!r.ok) throw new Error('Failed to fetch client');
            return r.json();
          })
        );

        setClients(clientsData);
      } catch (error) {
        console.error('Error fetching clients:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load client data',
          color: 'red',
        });
      }
    };

    fetchClients();
  }, [opened, clientIds, accessToken]);

  // Fetch templates
  useEffect(() => {
    if (!opened) return;

    const fetchTemplates = async () => {
      try {
        const response = await api.get('/communications/templates?type=EMAIL&status=APPROVED');

        if (!response.ok) throw new Error('Failed to fetch templates');

        const data = await response.json();
        setTemplates(data);
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };

    fetchTemplates();
  }, [opened, accessToken]);

  // When template is selected, populate form
  useEffect(() => {
    if (!selectedTemplate) {
      setSubject('');
      setBody('');
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      setSubject(template.subject || '');
      setBody(template.body);
    }
  }, [selectedTemplate, templates]);

  // Replace placeholders for a specific client
  const replacePlaceholders = (text: string, client: BulkClient): string => {
    let result = text;
    const clientName = client.nameEncrypted ?? '';
    const clientEmail = client.emailEncrypted ?? '';
    const clientPhone = client.phoneEncrypted ?? '';
    const loanOfficerName = user?.name || 'Loan Officer';
    const companyName = 'ABC Mortgage'; // Could be from user settings

    const replacements: Record<string, string> = {
      '{{client_name}}': clientName,
      '{{client_email}}': clientEmail,
      '{{client_phone}}': clientPhone,
      '{{client_status}}': 'Active', // Could fetch actual status
      '{{loan_amount}}': '$350,000', // Could fetch from loan scenario
      '{{loan_officer_name}}': loanOfficerName,
      '{{company_name}}': companyName,
      '{{due_date}}': 'January 15, 2026',
      '{{date}}': new Date().toLocaleDateString(),
      '{{time}}': new Date().toLocaleTimeString(),
      '{{property_address}}': '123 Main St',
      '{{trigger_type}}': 'Manual',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return result;
  };

  // Get all placeholders used in the template
  const usedPlaceholders = useMemo(() => {
    if (!body) return [];

    const found: string[] = [];
    for (const placeholder of PLACEHOLDER_KEYS) {
      if (body.includes(placeholder)) {
        found.push(placeholder);
      }
    }
    return found;
  }, [body]);

  // Generate preview for each client
  const previews = useMemo(() => {
    return clients.map(client => ({
      client,
      subject: replacePlaceholders(subject, client),
      body: replacePlaceholders(body, client),
    }));
  }, [clients, subject, body]);

  // Handle save as draft
  const handleSaveDrafts = async () => {
    if (!subject.trim() || !body.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Subject and body are required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    let success = 0;
    const errors: string[] = [];

    try {
      for (const client of clients) {
        try {
          const response = await api.post('/communications', {
              clientId: client.id,
              type: 'EMAIL',
              subject: replacePlaceholders(subject, client),
              body: replacePlaceholders(body, client),
              status: 'DRAFT',
              scheduledAt: scheduledAt?.toISOString() || null,
              followUpDate: followUpDate?.toISOString() || null,
            });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create draft');
          }

          success++;
        } catch (error: any) {
          const clientName = client.nameEncrypted ?? '';
          errors.push(`${clientName}: ${error.message}`);
        }
      }

      setSuccessCount(success);
      setShowSuccess(true);

      if (errors.length > 0) {
        notifications.show({
          title: 'Partial Success',
          message: `Created ${success} of ${clients.length} drafts. ${errors.length} failed.`,
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Success',
          message: `Successfully created ${success} communication draft(s)`,
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create drafts',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    setSuccessCount(0);
    setSelectedTemplate(null);
    setSubject('');
    setBody('');
    setScheduledAt(null);
    setFollowUpDate(null);
    onClose();
  };

  return (
    <>
      <Modal
        opened={opened && !showSuccess}
        onClose={handleClose}
        title={`Compose Message for ${clientIds.length} Client(s)`}
        size="xl"
        styles={{
          body: { height: '70vh', display: 'flex', flexDirection: 'column' },
        }}
      >
        <LoadingOverlay visible={loading} />

        <Stack style={{ flex: 1, overflow: 'hidden' }}>
          {/* Template Selection */}
          <Paper p="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Select
                  label="Select Template"
                  placeholder="Choose a template to start"
                  leftSection={<IconTemplate size={16} />}
                  data={templates.map(t => ({ value: t.id, label: t.name }))}
                  value={selectedTemplate}
                  onChange={setSelectedTemplate}
                  clearable
                />

                {selectedTemplate && (
                  <Alert icon={<IconInfoCircle size={16} />} color="blue">
                    <Text size="sm">
                      Template loaded. You can customize the subject and body before creating drafts.
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Group>
          </Paper>

          {/* Message Editor */}
          <Paper p="md" withBorder style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Stack style={{ height: '100%' }}>
              <TextInput
                label="Subject"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />

              <Textarea
                label="Body"
                placeholder="Message body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                minRows={8}
                style={{ flex: 1 }}
                styles={{ root: { flex: 1, display: 'flex', flexDirection: 'column' }, input: { flex: 1 } }}
              />

              {usedPlaceholders.length > 0 && (
                <Alert icon={<IconInfoCircle size={16} />} color="blue">
                  <Text size="sm" fw={500} mb="xs">
                    Placeholders used in template:
                  </Text>
                  <List size="sm">
                    {usedPlaceholders.map((placeholder) => (
                      <List.Item key={placeholder}>
                        <Text span fw={500}>
                          {placeholder}
                        </Text>
                        : {PLACEHOLDER_INFO[placeholder]?.description}
                      </List.Item>
                    ))}
                  </List>
                </Alert>
              )}

              <Group>
                <DateInput
                  label="Schedule For (Optional)"
                  placeholder="Select date and time"
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  clearable
                  style={{ flex: 1 }}
                />
                <DateInput
                  label="Follow-up Date (Optional)"
                  placeholder="Select date"
                  value={followUpDate}
                  onChange={setFollowUpDate}
                  clearable
                  style={{ flex: 1 }}
                />
              </Group>
            </Stack>
          </Paper>

          {/* Preview Section */}
          {previews.length > 0 && (
            <Paper p="md" withBorder style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Text fw={500} mb="sm">
                Preview for Each Client ({previews.length})
              </Text>
              <ScrollArea style={{ flex: 1 }}>
                <Accordion variant="contained">
                  {previews.map((preview, index) => {
                    const clientName = preview.client.nameEncrypted ?? '';
                    return (
                      <Accordion.Item key={preview.client.id} value={preview.client.id}>
                        <Accordion.Control>
                          <Group justify="space-between">
                            <Text fw={500}>{clientName}</Text>
                            <Badge size="sm" color="blue">
                              {preview.subject}
                            </Badge>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="sm">
                            <Paper p="sm" withBorder bg="gray.0">
                              <Text size="sm" fw={500}>
                                Subject:
                              </Text>
                              <Text size="sm">{preview.subject}</Text>
                            </Paper>
                            <Paper p="sm" withBorder bg="gray.0">
                              <Text size="sm" fw={500}>
                                Body:
                              </Text>
                              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                {preview.body}
                              </Text>
                            </Paper>
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              </ScrollArea>
            </Paper>
          )}

          {/* Actions */}
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSaveDrafts}
              loading={saving}
              disabled={!subject.trim() || !body.trim() || clients.length === 0}
            >
              Create Drafts ({clients.length})
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Success Summary */}
      <Modal
        opened={showSuccess}
        onClose={handleClose}
        title="Drafts Created"
        size="sm"
      >
        <Stack align="center">
          <Box style={{ textAlign: 'center' }}>
            <IconCheck size={64} color="green" style={{ marginBottom: 'md' }} />
            <Text size="lg" fw={500}>
              Successfully created {successCount} communication draft(s)
            </Text>
            <Text size="sm" c="dimmed" mt="sm">
              You can find these drafts in the Communications section
            </Text>
          </Box>
          <Button onClick={handleClose} fullWidth>
            Close
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
