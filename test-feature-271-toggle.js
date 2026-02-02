#!/usr/bin/env node

/**
 * Test Feature #271: Workflow Enable/Disable API
 *
 * This script tests:
 * 1. PATCH /api/workflows/:id/toggle endpoint exists
 * 2. Toggle changes is_active field
 * 3. Returns updated workflow
 * 4. Logs activity when enabled/disabled
 */

const http = require('http');

const API_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test@mlo.com';
const TEST_PASSWORD = 'test123';

// Track authentication state
let authToken = null;
let csrfToken = null;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (csrfToken) {
      options.headers['X-CSRF-Token'] = csrfToken;
    }

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
  log('\n=== Step 1: Login ===', 'blue');
  const response = await makeRequest('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (response.status !== 200) {
    log(`❌ Login failed: ${JSON.stringify(response.data)}`, 'red');
    process.exit(1);
  }

  authToken = response.data.token;
  csrfToken = response.headers['x-csrf-token'];

  // Extract cookies
  if (response.headers['set-cookie']) {
    const cookies = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'].join('; ')
      : response.headers['set-cookie'];
  }

  log(`✅ Logged in successfully`, 'green');
  log(`   Auth Token: ${authToken.substring(0, 20)}...`, 'yellow');
  log(`   CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'N/A'}`, 'yellow');
}

async function getWorkflows() {
  log('\n=== Step 2: Get Workflows ===', 'blue');
  const response = await makeRequest('GET', '/api/workflows');

  if (response.status !== 200) {
    log(`❌ Failed to fetch workflows: ${JSON.stringify(response.data)}`, 'red');
    return [];
  }

  log(`✅ Found ${response.data.workflows.length} workflows`, 'green');
  return response.data.workflows;
}

async function testToggleEndpoint(workflow) {
  log('\n=== Step 3: Test Toggle Endpoint ===', 'blue');
  log(`Testing with workflow: ${workflow.name}`, 'yellow');
  log(`Initial isActive: ${workflow.isActive}`, 'yellow');

  // First toggle
  log('\n--- Toggle 1: Enable/Disable workflow ---', 'blue');
  const response1 = await makeRequest('PATCH', `/api/workflows/${workflow.id}/toggle`);

  if (response1.status !== 200) {
    log(`❌ Toggle failed: ${JSON.stringify(response1.data)}`, 'red');
    return false;
  }

  const newStatus1 = response1.data.isActive;
  const expectedStatus1 = !workflow.isActive;

  if (newStatus1 !== expectedStatus1) {
    log(`❌ Status not toggled correctly. Expected ${expectedStatus1}, got ${newStatus1}`, 'red');
    return false;
  }

  log(`✅ First toggle successful`, 'green');
  log(`   Previous status: ${workflow.isActive}`, 'yellow');
  log(`   New status: ${newStatus1}`, 'yellow');

  // Wait a moment for activity log
  await new Promise(resolve => setTimeout(resolve, 500));

  // Check activity log
  log('\n--- Check Activity Log ---', 'blue');
  const activitiesResponse = await makeRequest('GET', '/api/activities');

  if (activitiesResponse.status !== 200) {
    log(`⚠️  Could not fetch activities`, 'yellow');
  } else {
    const recentActivities = activitiesResponse.data.activities || [];
    const toggleActivity = recentActivities.find(a =>
      a.type === (newStatus1 ? 'WORKFLOW_ENABLED' : 'WORKFLOW_DISABLED') &&
      a.description.includes(workflow.name)
    );

    if (toggleActivity) {
      log(`✅ Activity logged: ${toggleActivity.type}`, 'green');
      log(`   Description: ${toggleActivity.description}`, 'yellow');
      if (toggleActivity.metadata) {
        const metadata = JSON.parse(toggleActivity.metadata);
        log(`   Metadata: workflowId=${metadata.workflowId}, previousStatus=${metadata.previousStatus}, newStatus=${metadata.newStatus}`, 'yellow');
      }
    } else {
      log(`❌ Activity log not found for toggle action`, 'red');
      log(`   Recent activities:`, 'yellow');
      recentActivities.slice(0, 3).forEach(a => {
        log(`   - ${a.type}: ${a.description}`, 'yellow');
      });
      return false;
    }
  }

  // Second toggle (back to original)
  log('\n--- Toggle 2: Restore original status ---', 'blue');
  const response2 = await makeRequest('PATCH', `/api/workflows/${workflow.id}/toggle`);

  if (response2.status !== 200) {
    log(`❌ Second toggle failed: ${JSON.stringify(response2.data)}`, 'red');
    return false;
  }

  const newStatus2 = response2.data.isActive;
  const expectedStatus2 = workflow.isActive; // Should be back to original

  if (newStatus2 !== expectedStatus2) {
    log(`❌ Status not restored correctly. Expected ${expectedStatus2}, got ${newStatus2}`, 'red');
    return false;
  }

  log(`✅ Second toggle successful`, 'green');
  log(`   Status restored to: ${newStatus2}`, 'yellow');

  // Verify response structure
  log('\n--- Verify Response Structure ---', 'blue');
  const requiredFields = ['id', 'name', 'isActive', 'triggerType', 'actions', 'version', 'createdAt', 'updatedAt'];
  const missingFields = requiredFields.filter(f => !(f in response2.data));

  if (missingFields.length > 0) {
    log(`❌ Missing required fields: ${missingFields.join(', ')}`, 'red');
    return false;
  }

  log(`✅ Response structure valid`, 'green');
  log(`   All required fields present: ${requiredFields.join(', ')}`, 'yellow');

  return true;
}

async function runTests() {
  log('╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║   Feature #271: Workflow Enable/Disable API Test          ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  try {
    await login();

    const workflows = await getWorkflows();

    if (workflows.length === 0) {
      log('\n⚠️  No workflows found. Creating a test workflow...', 'yellow');

      const createResponse = await makeRequest('POST', '/api/workflows', {
        name: 'Test Toggle Workflow',
        description: 'Workflow for testing toggle functionality',
        triggerType: 'MANUAL',
        actions: [
          {
            type: 'LOG_ACTIVITY',
            description: 'Test action',
            config: {
              type: 'INFO',
              text: 'Test activity from toggle workflow',
            },
          },
        ],
      });

      if (createResponse.status !== 201) {
        log(`❌ Failed to create test workflow: ${JSON.stringify(createResponse.data)}`, 'red');
        process.exit(1);
      }

      workflows.push(createResponse.data);
      log(`✅ Created test workflow: ${createResponse.data.name}`, 'green');
    }

    const testWorkflow = workflows[0];
    const success = await testToggleEndpoint(testWorkflow);

    log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
    if (success) {
      log('║                    ✅ ALL TESTS PASSED                    ║', 'green');
      log('╚════════════════════════════════════════════════════════════╝', 'blue');
      log('\n✅ Feature #271 verified:', 'green');
      log('   - PATCH /api/workflows/:id/toggle endpoint exists', 'green');
      log('   - Toggle changes is_active field correctly', 'green');
      log('   - Returns updated workflow with all fields', 'green');
      log('   - Logs activity when workflow is enabled/disabled', 'green');
      process.exit(0);
    } else {
      log('║                    ❌ TESTS FAILED                        ║', 'red');
      log('╚════════════════════════════════════════════════════════════╝', 'blue');
      process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Test execution error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

runTests();
