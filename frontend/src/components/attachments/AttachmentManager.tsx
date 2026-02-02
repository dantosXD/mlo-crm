import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Paper,
  ActionIcon,
  Button,
  FileInput,
  Alert,
  Badge,
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTrash,
  IconDownload,
  IconPaperclip,
  IconUpload,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  uploadAttachment,
  deleteAttachment,
  formatFileSize,
  getFileIcon,
  type Attachment,
} from '../../utils/attachments';

interface AttachmentManagerProps {
  communicationId: string | null;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

export function AttachmentManager({
  communicationId,
  attachments,
  onAttachmentsChange,
  disabled = false,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
}: AttachmentManagerProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File | null) => {
    if (!file || !communicationId) return;

    // Validate file count
    if (attachments.length >= maxFiles) {
      notifications.show({
        title: 'Too many files',
        message: `Maximum ${maxFiles} files allowed`,
        color: 'red',
      });
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      notifications.show({
        title: 'File too large',
        message: `Maximum file size is ${formatFileSize(maxSize)}`,
        color: 'red',
      });
      return;
    }

    setUploading(true);

    try {
      const response = await uploadAttachment(communicationId, file);
      onAttachmentsChange(response.attachments);
      notifications.show({
        title: 'Success',
        message: 'Attachment uploaded successfully',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Upload failed',
        message: error.message || 'Failed to upload attachment',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (fileName: string) => {
    if (!communicationId) return;

    try {
      const response = await deleteAttachment(communicationId, fileName);
      onAttachmentsChange(response.attachments);
      notifications.show({
        title: 'Success',
        message: 'Attachment removed',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Delete failed',
        message: error.message || 'Failed to delete attachment',
        color: 'red',
      });
    }
  };

  const handleDownload = async (fileName: string) => {
    if (!communicationId) return;

    try {
      const response = await fetch(
        `/api/attachments/${communicationId}/download/${encodeURIComponent(fileName)}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();

      // Open download URL in new tab
      window.open(data.downloadUrl, '_blank');
    } catch (error: any) {
      notifications.show({
        title: 'Download failed',
        message: error.message || 'Failed to download attachment',
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="md">
      {/* Upload Section */}
      {!disabled && (
        <FileInput
          label="Add Attachment"
          placeholder="Click to upload or drag and drop"
          icon={<IconUpload size={14} />}
          onChange={handleFileUpload}
          disabled={!communicationId || uploading}
          accept="*/*"
          leftSection={<IconPaperclip size={14} />}
          styles={{
            input: {
              cursor: 'pointer',
            },
          }}
        />
      )}

      {/* File count info */}
      <Text size="sm" c="dimmed">
        {attachments.length} / {maxFiles} files (max {formatFileSize(maxSize)} each)
      </Text>

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
          No attachments yet. Upload files to attach them to this communication.
        </Alert>
      ) : (
        <Stack gap="xs">
          {attachments.map((attachment, index) => (
            <Paper
              key={index}
              p="sm"
              withBorder
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                <Text size="xl" aria-label="File icon">
                  {getFileIcon(attachment.mimeType)}
                </Text>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {attachment.fileName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatFileSize(attachment.fileSize)} • {attachment.mimeType}
                  </Text>
                </Box>
              </Group>

              <Group gap="xs">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  onClick={() => handleDownload(attachment.fileName)}
                  disabled={disabled}
                  aria-label="Download attachment"
                >
                  <IconDownload size={16} />
                </ActionIcon>
                {!disabled && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => handleDeleteAttachment(attachment.fileName)}
                    aria-label="Delete attachment"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
