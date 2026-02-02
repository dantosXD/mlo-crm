#!/usr/bin/env node

/**
 * Test workflow clone functionality
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

    // Capture response headers for CSRF token

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testWorkflowClone() {
  console.log('Testing Workflow Clone Functionality...\n');

  try {
    // Step 1: Login
    console.log('1. Logging in as test user...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {}, {
      email: 'workflowtest@example.com',
      password: 'password123',
    });

    if (loginResponse.statusCode !== 200) {
      console.log('✗ Login failed');
      console.log(`  Status: ${loginResponse.statusCode}`);
      console.log(`  Body: ${JSON.stringify(loginResponse.body)}`);
      return;
    }

    const token = loginResponse.body.accessToken;
    console.log('✓ Login successful');
    console.log(`  User: ${loginResponse.body.user.name} (${loginResponse.body.user.role})\n`);

    // Step 2: Get CSRF token (sent in response headers of authenticated GET request)
    console.log('2. Getting CSRF token...');
    const csrfResponse = await makeRequest('GET', '/api/workflows?limit=1', {
      Authorization: `Bearer ${token}`,
    });
    const csrfToken = csrfResponse.headers['x-csrf-token'];
    console.log(`✓ CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'Not found'}\n`);

    // Step 3: Get workflows
    console.log('3. Fetching workflows...');
    const workflowsResponse = await makeRequest('GET', '/api/workflows?limit=5', {
      Authorization: `Bearer ${token}`,
    });

    if (workflowsResponse.statusCode !== 200 || !workflowsResponse.body.workflows.length) {
      console.log('✗ No workflows found to clone');
      return;
    }

    const workflowToClone = workflowsResponse.body.workflows[0];
    console.log(`✓ Found workflow: "${workflowToClone.name}"`);
    console.log(`  ID: ${workflowToClone.id}`);
    console.log(`  Trigger: ${workflowToClone.triggerType}`);
    console.log(`  Active: ${workflowToClone.isActive}`);
    console.log(`  Version: ${workflowToClone.version}\n`);

    // Step 4: Clone workflow
    console.log('4. Cloning workflow...');
    const cloneResponse = await makeRequest('POST', `/api/workflows/${workflowToClone.id}/clone`, {
      Authorization: `Bearer ${token}`,
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    });

    if (cloneResponse.statusCode !== 201) {
      console.log('✗ Clone failed');
      console.log(`  Status: ${cloneResponse.statusCode}`);
      console.log(`  Body: ${JSON.stringify(cloneResponse.body)}`);
      return;
    }

    const clonedWorkflow = cloneResponse.body;
    console.log('✓ Workflow cloned successfully!');
    console.log(`  Original name: "${workflowToClone.name}"`);
    console.log(`  Cloned name: "${clonedWorkflow.name}"`);
    console.log(`  Cloned ID: ${clonedWorkflow.id}`);
    console.log(`  Is Active: ${clonedWorkflow.isActive} (should be false)`);
    console.log(`  Is Template: ${clonedWorkflow.isTemplate} (should be false)`);
    console.log(`  Version: ${clonedWorkflow.version} (should be 1)`);
    console.log(`  Trigger Type: ${clonedWorkflow.triggerType} (should match original)`);

    // Verify all requirements
    console.log('\n5. Verifying requirements:');
    const checks = [
      { name: 'Name appended with " (Copy)"', pass: clonedWorkflow.name.includes(' (Copy)') },
      { name: 'isActive is false', pass: clonedWorkflow.isActive === false },
      { name: 'isTemplate is false', pass: clonedWorkflow.isTemplate === false },
      { name: 'Version is 1', pass: clonedWorkflow.version === 1 },
      { name: 'Trigger type matches', pass: clonedWorkflow.triggerType === workflowToClone.triggerType },
      { name: 'Actions array exists', pass: Array.isArray(clonedWorkflow.actions) && clonedWorkflow.actions.length > 0 },
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✓' : '✗';
      console.log(`  ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    if (allPassed) {
      console.log('\n✓✓✓ ALL CHECKS PASSED! Feature #315 is working correctly. ✓✓✓');
    } else {
      console.log('\n✗ Some checks failed');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWorkflowClone();
