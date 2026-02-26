import { Stack, Paper, Group, Text, Title, Button, Badge, Select, ActionIcon } from '@mantine/core';
import { IconPlus, IconPackage, IconUpload, IconFiles, IconAlertTriangle, IconDownload, IconTrash } from '@tabler/icons-react';
import { EmptyState } from '../EmptyState';
import { isDocumentExpired, isDocumentExpiringSoon } from '../../utils/documentUtils';
import { DOCUMENT_STATUS_COLORS, DOCUMENT_CATEGORY_LABELS } from '../../utils/constants';
import type { ClientDocument } from '../../types';

interface DocumentsTabProps {
  documents: ClientDocument[];
  loadingDocuments: boolean;
  onAddDocument: () => void;
  onAssignPackage: () => void;
  onRequestDocument: () => void;
  onUpdateStatus: (documentId: string, newStatus: ClientDocument['status']) => void;
  onDownload: (documentId: string, fileName: string) => void;
  onDelete: (documentId: string) => void;
}

export function DocumentsTab({
  documents,
  loadingDocuments,
  onAddDocument,
  onAssignPackage,
  onRequestDocument,
  onUpdateStatus,
  onDownload,
  onDelete,
}: DocumentsTabProps) {
  const documentStatusColors = DOCUMENT_STATUS_COLORS;
  const documentCategoryLabels = DOCUMENT_CATEGORY_LABELS;

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Documents</Title>
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconPackage size={16} aria-hidden="true" />}
            onClick={onAssignPackage}
          >
            Assign Package
          </Button>
          <Button
            variant="light"
            leftSection={<IconUpload size={16} aria-hidden="true" />}
            onClick={onRequestDocument}
          >
            Request Document
          </Button>
          <Button
            leftSection={<IconPlus size={16} aria-hidden="true" />}
            onClick={onAddDocument}
          >
            Add Document
          </Button>
        </Group>
      </Group>
      {loadingDocuments ? (
        <Text c="dimmed">Loading documents...</Text>
      ) : documents.length === 0 ? (
        <EmptyState
          iconType="documents"
          title="No documents yet"
          description="Start with Request Document to send a checklist, or Add Document if the file is already on hand."
          ctaLabel="Add First Document"
          onCtaClick={onAddDocument}
        />
      ) : (
        <Stack gap="md">
          {documents.map((doc) => {
            const expired = isDocumentExpired(doc);
            const expiringSoon = isDocumentExpiringSoon(doc);
            return (
              <Paper
                key={doc.id}
                p="md"
                withBorder
                style={{
                  ...(expired ? { borderColor: 'var(--mantine-color-red-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-red-0)' } : {}),
                  ...(expiringSoon && !expired ? { borderColor: 'var(--mantine-color-yellow-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-yellow-0)' } : {}),
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <div style={{ flex: 1 }}>
                    <Group gap="sm" mb="xs">
                      <IconFiles size={20} aria-hidden="true" />
                      <Text fw={500}>{doc.name}</Text>
                      {expired && (
                        <Badge color="red" variant="filled" size="sm">EXPIRED</Badge>
                      )}
                      {expiringSoon && !expired && (
                        <Badge color="yellow" variant="filled" size="sm" leftSection={<IconAlertTriangle size={12} aria-hidden="true" />}>
                          EXPIRING SOON
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">{doc.fileName}</Text>
                    {doc.notes && (
                      <Text size="sm" c="dimmed" mt="xs">{doc.notes}</Text>
                    )}
                  </div>
                  <Group gap="xs">
                    <Badge color={documentCategoryLabels[doc.category] ? 'blue' : 'gray'} variant="light" size="sm">
                      {documentCategoryLabels[doc.category] || doc.category}
                    </Badge>
                    <Select
                      size="xs"
                      value={doc.status}
                      data={[
                        { value: 'REQUIRED', label: 'Required' },
                        { value: 'REQUESTED', label: 'Requested' },
                        { value: 'UPLOADED', label: 'Uploaded' },
                        { value: 'UNDER_REVIEW', label: 'Under Review' },
                        { value: 'APPROVED', label: 'Approved' },
                        { value: 'REJECTED', label: 'Rejected' },
                        { value: 'EXPIRED', label: 'Expired' },
                      ]}
                      onChange={(value) => value && onUpdateStatus(doc.id, value as ClientDocument['status'])}
                      styles={{
                        input: {
                          backgroundColor: `var(--mantine-color-${documentStatusColors[doc.status]}-1)`,
                          color: `var(--mantine-color-${documentStatusColors[doc.status]}-9)`,
                          fontWeight: 500,
                        },
                      }}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => onDownload(doc.id, doc.fileName)}
                      aria-label={`Download document ${doc.name}`}
                    >
                      <IconDownload size={16} aria-hidden="true" />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => onDelete(doc.id)} aria-label={`Delete document ${doc.name}`}>
                      <IconTrash size={16} aria-hidden="true" />
                    </ActionIcon>
                  </Group>
                </Group>
                <Group justify="space-between" mt="sm">
                  <Group gap="xs">
                    {doc.dueDate && (
                      <Text size="xs" c="dimmed">Due: {new Date(doc.dueDate).toLocaleDateString()}</Text>
                    )}
                    {doc.expiresAt && (
                      <Text size="xs" c={expired ? 'red' : expiringSoon ? 'yellow.7' : 'dimmed'} fw={expired || expiringSoon ? 600 : 400}>
                        Expires: {new Date(doc.expiresAt).toLocaleDateString()}
                      </Text>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Created: {new Date(doc.createdAt).toLocaleDateString()}
                  </Text>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </>
  );
}
