import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function createTestDocument() {
  try {
    // Create test file content
    const testContent = `FEATURE 50 TEST DOCUMENT
========================
This is a test document for Feature #50 verification.
Feature #50: Download uploaded document

Created: January 22, 2026
Purpose: Test document download functionality

If you can read this, the download works correctly!`;

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const destFile = path.join(uploadsDir, 'feature50_test.txt');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(destFile, testContent);

    // Get client ID
    const clientId = '072acf80-7242-4795-a181-0d4ad5f284a8';

    // Get user ID
    const user = await prisma.user.findUnique({
      where: { email: 'mlo@example.com' }
    });

    if (!user) {
      console.error('User not found');
      process.exit(1);
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        clientId: clientId,
        name: 'FEATURE_50_DOWNLOAD_TEST',
        fileName: 'feature50_test.txt',
        filePath: destFile,
        fileSize: fs.statSync(destFile).size,
        mimeType: 'text/plain',
        status: 'UPLOADED',
        category: 'OTHER',
        notes: 'Test document for Feature #50 - Download uploaded document verification',
      }
    });

    console.log('✅ Test document created successfully!');
    console.log('Document ID:', document.id);
    console.log('Document Name:', document.name);
    console.log('File Path:', document.filePath);
    console.log('\nYou can now test the download functionality in the UI.');

  } catch (error) {
    console.error('Error creating test document:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestDocument();
