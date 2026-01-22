const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestDocument() {
  try {
    // Get a test client
    const client = await prisma.client.findFirst({
      where: {
        nameEncrypted: {
          contains: 'PIPELINE_METRICS_TEST_219'
        }
      }
    });

    if (!client) {
      console.error('Test client not found');
      process.exit(1);
    }

    // Create test file content
    const testContent = `FEATURE 49 TEST DOCUMENT
========================
This is a test document for Feature #49 - Download uploaded document.
Created: January 22, 2026
Purpose: Testing document upload and download functionality

TEST CONTENT: UNIQUE_ID_FEATURE49_12345
This file should be downloadable from the UI.
`;

    // Create the uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Write the test file
    const fileName = `test-document-feature49-${Date.now()}.txt`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, testContent);

    // Get file stats
    const stats = fs.statSync(filePath);

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        clientId: client.id,
        name: 'Feature 49 Test Document',
        fileName: fileName,
        filePath: filePath,
        fileSize: stats.size,
        mimeType: 'text/plain',
        status: 'UPLOADED',
        category: 'OTHER',
        notes: 'Test document for Feature #49 verification',
      }
    });

    console.log('✅ Test document created successfully!');
    console.log('Document ID:', document.id);
    console.log('File Path:', filePath);
    console.log('Client:', client.nameEncrypted ? 'PIPELINE_METRICS_TEST_219' : 'Unknown');

  } catch (error) {
    console.error('Error creating test document:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestDocument();
