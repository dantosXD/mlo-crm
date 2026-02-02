#!/usr/bin/env node

/**
 * Test workflow pause and resume functionality
 */

const http = require('http');

const API_URL = 'http://localhost:3000';

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testPauseResume() {
  console.log('Testing Workflow Pause/Resume Functionality...\n');

  try {
    // Step 1: Login
    console.log('1. Logging in...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {}, {
      email: 'workflowtest@example.com',
      password: 'password123',
    });

    if (loginResponse.statusCode !== 200) {
      console.log('✗ Login failed');
      return;
    }

    const token = loginResponse.body.accessToken;
    console.log('✓ Login successful\n');

    // Step 2: Get CSRF token
    console.log('2. Getting CSRF token...');
    const csrfResponse = await makeRequest('GET', '/api/workflows?limit=1', {
      Authorization: `Bearer ${token}`,
    });
    const csrfToken = csrfResponse.headers['x-csrf-token'];
    console.log('✓ CSRF token obtained\n');

    // Step 3: Get workflows
    console.log('3. Fetching workflows...');
    const workflowsResponse = await makeRequest('GET', '/api/workflows?limit=5', {
      Authorization: `Bearer ${token}`,
    });

    if (!workflowsResponse.body.workflows.length) {
      console.log('✗ No workflows found');
      return;
    }

    // Find an active workflow
    const workflow = workflowsResponse.body.workflows.find(w => w.isActive) || workflowsResponse.body.workflows[0];

    if (!workflow.isActive) {
      console.log('⚠ No active workflows found. Trying to activate one...');

      // Try to activate the first workflow
      const activateResponse = await makeRequest('PATCH', `/api/workflows/${workflow.id}/toggle`, {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      });

      if (activateResponse.statusCode === 200) {
        console.log('✓ Workflow activated successfully');
      } else {
        console.log('✗ Could not activate workflow');
        console.log(`  Status: ${activateResponse.statusCode}`);
        console.log(`  Body: ${JSON.stringify(activateResponse.body)}`);
        return;
      }
    }

    console.log(`✓ Found workflow: "${workflow.name}" (Active: ${workflow.isActive})\n`);

    // Step 3.5: Get a client for execution
    console.log('3.5. Getting a client for execution...');
    const clientsResponse = await makeRequest('GET', '/api/clients?limit=1', {
      Authorization: `Bearer ${token}`,
    });

    let clientId = null;
    if (clientsResponse.statusCode === 200 && clientsResponse.body.clients && clientsResponse.body.clients.length > 0) {
      clientId = clientsResponse.body.clients[0].id;
      console.log(`✓ Found client: ${clientsResponse.body.clients[0].name} (ID: ${clientId})\n`);
    } else {
      console.log('⚠ No clients found, will execute without client\n');
    }

    // Step 4: Execute workflow to create a running execution
    console.log('4. Starting workflow execution...');
    const executeResponse = await makeRequest('POST', `/api/workflows/${workflow.id}/execute`, {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    }, {
      clientId: clientId, // Use client ID if available
    });

    if (executeResponse.statusCode !== 200 && executeResponse.statusCode !== 201) {
      console.log('✗ Failed to execute workflow');
      console.log(`  Status: ${executeResponse.statusCode}`);
      console.log(`  Body: ${JSON.stringify(executeResponse.body)}`);
      return;
    }

    const execution = executeResponse.body.execution || executeResponse.body;
    console.log(`✓ Workflow execution started`);
    console.log(`  Execution ID: ${execution.id}`);
    console.log(`  Initial Status: ${execution.status}\n`);

    // Step 5: Pause the execution
    console.log('5. Pausing execution...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit

    const pauseResponse = await makeRequest('POST', `/api/workflows/executions/${execution.id}/pause`, {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    });

    if (pauseResponse.statusCode !== 200 && pauseResponse.statusCode !== 201) {
      console.log('✗ Failed to pause execution');
      console.log(`  Status: ${pauseResponse.statusCode}`);
      console.log(`  Body: ${JSON.stringify(pauseResponse.body)}`);

      // Check if it's because execution already finished
      if (pauseResponse.body && pauseResponse.body.message) {
        console.log(`  Note: ${pauseResponse.body.message}`);
      }
    } else {
      console.log('✓ Execution paused successfully');
      console.log(`  New Status: ${pauseResponse.body.status}\n`);

      // Step 6: Resume the execution
      console.log('6. Resuming execution...');
      const resumeResponse = await makeRequest('POST', `/api/workflows/executions/${execution.id}/resume`, {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      });

      if (resumeResponse.statusCode !== 200 && resumeResponse.statusCode !== 201) {
        console.log('✗ Failed to resume execution');
        console.log(`  Status: ${resumeResponse.statusCode}`);
        console.log(`  Body: ${JSON.stringify(resumeResponse.body)}`);
      } else {
        console.log('✓ Execution resumed successfully');
        console.log(`  New Status: ${resumeResponse.body.status}\n`);
      }
    }

    console.log('✓✓✓ Feature #316 Pause/Resume functionality test completed! ✓✓✓');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPauseResume();
