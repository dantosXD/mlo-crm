import { API_URL } from './apiBase';

export interface Attachment {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface AttachmentUploadResponse {
  message: string;
  attachment: Attachment;
  attachments: Attachment[];
}

/**
 * Upload an attachment to a communication
 * @param communicationId - ID of the communication
 * @param file - File to upload
 * @returns Upload response with attachment info
 */
export async function uploadAttachment(
  communicationId: string,
  file: File
): Promise<AttachmentUploadResponse> {
  // Convert file to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
  });
  reader.readAsDataURL(file);

  const base64Data = await base64Promise;

  const response = await fetch(`${API_URL}/attachments/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      communicationId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileData: base64Data,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload attachment');
  }

  return response.json();
}

/**
 * Get a download URL for an attachment
 * @param communicationId - ID of the communication
 * @param fileName - Name of the file
 * @returns Download URL response
 */
export async function getAttachmentDownloadUrl(
  communicationId: string,
  fileName: string
): Promise<{ fileName: string; fileSize: number; mimeType: string; downloadUrl: string }> {
  const response = await fetch(
    `${API_URL}/attachments/${communicationId}/download/${encodeURIComponent(fileName)}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get download URL');
  }

  return response.json();
}

/**
 * Delete an attachment from a communication
 * @param communicationId - ID of the communication
 * @param fileName - Name of the file to delete
 * @returns Success response
 */
export async function deleteAttachment(
  communicationId: string,
  fileName: string
): Promise<{ message: string; attachments: Attachment[] }> {
  const response = await fetch(
    `${API_URL}/attachments/${communicationId}/${encodeURIComponent(fileName)}`,
    {
      method: 'DELETE',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete attachment');
  }

  return response.json();
}

/**
 * Delete all attachments from a communication
 * @param communicationId - ID of the communication
 * @returns Success response
 */
export async function deleteAllAttachments(
  communicationId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/attachments/${communicationId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete attachments');
  }

  return response.json();
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon based on MIME type
 * @param mimeType - MIME type of the file
 * @returns Icon name or emoji
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';
  return '📎';
}
