import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1', // MinIO default region
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minio',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minio123',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET || 'mlo-documents';

export interface UploadedFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Upload a file to S3-compatible storage
 * @param fileBuffer - File buffer
 * @param fileName - Original file name
 * @param mimeType - MIME type
 * @param folder - Optional folder path (e.g., 'communications/', 'documents/')
 * @returns File metadata object
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'communications/'
): Promise<UploadedFile> {
  try {
    // Generate unique file name with timestamp
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop();
    const baseName = fileName.replace(`.${extension}`, '');
    const uniqueFileName = `${folder}${timestamp}-${randomString}-${baseName}.${extension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await s3Client.send(command);

    return {
      fileName: fileName,
      filePath: uniqueFileName,
      fileSize: fileBuffer.length,
      mimeType: mimeType,
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file to storage');
  }
}

/**
 * Get a presigned URL for downloading a file
 * @param filePath - S3 file path
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Presigned URL
 */
export async function getPresignedDownloadUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

/**
 * Delete a file from S3
 * @param filePath - S3 file path
 */
export async function deleteFileFromS3(filePath: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error('Failed to delete file from storage');
  }
}

/**
 * Delete multiple files from S3
 * @param filePaths - Array of S3 file paths
 */
export async function deleteMultipleFilesFromS3(filePaths: string[]): Promise<void> {
  try {
    await Promise.all(filePaths.map(filePath => deleteFileFromS3(filePath)));
  } catch (error) {
    console.error('Error deleting multiple files from S3:', error);
    throw new Error('Failed to delete files from storage');
  }
}

export { s3Client, BUCKET_NAME };
