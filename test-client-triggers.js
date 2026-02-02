/**
 * Test Client Triggers
 *
 * This script tests the client event triggers by:
 * 1. Creating a test workflow for each trigger type
 * 2. Creating a test client (should fire CLIENT_CREATED)
 * 3. Updating the client (should fire CLIENT_UPDATED)
 * 4. Changing client status (should fire CLIENT_STATUS_CHANGED)
 */

const http = require('http');

const API_URL = 'http://localhost:3000';
let authToken = '';
let csrfToken = '';
let testUserId = '';

// Helper function to make HTTP requests
function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function login() {
  console.log('\n=== Step 1: Login ===');
  const response = await request('POST', '/api/auth/login', {
    email: 'admin@test.com',
    password: 'admin123',
  });

  if (response.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
  }

  authToken = response.data.token || response.data.accessToken;
  testUserId = response.data.user?.id || response.data.userId;

  // Make a GET request to generate CSRF token
  console.log('  Fetching CSRF token...');
  const csrfResponse = await request('GET', '/api/workflows', null, {
    Authorization: `Bearer ${authToken}`,
  });

  // Headers are lowercase in Node.js http response
  csrfToken = csrfResponse.headers['x-csrf-token'] || '';

  console.log('✓ Logged in successfully');
  console.log(`  User: ${response.data.user?.email || response.data.email}`);
  if (authToken && authToken.length > 20) {
    console.log(`  Token: ${authToken.substring(0, 20)}...`);
  } else {
    console.log(`  Token: ${authToken || 'No token'}`);
  }
  console.log(`  CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'Not received'}`);
}

async function createTestWorkflow(triggerType, name) {
  console.log(`\n=== Creating workflow: ${name} ===`);
  const response = await request('POST', '/api/workflows', {
    name,
    description: `Test workflow for ${triggerType} trigger`,
    isActive: true,
    isTemplate: false,
    triggerType,
    actions: [
      {
        type: 'ADD_NOTE',
        config: {
          text: `Automatic note from ${triggerType} workflow`,
          tags: 'automated,workflow-test',
        },
      },
    ],
  }, {
    Authorization: `Bearer ${authToken}`,
    'X-CSRF-Token': csrfToken,
  });

  if (response.status !== 201) {
    console.log(`✗ Failed to create workflow: ${JSON.stringify(response.data)}`);
    return null;
  }

  console.log(`✓ Created workflow with ID: ${response.data.id}`);
  return response.data.id;
}

async function createTestClient() {
  console.log('\n=== Step 2: Create Test Client (CLIENT_CREATED trigger) ===');
  const timestamp = Date.now();
  const response = await request('POST', '/api/clients', {
    name: `Trigger Test Client ${timestamp}`,
    email: `trigger-test-${timestamp}@example.com`,
    phone: '555-0100',
    status: 'LEAD',
    tags: ['trigger-test'],
  }, {
    Authorization: `Bearer ${authToken}`,
    'X-CSRF-Token': csrfToken,
  });

  if (response.status !== 201) {
    throw new Error(`Failed to create client: ${JSON.stringify(response.data)}`);
  }

  console.log('✓ Client created successfully');
  console.log(`  Client ID: ${response.data.id}`);
  console.log(`  Name: ${response.data.name}`);
  console.log('  This should have triggered CLIENT_CREATED workflows');

  // Wait a bit for workflow execution
  await sleep(2000);

  return response.data.id;
}

async function updateTestClient(clientId) {
  console.log('\n=== Step 3: Update Test Client (CLIENT_UPDATED trigger) ===');
  const response = await request('PUT', `/api/clients/${clientId}`, {
    phone: '555-0199',
  }, {
    Authorization: `Bearer ${authToken}`,
    'X-CSRF-Token': csrfToken,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to update client: ${JSON.stringify(response.data)}`);
  }

  console.log('✓ Client updated successfully');
  console.log('  This should have triggered CLIENT_UPDATED workflows');

  // Wait for workflow execution
  await sleep(2000);
}

async function changeClientStatus(clientId) {
  console.log('\n=== Step 4: Change Client Status (CLIENT_STATUS_CHANGED trigger) ===');
  const response = await request('PUT', `/api/clients/${clientId}`, {
    status: 'ACTIVE',
  }, {
    Authorization: `Bearer ${authToken}`,
    'X-CSRF-Token': csrfToken,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to change status: ${JSON.stringify(response.data)}`);
  }

  console.log('✓ Client status changed from LEAD to ACTIVE');
  console.log('  This should have triggered CLIENT_STATUS_CHANGED workflows');

  // Wait for workflow execution
  await sleep(2000);
}

async function checkWorkflowExecutions(clientId) {
  console.log('\n=== Step 5: Check Workflow Executions ===');
  const response = await request('GET', '/api/workflow-executions?limit=20', null, {
    Authorization: `Bearer ${authToken}`,
  });

  if (response.status !== 200) {
    console.log(`✗ Failed to fetch executions: ${JSON.stringify(response.data)}`);
    return;
  }

  const clientExecutions = response.data.executions.filter(
    e => e.clientId === clientId
  );

  console.log(`\n✓ Found ${clientExecutions.length} workflow executions for this client:`);
  clientExecutions.forEach((exec, index) => {
    console.log(`\n  Execution ${index + 1}:`);
    console.log(`    ID: ${exec.id}`);
    console.log(`    Workflow: ${exec.workflowName}`);
    console.log(`    Status: ${exec.status}`);
    console.log(`    Trigger: ${exec.triggerType}`);
    console.log(`    Started: ${exec.startedAt}`);
    if (exec.errorMessage) {
      console.log(`    Error: ${exec.errorMessage}`);
    }
  });

  if (clientExecutions.length === 0) {
    console.log('\n⚠ No workflow executions found. This could mean:');
    console.log('  - Triggers are not firing');
    console.log('  - Workflows are not active');
    console.log('  - Workflows failed to execute');
  }
}

async function checkClientNotes(clientId) {
  console.log('\n=== Step 6: Check Client Notes ===');
  const response = await request('GET', `/api/clients/${clientId}`, null, {
    Authorization: `Bearer ${authToken}`,
  });

  if (response.status !== 200) {
    console.log(`✗ Failed to fetch client: ${JSON.stringify(response.data)}`);
    return;
  }

  console.log(`\n✓ Client has ${response.data.notes.length} notes:`);
  response.data.notes.forEach((note, index) => {
    console.log(`\n  Note ${index + 1}:`);
    console.log(`    Text: ${note.text.substring(0, 100)}...`);
    console.log(`    Tags: ${note.tags.join(', ')}`);
    console.log(`    Created: ${note.createdAt}`);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Client Trigger System Test                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Step 1: Login
    await login();

    // Step 2: Create test workflows
    const workflow1 = await createTestWorkflow('CLIENT_CREATED', 'Test: Client Created');
    const workflow2 = await createTestWorkflow('CLIENT_UPDATED', 'Test: Client Updated');
    const workflow3 = await createTestWorkflow('CLIENT_STATUS_CHANGED', 'Test: Client Status Changed');

    if (!workflow1 || !workflow2 || !workflow3) {
      throw new Error('Failed to create test workflows');
    }

    await sleep(1000);

    // Step 3: Create test client (fires CLIENT_CREATED)
    const clientId = await createTestClient();

    // Step 4: Update client (fires CLIENT_UPDATED)
    await updateTestClient(clientId);

    // Step 5: Change status (fires CLIENT_STATUS_CHANGED)
    await changeClientStatus(clientId);

    // Step 6: Check results
    await checkWorkflowExecutions(clientId);
    await checkClientNotes(clientId);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Test Complete                                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n✓ All trigger tests completed');
    console.log('\nTo clean up, delete the test workflows and client manually.');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
