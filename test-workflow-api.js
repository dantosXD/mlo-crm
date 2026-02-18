// Test script for Workflow CRUD API
// This script tests all workflow endpoints with proper authentication
// Uses built-in fetch (Node.js 18+)

const API_URL = (process.env.API_URL || 'http://localhost:3002').replace(/\/$/, '');
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';

let authToken = null;
let testWorkflowId = null;
let csrfToken = null;
let sessionCookie = null;

// Helper function to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...(sessionCookie && { 'Cookie': sessionCookie }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const responseCsrfToken = response.headers.get('X-CSRF-Token');
    if (responseCsrfToken) {
      csrfToken = responseCsrfToken;
    }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie;
    }
    const data = await response.json();
    return { status: response.status, data, headers: response.headers };
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    return { status: 0, data: { error: error.message } };
  }
}

// Step 1: Login as admin
async function login() {
  console.log('\n🔐 Step 1: Login as admin...');
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  if (result.status === 200 && (result.data.token || result.data.accessToken)) {
    authToken = result.data.token || result.data.accessToken;
    console.log('✅ Login successful');
    console.log(`   User: ${result.data.user.email} (${result.data.user.role})`);
    return true;
  } else {
    console.log('❌ Login failed');
    console.log(JSON.stringify(result.data, null, 2));
    return false;
  }
}

// Step 2: Test GET /api/workflows (list workflows)
async function testListWorkflows() {
  console.log('\n📋 Step 2: List all workflows...');
  const result = await apiRequest('/api/workflows');

  if (result.status === 200) {
    console.log('✅ GET /api/workflows successful');
    console.log(`   Found ${result.data.workflows.length} workflow(s)`);
    if (result.data.workflows.length > 0) {
      console.log(`   Pagination: page ${result.data.pagination.page} of ${result.data.pagination.totalPages}`);
    }
    return result.data;
  } else {
    console.log('❌ GET /api/workflows failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 3: Test GET /api/workflows with filtering
async function testFilteredWorkflows() {
  console.log('\n🔍 Step 3: List workflows with filters...');
  const result = await apiRequest('/api/workflows?is_active=true&limit=10');

  if (result.status === 200) {
    console.log('✅ GET /api/workflows with filters successful');
    console.log(`   Found ${result.data.workflows.length} active workflow(s)`);
    return result.data;
  } else {
    console.log('❌ GET /api/workflows with filters failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 4: Test POST /api/workflows (create workflow)
async function testCreateWorkflow() {
  console.log('\n➕ Step 4: Create new workflow...');

  const newWorkflow = {
    name: 'Test Workflow - Feature 270',
    description: 'Automated test workflow for Feature 270 verification',
    isActive: true,
    isTemplate: false,
    triggerType: 'CLIENT_CREATED',
    triggerConfig: {},
    conditions: {
      clientStatus: 'LEAD',
    },
    actions: [
      {
        type: 'CREATE_TASK',
        config: {
          text: 'Follow up with new client',
          priority: 'HIGH',
          dueDays: 1,
        },
      },
      {
        type: 'SEND_EMAIL',
        config: {
          templateId: 'welcome-email',
        },
      },
    ],
  };

  const result = await apiRequest('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(newWorkflow),
  });

  if (result.status === 201) {
    testWorkflowId = result.data.id;
    console.log('✅ POST /api/workflows successful');
    console.log(`   Workflow ID: ${testWorkflowId}`);
    console.log(`   Name: ${result.data.name}`);
    console.log(`   Version: ${result.data.version}`);
    return result.data;
  } else {
    console.log('❌ POST /api/workflows failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 5: Test GET /api/workflows/:id (get single workflow)
async function testGetWorkflow() {
  if (!testWorkflowId) {
    console.log('\n📄 Step 5: Get single workflow... SKIPPED (no workflow ID)');
    return null;
  }

  console.log('\n📄 Step 5: Get single workflow...');
  const result = await apiRequest(`/api/workflows/${testWorkflowId}`);

  if (result.status === 200) {
    console.log('✅ GET /api/workflows/:id successful');
    console.log(`   Name: ${result.data.name}`);
    console.log(`   Trigger: ${result.data.triggerType}`);
    console.log(`   Actions: ${result.data.actions.length} action(s)`);
    console.log(`   Executions: ${result.data.executions.length} execution(s)`);
    return result.data;
  } else {
    console.log('❌ GET /api/workflows/:id failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 6: Test PUT /api/workflows/:id (update workflow)
async function testUpdateWorkflow() {
  if (!testWorkflowId) {
    console.log('\n✏️  Step 6: Update workflow... SKIPPED (no workflow ID)');
    return null;
  }

  console.log('\n✏️  Step 6: Update workflow...');

  const updates = {
    name: 'Updated Test Workflow - Feature 270',
    description: 'Updated description for testing',
    isActive: false,
  };

  const result = await apiRequest(`/api/workflows/${testWorkflowId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  if (result.status === 200) {
    console.log('✅ PUT /api/workflows/:id successful');
    console.log(`   Updated name: ${result.data.name}`);
    console.log(`   Updated isActive: ${result.data.isActive}`);
    console.log(`   Version: ${result.data.version}`);
    return result.data;
  } else {
    console.log('❌ PUT /api/workflows/:id failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 7: Test PATCH /api/workflows/:id/toggle (toggle active status)
async function testToggleWorkflow() {
  if (!testWorkflowId) {
    console.log('\n🔄 Step 7: Toggle workflow... SKIPPED (no workflow ID)');
    return null;
  }

  console.log('\n🔄 Step 7: Toggle workflow active status...');
  const result = await apiRequest(`/api/workflows/${testWorkflowId}/toggle`, {
    method: 'PATCH',
  });

  if (result.status === 200) {
    console.log('✅ PATCH /api/workflows/:id/toggle successful');
    console.log(`   isActive: ${result.data.isActive}`);
    return result.data;
  } else {
    console.log('❌ PATCH /api/workflows/:id/toggle failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 8: Test GET /api/workflows/meta/trigger-types
async function testGetTriggerTypes() {
  console.log('\n🎯 Step 8: Get available trigger types...');
  const result = await apiRequest('/api/workflows/meta/trigger-types');

  if (result.status === 200) {
    console.log('✅ GET /api/workflows/meta/trigger-types successful');
    console.log(`   Found ${result.data.length} trigger type(s)`);
    result.data.forEach(trigger => {
      console.log(`   - ${trigger.type}: ${trigger.label}`);
    });
    return result.data;
  } else {
    console.log('❌ GET /api/workflows/meta/trigger-types failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 9: Test GET /api/workflows/meta/action-types
async function testGetActionTypes() {
  console.log('\n⚡ Step 9: Get available action types...');
  const result = await apiRequest('/api/workflows/meta/action-types');

  if (result.status === 200) {
    console.log('✅ GET /api/workflows/meta/action-types successful');
    console.log(`   Found ${result.data.length} action type(s)`);
    result.data.forEach(action => {
      console.log(`   - ${action.type}: ${action.label}`);
    });
    return result.data;
  } else {
    console.log('❌ GET /api/workflows/meta/action-types failed');
    console.log(JSON.stringify(result.data, null, 2));
    return null;
  }
}

// Step 10: Test DELETE /api/workflows/:id (delete workflow)
async function testDeleteWorkflow() {
  if (!testWorkflowId) {
    console.log('\n🗑️  Step 10: Delete workflow... SKIPPED (no workflow ID)');
    return false;
  }

  console.log('\n🗑️  Step 10: Delete workflow...');
  const result = await apiRequest(`/api/workflows/${testWorkflowId}`, {
    method: 'DELETE',
  });

  if (result.status === 200) {
    console.log('✅ DELETE /api/workflows/:id successful');
    console.log('   Workflow deleted');
    testWorkflowId = null;
    return true;
  } else {
    console.log('❌ DELETE /api/workflows/:id failed');
    console.log(JSON.stringify(result.data, null, 2));
    return false;
  }
}

// Step 11: Test role-based access control (MLO should not be able to create)
async function testRBAC() {
  console.log('\n🔒 Step 11: Test role-based access control...');

  // First, logout and login as MLO
  console.log('   Logging in as MLO user...');
  const mloLogin = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'mlo@example.com',
      password: 'password123',
    }),
  });

  if (mloLogin.status !== 200) {
    console.log('⚠️  Could not test MLO access - MLO login failed');
    return false;
  }

  const mloToken = mloLogin.data.token || mloLogin.data.accessToken;
  const headers = { 'Authorization': `Bearer ${mloToken}` };

  // Try to create a workflow as MLO (should fail with 403)
  const createResult = await apiRequest('/api/workflows', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Unauthorized Workflow',
      triggerType: 'MANUAL',
      actions: [{ type: 'CREATE_TASK', config: {} }],
    }),
  });

  if (createResult.status === 403) {
    console.log('✅ RBAC working correctly');
    console.log('   MLO cannot create workflows (403 Forbidden)');
    return true;
  } else {
    console.log('❌ RBAC not working properly');
    console.log(`   Expected 403, got ${createResult.status}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('==================================================');
  console.log('   Workflow CRUD API Test Suite - Feature #270');
  console.log('==================================================');

  const results = {
    login: false,
    list: false,
    filter: false,
    create: false,
    getSingle: false,
    update: false,
    toggle: false,
    triggerTypes: false,
    actionTypes: false,
    delete: false,
    rbac: false,
  };

  // Run tests
  results.login = await login();
  if (!results.login) {
    console.log('\n❌ Cannot continue without authentication');
    return;
  }

  results.list = !!(await testListWorkflows());
  results.filter = !!(await testFilteredWorkflows());
  results.create = !!(await testCreateWorkflow());
  results.getSingle = !!(await testGetWorkflow());
  results.update = !!(await testUpdateWorkflow());
  results.toggle = !!(await testToggleWorkflow());
  results.triggerTypes = !!(await testGetTriggerTypes());
  results.actionTypes = !!(await testGetActionTypes());
  results.delete = await testDeleteWorkflow();
  results.rbac = await testRBAC();

  // Summary
  console.log('\n==================================================');
  console.log('                    TEST SUMMARY                  ');
  console.log('==================================================');
  console.log(`Login:              ${results.login ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`List Workflows:     ${results.list ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Filter Workflows:   ${results.filter ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Create Workflow:    ${results.create ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Single:         ${results.getSingle ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Update Workflow:    ${results.update ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Toggle Workflow:    ${results.toggle ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Trigger Types:      ${results.triggerTypes ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Action Types:       ${results.actionTypes ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Delete Workflow:    ${results.delete ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`RBAC:               ${results.rbac ? '✅ PASS' : '❌ FAIL'}`);
  console.log('==================================================');

  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;
  console.log(`\nOverall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! Feature #270 is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the logs above.');
  }

  return passed === total;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
