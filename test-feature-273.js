/**
 * Test script for Feature #273 - Workflow Test/Dry-Run API
 *
 * Tests:
 * 1. POST /api/workflows/:id/test - Test workflow with dry run
 * 2. Verify execution plan is returned
 * 3. Verify conditions are evaluated
 * 4. Verify no actual actions are executed
 * 5. Test with various workflow configurations
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

  const { status, data } = await apiCall('/api/clients?limit=1');

  if (status === 200 && data.clients && data.clients.length > 0) {
    testClientId = data.clients[0].id;
    console.log('✅ Using existing client');
    console.log('   Client ID:', testClientId);
    return true;
  }

  const newClient = {
    name: 'Dry Run Test Client',
    email: 'dryruntest@example.com',
    phone: '555-0200',
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
    return false;
  }
}

// Test 3: Create a test workflow with conditions
async function createTestWorkflow() {
  console.log('\n=== Test 3: Create Test Workflow ===');

  const workflow = {
    name: 'DRY_RUN_TEST_WORKFLOW',
    description: 'Workflow for testing dry-run mode',
    isActive: true,
    triggerType: 'MANUAL',
    conditions: {
      type: 'CLIENT_STATUS_EQUALS',
      config: {
        status: 'LEAD',
      },
    },
    actions: [
      {
        type: 'ADD_NOTE',
        config: {
          text: 'This note should NOT be created during dry run',
          tags: 'dry-run,test',
        },
      },
      {
        type: 'CREATE_TASK',
        config: {
          text: 'This task should NOT be created during dry run',
          priority: 'HIGH',
          dueDays: 3,
        },
      },
      {
        type: 'UPDATE_CLIENT_STATUS',
        config: {
          status: 'ACTIVE',
        },
      },
      {
        type: 'SEND_EMAIL',
        config: {
          templateId: 'test-template',
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

// Test 4: Test workflow with dry run (conditions met)
async function testWorkflowDryRunConditionsMet() {
  console.log('\n=== Test 4: Test Workflow Dry Run (Conditions Met) ===');

  if (!testWorkflowId || !testClientId) {
    console.log('❌ Missing workflow ID or client ID');
    return false;
  }

  const { status, data } = await apiCall(`/api/workflows/${testWorkflowId}/test`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: testClientId,
      triggerData: { test: 'dry-run' },
    }),
  });

  if (status === 200) {
    console.log('✅ Workflow dry run successful');
    console.log('   Would Execute:', data.wouldExecute);
    console.log('   Workflow:', data.executionPlan?.workflowName);
    console.log('   Conditions Met:', data.executionPlan?.conditionsMet);
    console.log('   Total Steps:', data.executionPlan?.totalSteps);
    console.log('   Estimated Duration:', data.executionPlan?.estimatedTotalDuration);

    if (data.executionPlan && data.executionPlan.actions) {
      console.log('\n   Execution Plan:');
      data.executionPlan.actions.forEach((action, idx) => {
        console.log(`   ${idx + 1}. [${action.actionType}] ${action.description}`);
        console.log(`      Category: ${action.actionCategory}`);
        console.log(`      Duration: ${action.estimatedDuration}`);
        console.log(`      Would Execute: ${action.wouldExecute}`);
      });
    }

    return true;
  } else {
    console.log('❌ Workflow dry run failed');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 5: Test workflow with dry run (conditions not met)
async function testWorkflowDryRunConditionsNotMet() {
  console.log('\n=== Test 5: Test Workflow Dry Run (Conditions Not Met) ===');

  // Create a workflow with conditions that won't match
  const workflow = {
    name: 'DRY_RUN_CONDITIONS_TEST',
    description: 'Workflow with unmatched conditions',
    isActive: true,
    triggerType: 'MANUAL',
    conditions: {
      type: 'CLIENT_STATUS_EQUALS',
      config: {
        status: 'CLOSED', // Client is LEAD, not CLOSED
      },
    },
    actions: [
      {
        type: 'ADD_NOTE',
        config: {
          text: 'This should not execute',
        },
      },
    ],
  };

  const { status: createStatus, data: createData } = await apiCall('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });

  if (createStatus !== 201) {
    console.log('❌ Failed to create test workflow');
    return false;
  }

  const workflowId = createData.id;

  const { status, data } = await apiCall(`/api/workflows/${workflowId}/test`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: testClientId,
      triggerData: {},
    }),
  });

  if (status === 200) {
    console.log('✅ Workflow dry run completed (conditions not met)');
    console.log('   Would Execute:', data.wouldExecute);
    console.log('   Message:', data.message);
    console.log('   Conditions Met:', data.executionPlan?.conditionsMet);
    console.log('   Condition Results:', data.executionPlan?.conditionResults);

    const success = !data.wouldExecute && !data.executionPlan?.conditionsMet;
    if (success) {
      console.log('   ✅ Correctly identified that workflow would NOT execute');
    } else {
      console.log('   ❌ Failed to identify that workflow would not execute');
    }

    return success;
  } else {
    console.log('❌ Workflow dry run failed');
    console.log('   Status:', status);
    console.log('   Data:', data);
    return false;
  }
}

// Test 6: Test workflow without conditions
async function testWorkflowDryRunNoConditions() {
  console.log('\n=== Test 6: Test Workflow Dry Run (No Conditions) ===');

  const workflow = {
    name: 'DRY_RUN_NO_CONDITIONS',
    description: 'Workflow without conditions',
    isActive: true,
    triggerType: 'MANUAL',
    actions: [
      {
        type: 'CREATE_TASK',
        config: {
          text: 'Sample task',
        },
      },
      {
        type: 'WAIT',
        config: {
          delayMinutes: 5,
        },
      },
      {
        type: 'BRANCH',
        config: {
          variable: 'client.status',
          operator: 'equals',
          value: 'LEAD',
          trueActions: [],
          falseActions: [],
        },
      },
    ],
  };

  const { status: createStatus, data: createData } = await apiCall('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });

  if (createStatus !== 201) {
    console.log('❌ Failed to create test workflow');
    return false;
  }

  const workflowId = createData.id;

  const { status, data } = await apiCall(`/api/workflows/${workflowId}/test`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: testClientId,
    }),
  });

  if (status === 200) {
    console.log('✅ Workflow dry run successful (no conditions)');
    console.log('   Would Execute:', data.wouldExecute);
    console.log('   Total Steps:', data.executionPlan?.totalSteps);

    // Check that flow control actions are properly analyzed
    const waitAction = data.executionPlan?.actions?.find(a => a.actionType === 'WAIT');
    const branchAction = data.executionPlan?.actions?.find(a => a.actionType === 'BRANCH');

    if (waitAction && branchAction) {
      console.log('   ✅ Flow control actions properly analyzed');
      console.log(`   - WAIT: ${waitAction.description} (${waitAction.estimatedDuration})`);
      console.log(`   - BRANCH: ${branchAction.description}`);
    }

    return true;
  } else {
    console.log('❌ Workflow dry run failed');
    return false;
  }
}

// Test 7: Test workflow without clientId
async function testWorkflowDryRunNoClient() {
  console.log('\n=== Test 7: Test Workflow Dry Run (No Client) ===');

  const workflow = {
    name: 'DRY_RUN_NO_CLIENT',
    description: 'Workflow that runs without client',
    isActive: true,
    triggerType: 'MANUAL',
    actions: [
      {
        type: 'LOG_ACTIVITY',
        config: {
          activityType: 'TEST',
          description: 'Test activity',
        },
      },
    ],
  };

  const { status: createStatus, data: createData } = await apiCall('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });

  if (createStatus !== 201) {
    console.log('❌ Failed to create test workflow');
    return false;
  }

  const workflowId = createData.id;

  const { status, data } = await apiCall(`/api/workflows/${workflowId}/test`, {
    method: 'POST',
    body: JSON.stringify({}), // No clientId
  });

  if (status === 200) {
    console.log('✅ Workflow dry run successful (no client)');
    console.log('   Would Execute:', data.wouldExecute);
    console.log('   Total Steps:', data.executionPlan?.totalSteps);
    return true;
  } else {
    console.log('❌ Workflow dry run failed');
    return false;
  }
}

// Test 8: Verify no actual actions were executed
async function verifyNoActionsExecuted() {
  console.log('\n=== Test 8: Verify No Actions Were Executed ===');

  // Check that no new notes were created with "dry-run" tag
  const { status, data } = await apiCall(`/api/clients/${testClientId}/notes`);

  if (status === 200) {
    const dryRunNotes = data.notes.filter(n =>
      n.tags && n.tags.some(t => t === 'dry-run')
    );

    if (dryRunNotes.length === 0) {
      console.log('✅ No dry-run notes created (correct!)');
      return true;
    } else {
      console.log('❌ Dry-run notes were created (should not execute!)');
      console.log(`   Found ${dryRunNotes.length} dry-run notes`);
      return false;
    }
  } else {
    console.log('❌ Failed to check notes');
    return false;
  }
}

// Cleanup test data
async function cleanup() {
  console.log('\n=== Cleanup ===');

  if (testWorkflowId) {
    await apiCall(`/api/workflows/${testWorkflowId}`, { method: 'DELETE' });
    console.log('Deleted test workflow');
  }
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Feature #273 - Workflow Test/Dry-Run API Tests        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const tests = [
    testLogin,
    getOrCreateTestClient,
    createTestWorkflow,
    testWorkflowDryRunConditionsMet,
    testWorkflowDryRunConditionsNotMet,
    testWorkflowDryRunNoConditions,
    testWorkflowDryRunNoClient,
    verifyNoActionsExecuted,
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

  await cleanup();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Test Results                                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log(`📊 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
