/**
 * Test script for Feature #288 - Document Action Executors
 * Tests UPDATE_DOCUMENT_STATUS and REQUEST_DOCUMENT workflow actions
 */

const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';

// Get JWT token
function getToken() {
  return jwt.sign(
    { userId: 'admin-user-id', role: 'ADMIN' },
    process.env.JWT_SECRET || 'your-256-bit-secret',
    { expiresIn: '1h' }
  );
}

const headers = {
  'Authorization': `Bearer ${getToken()}`,
  'Content-Type': 'application/json',
};

async function testUpdateDocumentStatus() {
  console.log('\n========================================');
  console.log('TEST: UPDATE_DOCUMENT_STATUS Action');
  console.log('========================================\n');

  try {
    // First, create a test client
    const clientRes = await fetch(`${API_URL}/api/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Document Action Test Client',
        email: 'documentaction@test.com',
        phone: '555-0123',
        status: 'ACTIVE',
      }),
    });

    if (!clientRes.ok) {
      throw new Error(`Failed to create test client: ${clientRes.statusText}`);
    }

    const client = await clientRes.json();
    console.log('✅ Created test client:', client.id);

    // Create a test document
    const docRes = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: client.id,
        name: 'Test Document for Status Update',
        fileName: 'test.pdf',
        filePath: '/test/test.pdf',
        fileSize: 1234,
        mimeType: 'application/pdf',
        status: 'UPLOADED',
        category: 'INCOME',
      }),
    });

    if (!docRes.ok) {
      throw new Error(`Failed to create test document: ${docRes.statusText}`);
    }

    const document = await docRes.json();
    console.log('✅ Created test document:', document.id);
    console.log('   Initial status:', document.status);

    // Test 1: Update specific document status
    console.log('\n--- Test 1: Update specific document status ---');
    const updateRes = await fetch(`${API_URL}/api/workflows/test-action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actionType: 'UPDATE_DOCUMENT_STATUS',
        config: {
          status: 'UNDER_REVIEW',
          documentId: document.id,
        },
        context: {
          clientId: client.id,
          triggerType: 'MANUAL',
          triggerData: {},
          userId: 'admin-user-id',
        },
      }),
    });

    if (updateRes.ok) {
      const result = await updateRes.json();
      console.log('✅ Action executed successfully');
      console.log('   Message:', result.message);
      console.log('   Data:', JSON.stringify(result.data, null, 2));

      // Verify document was updated
      const verifyRes = await fetch(`${API_URL}/api/documents/${document.id}`, {
        headers,
      });

      if (verifyRes.ok) {
        const updatedDoc = await verifyRes.json();
        console.log('✅ Document status verified:', updatedDoc.status);
        if (updatedDoc.status === 'UNDER_REVIEW') {
          console.log('✅ TEST 1 PASSED: Document status updated correctly\n');
        } else {
          console.log('❌ TEST 1 FAILED: Document status not updated\n');
        }
      }
    } else {
      console.log('❌ Action execution failed:', await updateRes.text());
    }

    // Test 2: Update all documents for client
    console.log('\n--- Test 2: Update all documents for client ---');

    // Create another document
    const doc2Res = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: client.id,
        name: 'Second Test Document',
        fileName: 'test2.pdf',
        filePath: '/test/test2.pdf',
        fileSize: 5678,
        mimeType: 'application/pdf',
        status: 'UPLOADED',
        category: 'EMPLOYMENT',
      }),
    });

    if (doc2Res.ok) {
      const doc2 = await doc2Res.json();
      console.log('✅ Created second test document:', doc2.id);

      const updateAllRes = await fetch(`${API_URL}/api/workflows/test-action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          actionType: 'UPDATE_DOCUMENT_STATUS',
          config: {
            status: 'APPROVED',
            // No documentId - should update all documents
          },
          context: {
            clientId: client.id,
            triggerType: 'MANUAL',
            triggerData: {},
            userId: 'admin-user-id',
          },
        }),
      });

      if (updateAllRes.ok) {
        const result = await updateAllRes.json();
        console.log('✅ Action executed successfully');
        console.log('   Message:', result.message);
        console.log('   Updated count:', result.data?.count);

        // Verify both documents were updated
        const docsRes = await fetch(`${API_URL}/api/documents?clientId=${client.id}`, {
          headers,
        });

        if (docsRes.ok) {
          const docs = await docsRes.json();
          const allApproved = docs.data.every((d) => d.status === 'APPROVED');
          if (allApproved) {
            console.log('✅ TEST 2 PASSED: All documents updated to APPROVED\n');
          } else {
            console.log('❌ TEST 2 FAILED: Not all documents updated\n');
          }
        }
      } else {
        console.log('❌ Action execution failed:', await updateAllRes.text());
      }
    }

    // Test 3: Invalid status
    console.log('\n--- Test 3: Invalid status (should fail) ---');
    const invalidRes = await fetch(`${API_URL}/api/workflows/test-action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actionType: 'UPDATE_DOCUMENT_STATUS',
        config: {
          status: 'INVALID_STATUS',
          documentId: document.id,
        },
        context: {
          clientId: client.id,
          triggerType: 'MANUAL',
          triggerData: {},
          userId: 'admin-user-id',
        },
      }),
    });

    if (!invalidRes.ok) {
      const error = await invalidRes.json();
      console.log('✅ TEST 3 PASSED: Invalid status rejected');
      console.log('   Error:', error.message, '\n');
    } else {
      console.log('❌ TEST 3 FAILED: Invalid status should have been rejected\n');
    }

    // Cleanup
    await fetch(`${API_URL}/api/clients/${client.id}`, {
      method: 'DELETE',
      headers,
    });
    console.log('✅ Cleanup complete');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testRequestDocument() {
  console.log('\n========================================');
  console.log('TEST: REQUEST_DOCUMENT Action');
  console.log('========================================\n');

  try {
    // Create a test client
    const clientRes = await fetch(`${API_URL}/api/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Document Request Test Client',
        email: 'docrequest@test.com',
        phone: '555-0999',
        status: 'ACTIVE',
      }),
    });

    if (!clientRes.ok) {
      throw new Error(`Failed to create test client: ${clientRes.statusText}`);
    }

    const client = await clientRes.json();
    console.log('✅ Created test client:', client.id);

    // Test 1: Request document with all fields
    console.log('\n--- Test 1: Request document with all fields ---');
    const requestRes = await fetch(`${API_URL}/api/workflows/test-action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actionType: 'REQUEST_DOCUMENT',
        config: {
          category: 'INCOME',
          name: 'Pay Stubs - Last 30 Days',
          dueDays: 7,
          message: 'Please provide the most recent pay stubs for all applicants.',
        },
        context: {
          clientId: client.id,
          triggerType: 'MANUAL',
          triggerData: {},
          userId: 'admin-user-id',
        },
      }),
    });

    if (requestRes.ok) {
      const result = await requestRes.json();
      console.log('✅ Action executed successfully');
      console.log('   Message:', result.message);
      console.log('   Data:', JSON.stringify(result.data, null, 2));

      // Verify document was created with REQUESTED status
      const docsRes = await fetch(`${API_URL}/api/documents?clientId=${client.id}`, {
        headers,
      });

      if (docsRes.ok) {
        const docs = await docsRes.json();
        const requestedDoc = docs.data.find((d) => d.name === 'Pay Stubs - Last 30 Days');
        if (requestedDoc && requestedDoc.status === 'REQUESTED') {
          console.log('✅ Document created correctly');
          console.log('   Status:', requestedDoc.status);
          console.log('   Category:', requestedDoc.category);
          console.log('   Due Date:', requestedDoc.dueDate ? new Date(requestedDoc.dueDate).toLocaleDateString() : 'N/A');
          console.log('✅ TEST 1 PASSED\n');
        } else {
          console.log('❌ TEST 1 FAILED: Document not created or incorrect status\n');
        }
      }
    } else {
      console.log('❌ Action execution failed:', await requestRes.text());
    }

    // Test 2: Request document with category only (default name)
    console.log('\n--- Test 2: Request document with category only ---');
    const request2Res = await fetch(`${API_URL}/api/workflows/test-action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actionType: 'REQUEST_DOCUMENT',
        config: {
          category: 'EMPLOYMENT',
          dueDays: 14,
        },
        context: {
          clientId: client.id,
          triggerType: 'MANUAL',
          triggerData: {},
          userId: 'admin-user-id',
        },
      }),
    });

    if (request2Res.ok) {
      const result = await request2Res.json();
      console.log('✅ Action executed successfully');
      console.log('   Message:', result.message);

      // Verify document was created with default name
      const docsRes = await fetch(`${API_URL}/api/documents?clientId=${client.id}`, {
        headers,
      });

      if (docsRes.ok) {
        const docs = await docsRes.json();
        const empDoc = docs.data.find((d) => d.category === 'EMPLOYMENT' && d.name === 'Employment Document');
        if (empDoc) {
          console.log('✅ Document created with default name:', empDoc.name);
          console.log('✅ TEST 2 PASSED\n');
        } else {
          console.log('❌ TEST 2 FAILED: Default name document not found\n');
        }
      }
    } else {
      console.log('❌ Action execution failed:', await request2Res.text());
    }

    // Test 3: Invalid category (should fail)
    console.log('\n--- Test 3: Invalid category (should fail) ---');
    const invalidRes = await fetch(`${API_URL}/api/workflows/test-action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actionType: 'REQUEST_DOCUMENT',
        config: {
          category: 'INVALID_CATEGORY',
        },
        context: {
          clientId: client.id,
          triggerType: 'MANUAL',
          triggerData: {},
          userId: 'admin-user-id',
        },
      }),
    });

    if (!invalidRes.ok) {
      const error = await invalidRes.json();
      console.log('✅ TEST 3 PASSED: Invalid category rejected');
      console.log('   Error:', error.message, '\n');
    } else {
      console.log('❌ TEST 3 FAILED: Invalid category should have been rejected\n');
    }

    // Cleanup
    await fetch(`${API_URL}/api/clients/${client.id}`, {
      method: 'DELETE',
      headers,
    });
    console.log('✅ Cleanup complete');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function main() {
  console.log('\n========================================');
  console.log('FEATURE #288: DOCUMENT ACTIONS TEST SUITE');
  console.log('========================================\n');

  await testUpdateDocumentStatus();
  await testRequestDocument();

  console.log('\n========================================');
  console.log('ALL TESTS COMPLETED');
  console.log('========================================\n');
}

main();
