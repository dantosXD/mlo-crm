/**
 * Test script for Feature #272 - Workflow Execution API
 *
 * Tests:
 * 1. POST /api/workflows/:id/execute - Execute a workflow
 * 2. GET /api/workflow-executions - List executions
 * 3. GET /api/workflow-executions/:id - Get single execution
 * 4. POST /api/workflow-executions/:id/cancel - Cancel execution
 * 5. GET /api/workflow-executions/:id/logs - Get execution logs
 */

const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:3000';

// Test user credentials
const TEST_USER = {
  email: 'admin@example.com',
  password: 'admin123',
};

let authToken = null;
let testWorkflowId = null;
let testClientId = null;
let testExecutionId = null;

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken && !endpoint.includes('/auth/login')) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

// Test 1: Login
async function testLogin() {
  console.log('\n=== Test 1: Login ===');
  const { status, data } = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(TEST_USER),
  });

  if (status === 200 && data.token) {
    authToken = data.token;
    console.log('✅ Login successful');
    console.log('   Token:', authToken.substring(0, 20) + '...');
    return true;
  } else {
    console.log('❌ Login failed');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 2: Get or create a test client
async function getOrCreateTestClient() {
  console.log('\n=== Test 2: Get or Create Test Client ===');

  // Try to get an existing client first
  const { status, data } = await apiCall('/api/clients?limit=1');

  if (status === 200 && data.clients && data.clients.length > 0) {
    testClientId = data.clients[0].id;
    console.log('✅ Using existing client');
    console.log('   Client ID:', testClientId);
    return true;
  }

  // Create a test client
  const newClient = {
    name: 'Workflow Test Client',
    email: 'workflowtest@example.com',
    phone: '555-0199',
    status: 'LEAD',
  };

  const { status: createStatus, data: createData } = await apiCall('/api/clients', {
    method: 'POST',
    body: JSON.stringify(newClient),
  });

  if (createStatus === 201 && createData.id) {
    testClientId = createData.id;
    console.log('✅ Test client created');
    console.log('   Client ID:', testClientId);
    return true;
  } else {
    console.log('❌ Failed to create test client');
    console.log('   Status:', createStatus);
    console.log('   Data:', createData);
    return false;
  }
}

// Test 3: Create a test workflow
async function createTestWorkflow() {
  console.log('\n=== Test 3: Create Test Workflow ===');

  const workflow = {
    name: 'TEST_EXECUTION_WORKFLOW',
    description: 'Workflow for testing execution API',
    isActive: true,
    triggerType: 'MANUAL',
    actions: [
      {
        type: 'ADD_NOTE',
        config: {
          text: 'Automated note from workflow execution test',
          tags: 'workflow-test,automated',
        },
      },
      {
        type: 'CREATE_TASK',
        config: {
          text: 'Task created by workflow execution test',
          priority: 'MEDIUM',
          dueDays: 7,
        },
      },
    ],
  };

  const { status, data } = await apiCall('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });

  if (status === 201 && data.id) {
    testWorkflowId = data.id;
    console.log('✅ Test workflow created');
    console.log('   Workflow ID:', testWorkflowId);
    return true;
  } else {
    console.log('❌ Failed to create test workflow');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 4: Execute workflow (POST /api/workflows/:id/execute)
async function testExecuteWorkflow() {
  console.log('\n=== Test 4: Execute Workflow ===');

  if (!testWorkflowId || !testClientId) {
    console.log('❌ Missing workflow ID or client ID');
    return false;
  }

  const { status, data } = await apiCall(`/api/workflows/${testWorkflowId}/execute`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: testClientId,
      triggerData: { test: 'execution' },
    }),
  });

  if (status === 200 || status === 201) {
    testExecutionId = data.executionId;
    console.log('✅ Workflow executed successfully');
    console.log('   Execution ID:', data.executionId);
    console.log('   Status:', data.status);
    console.log('   Message:', data.message);
    console.log('   Current Step:', data.currentStep);
    console.log('   Total Steps:', data.totalSteps);
    return true;
  } else {
    console.log('❌ Workflow execution failed');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 5: List workflow executions (GET /api/workflow-executions)
async function testListExecutions() {
  console.log('\n=== Test 5: List Workflow Executions ===');

  const { status, data } = await apiCall(
    `/api/workflow-executions?workflow_id=${testWorkflowId}&limit=10`
  );

  if (status === 200) {
    console.log('✅ Workflow executions listed successfully');
    console.log('   Total:', data.pagination.total);
    console.log('   Executions:', data.executions.length);
    if (data.executions.length > 0) {
      console.log('   First execution:', {
        id: data.executions[0].id,
        status: data.executions[0].status,
        workflowName: data.executions[0].workflowName,
      });
    }
    return true;
  } else {
    console.log('❌ Failed to list executions');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 6: Get single execution (GET /api/workflow-executions/:id)
async function testGetExecution() {
  console.log('\n=== Test 6: Get Single Execution ===');

  if (!testExecutionId) {
    console.log('❌ Missing execution ID');
    return false;
  }

  const { status, data } = await apiCall(`/api/workflow-executions/${testExecutionId}`);

  if (status === 200) {
    console.log('✅ Execution retrieved successfully');
    console.log('   ID:', data.id);
    console.log('   Status:', data.status);
    console.log('   Workflow:', data.workflow.name);
    console.log('   Client:', data.client?.name || 'N/A');
    console.log('   Current Step:', data.currentStep);
    console.log('   Started At:', data.startedAt);
    console.log('   Completed At:', data.completedAt || 'Still running');
    console.log('   Error Message:', data.errorMessage || 'None');
    return true;
  } else {
    console.log('❌ Failed to get execution');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 7: Get execution logs (GET /api/workflow-executions/:id/logs)
async function testGetExecutionLogs() {
  console.log('\n=== Test 7: Get Execution Logs ===');

  if (!testExecutionId) {
    console.log('❌ Missing execution ID');
    return false;
  }

  const { status, data } = await apiCall(`/api/workflow-executions/${testExecutionId}/logs`);

  if (status === 200) {
    console.log('✅ Execution logs retrieved successfully');
    console.log('   Total logs:', data.logs?.length || 0);
    if (data.logs && data.logs.length > 0) {
      console.log('   First log:', {
        stepIndex: data.logs[0].stepIndex,
        actionType: data.logs[0].actionType,
        status: data.logs[0].status,
        executedAt: data.logs[0].executedAt,
      });
    }
    return true;
  } else {
    console.log('❌ Failed to get execution logs');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 8: Cancel execution (POST /api/workflow-executions/:id/cancel)
async function testCancelExecution() {
  console.log('\n=== Test 8: Cancel Execution ===');

  // First, create a long-running workflow (with WAIT action)
  const longRunningWorkflow = {
    name: 'LONG_RUNNING_TEST_WORKFLOW',
    description: 'Long running workflow for cancellation test',
    isActive: true,
    triggerType: 'MANUAL',
    actions: [
      {
        type: 'WAIT',
        config: {
          delayMinutes: 5,
        },
      },
      {
        type: 'ADD_NOTE',
        config: {
          text: 'This note should not be created',
        },
      },
    ],
  };

  const { status: createStatus, data: createData } = await apiCall('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(longRunningWorkflow),
  });

  if (createStatus !== 201) {
    console.log('❌ Failed to create long-running workflow');
    return false;
  }

  const longRunningWorkflowId = createData.id;

  // Execute the workflow
  const { status: execStatus, data: execData } = await apiCall(
    `/api/workflows/${longRunningWorkflowId}/execute`,
    {
      method: 'POST',
      body: JSON.stringify({
        clientId: testClientId,
      }),
    }
  );

  if (execStatus !== 200 && execStatus !== 201) {
    console.log('❌ Failed to execute long-running workflow');
    return false;
  }

  const executionToCancel = execData.executionId;

  // Try to cancel it
  const { status: cancelStatus, data: cancelData } = await apiCall(
    `/api/workflow-executions/${executionToCancel}/cancel`,
    {
      method: 'POST',
    }
  );

  if (cancelStatus === 200) {
    console.log('✅ Execution cancelled successfully');
    console.log('   Message:', cancelData.message);
    return true;
  } else {
    console.log('❌ Failed to cancel execution');
    console.log('   Status:', cancelStatus);
    console.log('   Data:', cancelData);
    return false;
  }
}

// Test 9: Execute workflow without clientId
async function testExecuteWorkflowWithoutClient() {
  console.log('\n=== Test 9: Execute Workflow Without Client ===');

  const workflowNoClient = {
    name: 'TEST_NO_CLIENT_WORKFLOW',
    description: 'Workflow that runs without a client',
    isActive: true,
    triggerType: 'MANUAL',
    actions: [
      {
        type: 'LOG_ACTIVITY',
        config: {
          activityType: 'WORKFLOW_TEST',
          description: 'Test activity without client',
        },
      },
    ],
  };

  const { status: createStatus, data: createData } = await apiCall('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflowNoClient),
  });

  if (createStatus !== 201) {
    console.log('❌ Failed to create workflow without client');
    return false;
  }

  const { status, data } = await apiCall(`/api/workflows/${createData.id}/execute`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (status === 200 || status === 201) {
    console.log('✅ Workflow executed without client successfully');
    console.log('   Execution ID:', data.executionId);
    console.log('   Status:', data.status);
    return true;
  } else {
    console.log('❌ Failed to execute workflow without client');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 10: Filter executions by status
async function testFilterExecutionsByStatus() {
  console.log('\n=== Test 10: Filter Executions by Status ===');

  const { status, data } = await apiCall('/api/workflow-executions?status=COMPLETED&limit=10');

  if (status === 200) {
    console.log('✅ Executions filtered by status successfully');
    console.log('   Total completed:', data.pagination.total);
    console.log('   Executions returned:', data.executions.length);
    return true;
  } else {
    console.log('❌ Failed to filter executions by status');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 11: Filter executions by client
async function testFilterExecutionsByClient() {
  console.log('\n=== Test 11: Filter Executions by Client ===');

  if (!testClientId) {
    console.log('❌ Missing client ID');
    return false;
  }

  const { status, data } = await apiCall(
    `/api/workflow-executions?client_id=${testClientId}&limit=10`
  );

  if (status === 200) {
    console.log('✅ Executions filtered by client successfully');
    console.log('   Total:', data.pagination.total);
    console.log('   Executions returned:', data.executions.length);
    return true;
  } else {
    console.log('❌ Failed to filter executions by client');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Cleanup test data
async function cleanup() {
  console.log('\n=== Cleanup ===');

  // Delete test workflows
  if (testWorkflowId) {
    await apiCall(`/api/workflows/${testWorkflowId}`, { method: 'DELETE' });
    console.log('Deleted test workflow:', testWorkflowId);
  }

  // Delete test client
  if (testClientId) {
    await apiCall(`/api/clients/${testClientId}`, { method: 'DELETE' });
    console.log('Deleted test client:', testClientId);
  }
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Feature #272 - Workflow Execution API Tests            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const tests = [
    testLogin,
    getOrCreateTestClient,
    createTestWorkflow,
    testExecuteWorkflow,
    testListExecutions,
    testGetExecution,
    testGetExecutionLogs,
    testCancelExecution,
    testExecuteWorkflowWithoutClient,
    testFilterExecutionsByStatus,
    testFilterExecutionsByClient,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log('❌ Test error:', error.message);
      failed++;
    }
  }

  // Cleanup
  await cleanup();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Test Results                                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log(`📊 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
