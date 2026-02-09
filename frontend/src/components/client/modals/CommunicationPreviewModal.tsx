import { useNavigate } from 'react-router-dom';
import { Modal, Stack, Group, Badge, Text, Paper, SimpleGrid, Button } from '@mantine/core';
import { IconMail, IconCopy } from '@tabler/icons-react';

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

interface CommunicationPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  communication: Communication | null;
  clientId: string;
}

export function CommunicationPreviewModal({ opened, onClose, communication, clientId }: CommunicationPreviewModalProps) {
  const navigate = useNavigate();

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
        </Stack>
      )}
    </Modal>
  );
}
