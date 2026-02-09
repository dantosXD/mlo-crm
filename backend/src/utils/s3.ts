import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '../config/env.js';
import { logger } from './logger.js';

const env = getEnv();

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: 'us-east-1', // MinIO default region
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = env.S3_BUCKET;

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
    logger.error('s3_upload_failed', {
      error: error instanceof Error ? error.message : String(error),
      fileName,
      mimeType,
      folder,
    });
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
    logger.error('s3_presign_failed', {
      error: error instanceof Error ? error.message : String(error),
      filePath,
    });
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
    logger.error('s3_delete_failed', {
      error: error instanceof Error ? error.message : String(error),
      filePath,
    });
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
    logger.error('s3_bulk_delete_failed', {
      error: error instanceof Error ? error.message : String(error),
      fileCount: filePaths.length,
    });
    throw new Error('Failed to delete files from storage');
  }
}

/**
 * Check whether object storage is reachable.
 */
export async function checkS3Health(): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadBucketCommand({
        Bucket: BUCKET_NAME,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export { s3Client, BUCKET_NAME };
