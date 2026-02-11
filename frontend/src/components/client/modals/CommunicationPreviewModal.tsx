import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Stack, Group, Badge, Text, Paper, SimpleGrid, Button, Tabs, Alert, Loader } from '@mantine/core';
import { IconMail, IconCopy, IconEye, IconSparkles, IconRefresh } from '@tabler/icons-react';
import { api } from '../../../utils/api';

interface Communication {
  id: string;
  type: string;
  status: string;
  subject?: string;
  body: string;
  recipient?: string;
  templateName?: string;
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
  followUpDate?: string;
  createdBy?: { name: string };
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
}

interface CommunicationPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  communication: Communication | null;
  clientId: string;
}

export function CommunicationPreviewModal({ opened, onClose, communication, clientId }: CommunicationPreviewModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [renderedPreview, setRenderedPreview] = useState<RenderedCommunicationPreview | null>(null);
  const [loadingRenderedPreview, setLoadingRenderedPreview] = useState(false);
  const [renderedPreviewError, setRenderedPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      setActiveTab('details');
      setRenderedPreview(null);
      setRenderedPreviewError(null);
    }
  }, [opened]);

  const loadRenderedPreview = async () => {
    if (!communication) return;

    setLoadingRenderedPreview(true);
    setRenderedPreviewError(null);

    try {
      const response = await api.post('/communications/preview', {
        clientId,
        body: communication.body,
        subject: communication.subject || undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to generate rendered preview');
      }

      const data = await response.json() as RenderedCommunicationPreview;
      setRenderedPreview(data);
    } catch (error) {
      console.error('Error loading rendered preview:', error);
      setRenderedPreview(null);
      setRenderedPreviewError('Unable to generate rendered preview');
    } finally {
      setLoadingRenderedPreview(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconMail size={20} aria-hidden="true" />
          <span>Communication Details</span>
        </Group>
      }
      size="lg"
    >
      {communication && (
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'details')}>
          <Tabs.List>
            <Tabs.Tab value="details" leftSection={<IconEye size={14} />}>
              Details
            </Tabs.Tab>
            <Tabs.Tab
              value="rendered"
              leftSection={<IconSparkles size={14} />}
              onClick={() => {
                if (!renderedPreview && !loadingRenderedPreview) {
                  void loadRenderedPreview();
                }
              }}
            >
              Final Rendered
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details" pt="md">
            <Stack gap="md">
              <Group gap="sm">
                <Badge color={
                  communication.type === 'EMAIL' ? 'blue' :
                  communication.type === 'SMS' ? 'cyan' : 'grape'
                }>
                  {communication.type}
                </Badge>
                <Badge color={
                  communication.status === 'SENT' || communication.status === 'DELIVERED' ? 'green' :
                  communication.status === 'FAILED' ? 'red' :
                  communication.status === 'DRAFT' ? 'gray' :
                  communication.status === 'SCHEDULED' ? 'cyan' : 'blue'
                }>
                  {communication.status}
                </Badge>
                {communication.templateName && (
                  <Badge variant="light" color="blue">Template: {communication.templateName}</Badge>
                )}
              </Group>

              {communication.subject && (
                <>
                  <Text size="sm" fw={500} c="dimmed">Subject</Text>
                  <Paper p="sm" withBorder>
                    <Text>{communication.subject}</Text>
                  </Paper>
                </>
              )}

              <Text size="sm" fw={500} c="dimmed">Message</Text>
              <Paper p="sm" withBorder style={{ maxHeight: 300, overflow: 'auto' }}>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{communication.body}</Text>
              </Paper>

              {communication.recipient && (
                <>
                  <Text size="sm" fw={500} c="dimmed">Recipient</Text>
                  <Text>{communication.recipient}</Text>
                </>
              )}

              <SimpleGrid cols={2}>
                <div>
                  <Text size="xs" c="dimmed">Created</Text>
                  <Text size="sm">{new Date(communication.createdAt).toLocaleString()}</Text>
                </div>
                {communication.scheduledAt && (
                  <div>
                    <Text size="xs" c="dimmed">Scheduled For</Text>
                    <Text size="sm">{new Date(communication.scheduledAt).toLocaleString()}</Text>
                  </div>
                )}
                {communication.sentAt && (
                  <div>
                    <Text size="xs" c="dimmed">Sent At</Text>
                    <Text size="sm">{new Date(communication.sentAt).toLocaleString()}</Text>
                  </div>
                )}
                {communication.followUpDate && (
                  <div>
                    <Text size="xs" c="dimmed">Follow-up Date</Text>
                    <Text size="sm">{new Date(communication.followUpDate).toLocaleDateString()}</Text>
                  </div>
                )}
              </SimpleGrid>

              {communication.createdBy && (
                <div>
                  <Text size="xs" c="dimmed">Created By</Text>
                  <Text size="sm">{communication.createdBy.name || 'Unknown'}</Text>
                </div>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="rendered" pt="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Final content with placeholders resolved for this client.
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconRefresh size={14} aria-hidden="true" />}
                  onClick={() => void loadRenderedPreview()}
                  loading={loadingRenderedPreview}
                >
                  Refresh
                </Button>
              </Group>

              {loadingRenderedPreview ? (
                <Group justify="center" py="lg">
                  <Loader size="sm" />
                </Group>
              ) : renderedPreviewError ? (
                <Alert color="red" title="Preview Error">
                  {renderedPreviewError}
                </Alert>
              ) : renderedPreview ? (
                (() => {
                  const previewSubject = renderedPreview.subject?.filled || communication.subject || '';
                  const previewBody = renderedPreview.body.filled || communication.body;
                  const missing = Array.from(
                    new Set([
                      ...renderedPreview.body.missing,
                      ...(renderedPreview.subject?.missing || []),
                    ]),
                  );

                  return (
                    <Stack gap="sm">
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

                      {previewSubject && (
                        <>
                          <Text size="sm" fw={500} c="dimmed">Final Subject</Text>
                          <Paper p="sm" withBorder>
                            <Text>{previewSubject}</Text>
                          </Paper>
                        </>
                      )}

                      <Text size="sm" fw={500} c="dimmed">Final Message</Text>
                      <Paper p="sm" withBorder style={{ maxHeight: 320, overflow: 'auto' }}>
                        <Text style={{ whiteSpace: 'pre-wrap' }}>{previewBody}</Text>
                      </Paper>
                    </Stack>
                  );
                })()
              ) : (
                <Text size="sm" c="dimmed">No rendered preview available.</Text>
              )}
            </Stack>
          </Tabs.Panel>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Close
            </Button>
            <Button
              leftSection={<IconCopy size={16} aria-hidden="true" />}
              onClick={() => {
                onClose();
                navigate(`/communications/${clientId}/compose`, {
                  state: { cloneFrom: communication }
                });
              }}
            >
              Clone and Reuse
            </Button>
          </Group>
        </Tabs>
      )}
    </Modal>
  );
}
