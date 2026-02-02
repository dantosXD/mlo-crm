/**
 * Test Workflow Execution Engine (Feature #292)
 *
 * This test verifies the complete workflow execution engine:
 * 1. Process incoming trigger events
 * 2. Find matching active workflows for trigger type
 * 3. Evaluate workflow conditions against trigger context
 * 4. Execute actions in sequence for matching workflows
 * 5. Handle errors and retry logic
 * 6. Create execution records and logs
 */

const baseUrl = 'http://localhost:3000/api';

// Test credentials (using seeded admin user)
const testUser = {
  email: 'admin@example.com',
  password: 'password123',
};

let authToken = '';
let testClientId = '';
let testWorkflowId = '';
let csrfToken = '';

// Helper function to make authenticated requests
async function request(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'workflow-engine-test',
    'X-Session-ID': 'test-session-123',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, options);

  // Get CSRF token from response if available (only update if a new token is provided)
  const newCsrfToken = response.headers.get('x-csrf-token');
  if (newCsrfToken) {
    csrfToken = newCsrfToken;
  }

  const data = await response.json();

  return { status: response.status, data };
}

// Helper to wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n========================================');
  console.log('Testing Workflow Execution Engine');
  console.log('========================================\n');

  try {
    // Step 1: Login
    console.log('1. Logging in...');
    const loginResponse = await request('/auth/login', 'POST', testUser);

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(loginResponse.data)}`);
    }

    authToken = loginResponse.data.token;
    // csrfToken should already be set from response headers in the request() function
    console.log(`✓ Logged in successfully`);

    // Make an authenticated GET request to get CSRF token
    await request('/workflows');
    console.log(`✓ Got CSRF token: ${csrfToken ? 'yes' : 'no'}\n`);

    // Step 2: Create a test client
    console.log('2. Creating test client...');
    const clientResponse = await request('/clients', 'POST', {
      name: 'Workflow Engine Test Client',
      email: 'workflow-test@example.com',
      phone: '555-9999',
      status: 'LEAD',
    });

    if (clientResponse.status !== 201) {
      throw new Error(`Failed to create client: ${JSON.stringify(clientResponse.data)}`);
    }

    testClientId = clientResponse.data.id;
    console.log(`✓ Created test client: ${testClientId}\n`);

    // Step 3: Create a workflow with trigger, conditions, and actions
    console.log('3. Creating test workflow...');
    const workflowResponse = await request('/workflows', 'POST', {
      name: 'Test Workflow - Client Status Change',
      description: 'Test workflow that triggers on client status change and executes multiple actions',
      triggerType: 'CLIENT_STATUS_CHANGED',
      conditions: JSON.stringify({
        type: 'CLIENT_STATUS_EQUALS',
        value: 'ACTIVE',
      }),
      actions: JSON.stringify([
        {
          type: 'CREATE_TASK',
          config: {
            text: 'Follow up with {{client_name}} on new application',
            description: 'Client status changed to ACTIVE, schedule follow-up call',
            priority: 'HIGH',
            dueDays: 1,
          },
        },
        {
          type: 'CREATE_NOTE',
          config: {
            text: 'Client {{client_name}} moved to ACTIVE status on {{date}} at {{time}}. Triggered by workflow automation.',
            tags: ['workflow', 'status-change'],
          },
        },
        {
          type: 'ADD_TAG',
          config: {
            addTags: ['active-client', 'workflow-tagged'],
          },
        },
      ]),
      isActive: true,
    });

    if (workflowResponse.status !== 201) {
      throw new Error(`Failed to create workflow: ${JSON.stringify(workflowResponse.data)}`);
    }

    testWorkflowId = workflowResponse.data.id;
    console.log(`✓ Created test workflow: ${testWorkflowId}\n`);

    // Step 4: Get initial state - count tasks and notes
    console.log('4. Getting initial state...');
    const initialTasks = await request(`/tasks?clientId=${testClientId}`);
    const initialNotes = await request(`/notes?clientId=${testClientId}`);
    const initialTaskCount = initialTasks.data.length || 0;
    const initialNoteCount = initialNotes.data.length || 0;
    console.log(`✓ Initial state - Tasks: ${initialTaskCount}, Notes: ${initialNoteCount}\n`);

    // Step 5: Trigger the workflow by updating client status
    // This should:
    // 1. Fire CLIENT_STATUS_CHANGED trigger
    // 2. Find matching workflows (our test workflow)
    // 3. Evaluate conditions (client.status === 'ACTIVE')
    // 4. Execute actions in sequence (CREATE_TASK, CREATE_NOTE, ADD_TAG)
    // 5. Create execution records and logs
    console.log('5. Triggering workflow by updating client status to ACTIVE...');
    const updateResponse = await request(`/clients/${testClientId}`, 'PATCH', {
      status: 'ACTIVE',
    });

    if (updateResponse.status !== 200) {
      throw new Error(`Failed to update client: ${JSON.stringify(updateResponse.data)}`);
    }
    console.log('✓ Updated client status to ACTIVE\n');

    // Wait for workflow to execute (it's async)
    console.log('6. Waiting for workflow execution...');
    await sleep(2000);
    console.log('✓ Wait complete\n');

    // Step 7: Verify workflow execution created records
    console.log('7. Verifying workflow execution...');

    // Check for workflow execution record
    const executions = await request(`/workflow-executions?workflowId=${testWorkflowId}`);
    if (executions.status !== 200 || !executions.data || executions.data.length === 0) {
      throw new Error('No workflow execution found!');
    }

    const execution = executions.data[0];
    console.log(`✓ Found workflow execution: ${execution.id}`);
    console.log(`  Status: ${execution.status}`);
    console.log(`  Current Step: ${execution.currentStep}`);

    if (execution.status !== 'COMPLETED') {
      throw new Error(`Workflow execution status is ${execution.status}, expected COMPLETED`);
    }

    // Step 8: Verify execution logs
    console.log('\n8. Checking execution logs...');
    const logs = await request(`/workflow-executions/${execution.id}/logs`);
    if (logs.status !== 200) {
      throw new Error('Failed to fetch execution logs');
    }

    console.log(`✓ Found ${logs.data.length} execution log entries`);
    logs.data.forEach((log, index) => {
      console.log(`  [${index}] ${log.actionType}: ${log.status}`);
      if (log.errorMessage) {
        console.log(`      Error: ${log.errorMessage}`);
      }
    });

    if (logs.data.length !== 3) {
      throw new Error(`Expected 3 execution logs, got ${logs.data.length}`);
    }

    // Verify all actions succeeded
    const allSucceeded = logs.data.every(log => log.status === 'SUCCESS');
    if (!allSucceeded) {
      throw new Error('Not all actions succeeded');
    }
    console.log('✓ All actions executed successfully');

    // Step 9: Verify actions were executed
    console.log('\n9. Verifying action results...');

    // Check if task was created
    const finalTasks = await request(`/tasks?clientId=${testClientId}`);
    const finalTaskCount = finalTasks.data.length || 0;
    const newTaskCount = finalTaskCount - initialTaskCount;

    if (newTaskCount !== 1) {
      throw new Error(`Expected 1 new task, got ${newTaskCount}`);
    }

    const newTask = finalTasks.data.find(t => t.text.includes('Follow up with'));
    if (!newTask) {
      throw new Error('Task not found or text does not match');
    }

    console.log(`✓ Task created successfully: "${newTask.text}"`);
    console.log(`  Priority: ${newTask.priority}`);
    console.log(`  Status: ${newTask.status}`);

    // Check if note was created
    const finalNotes = await request(`/notes?clientId=${testClientId}`);
    const finalNoteCount = finalNotes.data.length || 0;
    const newNoteCount = finalNoteCount - initialNoteCount;

    if (newNoteCount !== 1) {
      throw new Error(`Expected 1 new note, got ${newNoteCount}`);
    }

    const newNote = finalNotes.data.find(n => n.text.includes('moved to ACTIVE status'));
    if (!newNote) {
      throw new Error('Note not found or text does not match');
    }

    console.log(`✓ Note created successfully: "${newNote.text.substring(0, 60)}..."`);
    const noteTags = JSON.parse(newNote.tags || '[]');
    console.log(`  Tags: ${noteTags.join(', ')}`);

    // Check if tags were added to client
    const updatedClient = await request(`/clients/${testClientId}`);
    const clientTags = JSON.parse(updatedClient.data.tags || '[]');

    if (!clientTags.includes('active-client')) {
      throw new Error('Client tag "active-client" not found');
    }
    if (!clientTags.includes('workflow-tagged')) {
      throw new Error('Client tag "workflow-tagged" not found');
    }

    console.log(`✓ Client tags added successfully: ${clientTags.join(', ')}`);

    // Step 10: Test condition evaluation (create workflow that won't trigger)
    console.log('\n10. Testing condition evaluation (negative case)...');
    const workflow2Response = await request('/workflows', 'POST', {
      name: 'Test Workflow - Should Not Trigger',
      description: 'Workflow with conditions that won\'t match',
      triggerType: 'CLIENT_STATUS_CHANGED',
      conditions: JSON.stringify({
        type: 'CLIENT_STATUS_EQUALS',
        value: 'CLOSED', // Client is ACTIVE, so this won't match
      }),
      actions: JSON.stringify([
        {
          type: 'CREATE_NOTE',
          config: {
            text: 'This note should NOT be created',
          },
        },
      ]),
      isActive: true,
    });

    const workflow2Id = workflow2Response.data.id;
    const notesBeforeUpdate = await request(`/notes?clientId=${testClientId}`);
    const noteCountBefore = notesBeforeUpdate.data.length;

    // Update client to trigger workflows again
    await request(`/clients/${testClientId}`, 'PATCH', {
      status: 'PROCESSING',
    });

    await sleep(2000);

    // Check that workflow 2 was skipped due to conditions
    const workflow2Executions = await request(`/workflow-executions?workflowId=${workflow2Id}`);
    if (workflow2Executions.data.length > 0) {
      const skippedExecution = workflow2Executions.data[0];
      if (skippedExecution.status !== 'SKIPPED') {
        throw new Error('Expected workflow execution to be SKIPPED');
      }
      console.log('✓ Workflow correctly skipped due to unmet conditions');
    }

    // Verify note was not created
    const notesAfterUpdate = await request(`/notes?clientId=${testClientId}`);
    const noteCountAfter = notesAfterUpdate.data.length;

    if (noteCountAfter > noteCountBefore) {
      throw new Error('Note was created when it should not have been');
    }
    console.log('✓ Actions were not executed (condition evaluation working)');

    // Step 11: Test error handling
    console.log('\n11. Testing error handling...');
    const errorWorkflowResponse = await request('/workflows', 'POST', {
      name: 'Test Workflow - Error Handling',
      description: 'Workflow with an action that will fail',
      triggerType: 'CLIENT_UPDATED',
      actions: JSON.stringify([
        {
          type: 'UPDATE_DOCUMENT_STATUS',
          config: {
            documentId: 'non-existent-document-id',
            status: 'APPROVED',
          },
        },
      ]),
      isActive: true,
    });

    const errorWorkflowId = errorWorkflowResponse.data.id;

    // Trigger the workflow (update client)
    await request(`/clients/${testClientId}`, 'PATCH', {
      status: 'UNDERWRITING',
    });

    await sleep(2000);

    // Check that execution failed gracefully
    const errorExecutions = await request(`/workflow-executions?workflowId=${errorWorkflowId}`);
    if (errorExecutions.data.length === 0) {
      throw new Error('No execution found for error workflow');
    }

    const errorExecution = errorExecutions.data[0];
    if (errorExecution.status !== 'FAILED') {
      throw new Error(`Expected execution status FAILED, got ${errorExecution.status}`);
    }

    console.log('✓ Workflow failed gracefully');
    console.log(`  Error message: ${errorExecution.errorMessage}`);

    // Check error logs
    const errorLogs = await request(`/workflow-executions/${errorExecution.id}/logs`);
    const failedLog = errorLogs.data.find(log => log.status === 'FAILED');
    if (!failedLog) {
      throw new Error('Failed action log not found');
    }

    console.log('✓ Error logged correctly in execution logs');
    console.log(`  Action: ${failedLog.actionType}`);
    console.log(`  Error: ${failedLog.errorMessage}`);

    // Success!
    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED');
    console.log('========================================');
    console.log('\nWorkflow Execution Engine verified:');
    console.log('  ✓ Processes incoming trigger events');
    console.log('  ✓ Finds matching active workflows');
    console.log('  ✓ Evaluates workflow conditions');
    console.log('  ✓ Executes actions in sequence');
    console.log('  ✓ Handles errors gracefully');
    console.log('  ✓ Creates execution records and logs');
    console.log('\n🎉 Feature #292 - Workflow Execution Engine is COMPLETE!\n');

    // Cleanup
    console.log('Cleaning up test data...');
    await request(`/clients/${testClientId}`, 'DELETE');
    await request(`/workflows/${testWorkflowId}`, 'DELETE');
    await request(`/workflows/${workflow2Id}`, 'DELETE');
    await request(`/workflows/${errorWorkflowId}`, 'DELETE');
    console.log('✓ Cleanup complete');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
runTest();
