const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function testDocumentCascadeDelete() {
  console.log('=== Feature #118: Document Cascade Delete Test ===\n');

  // First, find MLO user
  const mloUser = await prisma.user.findFirst({
    where: { email: 'mlo@example.com' }
  });

  if (!mloUser) {
    console.log('ERROR: MLO user not found!');
    await prisma.$disconnect();
    return;
  }
  console.log(`Found MLO user: ${mloUser.id}`);

  // Step 1: Create a test client
  console.log('\nStep 1: Creating test client...');
  const testClient = await prisma.client.create({
    data: {
      nameEncrypted: JSON.stringify({ iv: 'test', content: 'test' }),
      emailEncrypted: JSON.stringify({ iv: 'test', content: 'test' }),
      phoneEncrypted: JSON.stringify({ iv: 'test', content: 'test' }),
      nameHash: 'cascade_doc_test_118',
      emailHash: 'cascade_doc_118@test.com',
      phoneHash: '5551181118',
      status: 'LEAD',
      createdById: mloUser.id
    }
  });
  console.log(`Created client: ${testClient.id}`);

  // Step 2: Create test documents for this client
  console.log('\nStep 2: Creating test documents...');
  const doc1 = await prisma.document.create({
    data: {
      clientId: testClient.id,
      name: 'CASCADE_DOC_TEST_1',
      fileName: 'test1.pdf',
      filePath: '/uploads/test1.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      category: 'INCOME'
    }
  });
  const doc2 = await prisma.document.create({
    data: {
      clientId: testClient.id,
      name: 'CASCADE_DOC_TEST_2',
      fileName: 'test2.pdf',
      filePath: '/uploads/test2.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      category: 'ASSETS'
    }
  });
  console.log(`Created documents: ${doc1.id}, ${doc2.id}`);

  // Step 3: Verify documents exist
  const docsBeforeDelete = await prisma.document.findMany({
    where: { clientId: testClient.id }
  });
  console.log(`\nStep 3: Documents before deletion: ${docsBeforeDelete.length}`);

  // Step 4: Delete the client
  console.log('\nStep 4: Deleting client...');
  await prisma.client.delete({
    where: { id: testClient.id }
  });
  console.log('Client deleted!');

  // Step 5: Verify documents are cascade deleted
  const docsAfterDelete = await prisma.document.findMany({
    where: { clientId: testClient.id }
  });
  console.log(`\nStep 5: Documents after deletion: ${docsAfterDelete.length}`);

  // Check for any cascade test documents
  const cascadeTestDocs = await prisma.document.findMany({
    where: {
      name: { contains: 'CASCADE_DOC_TEST' }
    }
  });
  console.log(`CASCADE_DOC_TEST documents remaining: ${cascadeTestDocs.length}`);

  if (docsAfterDelete.length === 0 && cascadeTestDocs.length === 0) {
    console.log('\n✅ SUCCESS: All documents were cascade deleted!');
  } else {
    console.log('\n❌ FAILED: Orphaned documents found!');
  }

  await prisma.$disconnect();
}

testDocumentCascadeDelete().catch(console.error);
