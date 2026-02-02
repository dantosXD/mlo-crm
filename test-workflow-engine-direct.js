/**
 * Direct Test of Workflow Execution Engine (Feature #292)
 *
 * This test directly calls the workflow execution engine services
 * without going through the API layer to avoid CSRF complexity.
 *
 * Tests:
 * 1. Process incoming trigger events
 * 2. Find matching active workflows for trigger type
 * 3. Evaluate workflow conditions against trigger context
 * 4. Execute actions in sequence for matching workflows
 * 5. Handle errors and retry logic
 * 6. Create execution records and logs
 */

import { PrismaClient } from '@prisma/client';
import { executeWorkflow } from './backend/src/services/workflowExecutor.js';
import { fireTrigger, fireClientStatusChangedTrigger } from './backend/src/services/triggerHandler.js';
import { encrypt } from './backend/src/utils/crypto.js';

const prisma = new PrismaClient();

async function runTest() {
  console.log('\n========================================');
  console.log('Testing Workflow Execution Engine (Direct)');
  console.log('========================================\n');

  let testClientId;
  let testWorkflowId;
  let testUserId;

  try {
    // Step 1: Get test user
    console.log('1. Getting test user...');
    const testUser = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });

    if (!testUser) {
      throw new Error('Test user not found. Run database seed first.');
    }

    testUserId = testUser.id;
    console.log(`✓ Found test user: ${testUser.name}\n`);

    // Step 2: Create test client
    console.log('2. Creating test client...');
    const testClient = await prisma.client.create({
      data: {
        nameEncrypted: encrypt('Workflow Engine Test Client'),
        emailEncrypted: encrypt('workflow-direct-test@example.com'),
        phoneEncrypted: encrypt('555-8888'),
        status: 'LEAD',
        tags: JSON.stringify([]),
        createdById: testUserId,
      },
    });

    testClientId = testClient.id;
    console.log(`✓ Created test client: ${testClientId}\n`);

    // Step 3: Create test workflow
    console.log('3. Creating test workflow...');
    const testWorkflow = await prisma.workflow.create({
      data: {
        name: 'Direct Test Workflow - Status Change',
        description: 'Test workflow for direct engine testing',
        triggerType: 'CLIENT_STATUS_CHANGED',
        conditions: JSON.stringify({
          type: 'CLIENT_STATUS_EQUALS',
          value: 'ACTIVE',
        }),
        actions: JSON.stringify([
          {
            type: 'CREATE_TASK',
            config: {
              text: 'Follow up with {{client_name}}',
              description: 'Direct test task',
              priority: 'HIGH',
              dueDays: 1,
            },
          },
          {
            type: 'CREATE_NOTE',
            config: {
              text: 'Client moved to ACTIVE status at {{time}}',
              tags: ['workflow-test'],
            },
          },
          {
            type: 'ADD_TAG',
            config: {
              addTags: ['active-client'],
            },
          },
        ]),
        isActive: true,
        createdById: testUserId,
      },
    });

    testWorkflowId = testWorkflow.id;
    console.log(`✓ Created test workflow: ${testWorkflowId}\n`);

    // Step 4: Get initial counts
    console.log('4. Getting initial state...');
    const initialTasks = await prisma.task.count({
      where: { clientId: testClientId },
    });
    const initialNotes = await prisma.note.count({
      where: { clientId: testClientId },
    });
    console.log(`✓ Initial state - Tasks: ${initialTasks}, Notes: ${initialNotes}\n`);

    // Step 5: Update client status to trigger workflow
    console.log('5. Updating client status to ACTIVE...');
    await prisma.client.update({
      where: { id: testClientId },
      data: { status: 'ACTIVE' },
    });
    console.log('✓ Client status updated\n');

    // Step 6: Fire trigger (simulating what the API would do)
    console.log('6. Firing CLIENT_STATUS_CHANGED trigger...');
    await fireClientStatusChangedTrigger(
      testClientId,
      testUserId,
      'LEAD',
      'ACTIVE'
    );
    console.log('✓ Trigger fired\n');

    // Step 7: Wait for async execution
    console.log('7. Waiting for workflow execution...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✓ Wait complete\n');

    // Step 8: Verify workflow execution
    console.log('8. Verifying workflow execution...');
    const executions = await prisma.workflowExecution.findMany({
      where: { workflowId: testWorkflowId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (executions.length === 0) {
      throw new Error('No workflow execution found!');
    }

    const execution = executions[0];
    console.log(`✓ Found execution: ${execution.id}`);
    console.log(`  Status: ${execution.status}`);
    console.log(`  Current Step: ${execution.currentStep}`);

    if (execution.status !== 'COMPLETED') {
      console.log(`  Error: ${execution.errorMessage || 'Unknown'}`);
      throw new Error(`Expected status COMPLETED, got ${execution.status}`);
    }

    // Step 9: Verify execution logs
    console.log('\n9. Checking execution logs...');
    const logs = await prisma.workflowExecutionLog.findMany({
      where: { executionId: execution.id },
      orderBy: { stepIndex: 'asc' },
    });

    console.log(`✓ Found ${logs.length} execution log entries`);
    logs.forEach((log, index) => {
      console.log(`  [${index}] ${log.actionType}: ${log.status}`);
      if (log.errorMessage) {
        console.log(`      Error: ${log.errorMessage}`);
      }
    });

    if (logs.length !== 3) {
      throw new Error(`Expected 3 logs, got ${logs.length}`);
    }

    const allSucceeded = logs.every(log => log.status === 'SUCCESS');
    if (!allSucceeded) {
      throw new Error('Not all actions succeeded');
    }
    console.log('✓ All actions executed successfully');

    // Step 10: Verify actions were executed
    console.log('\n10. Verifying action results...');

    // Check tasks
    const finalTasks = await prisma.task.count({
      where: { clientId: testClientId },
    });
    const newTaskCount = finalTasks - initialTasks;

    if (newTaskCount !== 1) {
      throw new Error(`Expected 1 new task, got ${newTaskCount}`);
    }

    const task = await prisma.task.findFirst({
      where: { clientId: testClientId },
    });
    console.log(`✓ Task created: "${task.text}"`);
    console.log(`  Priority: ${task.priority}`);

    // Check notes
    const finalNotes = await prisma.note.count({
      where: { clientId: testClientId },
    });
    const newNoteCount = finalNotes - initialNotes;

    if (newNoteCount !== 1) {
      throw new Error(`Expected 1 new note, got ${newNoteCount}`);
    }

    const note = await prisma.note.findFirst({
      where: { clientId: testClientId },
    });
    console.log(`✓ Note created: "${note.text.substring(0, 50)}..."`);

    // Check tags
    const updatedClient = await prisma.client.findUnique({
      where: { id: testClientId },
    });
    const tags = JSON.parse(updatedClient.tags);

    if (!tags.includes('active-client')) {
      throw new Error('Client tag not added');
    }
    console.log(`✓ Client tags: ${tags.join(', ')}`);

    // Step 11: Test error handling
    console.log('\n11. Testing error handling...');
    const errorWorkflow = await prisma.workflow.create({
      data: {
        name: 'Error Test Workflow',
        description: 'Tests error handling',
        triggerType: 'CLIENT_UPDATED',
        actions: JSON.stringify([
          {
            type: 'UPDATE_DOCUMENT_STATUS',
            config: {
              documentId: 'non-existent-id',
              status: 'APPROVED',
            },
          },
        ]),
        isActive: true,
        createdById: testUserId,
      },
    });

    // Trigger the error workflow
    await fireTrigger('CLIENT_UPDATED', {
      clientId: testClientId,
      userId: testUserId,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check for failed execution
    const errorExecutions = await prisma.workflowExecution.findMany({
      where: { workflowId: errorWorkflow.id },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (errorExecutions.length === 0) {
      throw new Error('No error execution found');
    }

    const errorExecution = errorExecutions[0];
    if (errorExecution.status !== 'FAILED') {
      throw new Error(`Expected FAILED, got ${errorExecution.status}`);
    }

    console.log('✓ Workflow failed gracefully');
    console.log(`  Error: ${errorExecution.errorMessage}`);

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
    await prisma.task.deleteMany({ where: { clientId: testClientId } });
    await prisma.note.deleteMany({ where: { clientId: testClientId } });
    await prisma.workflowExecutionLog.deleteMany({
      where: {
        execution: {
          OR: [
            { workflowId: testWorkflowId },
            { workflowId: errorWorkflow.id },
          ],
        },
      },
    });
    await prisma.workflowExecution.deleteMany({
      where: {
        OR: [
          { workflowId: testWorkflowId },
          { workflowId: errorWorkflow.id },
        ],
      },
    });
    await prisma.workflow.delete({ where: { id: testWorkflowId } });
    await prisma.workflow.delete({ where: { id: errorWorkflow.id } });
    await prisma.client.delete({ where: { id: testClientId } });
    console.log('✓ Cleanup complete');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }

    // Cleanup on error
    try {
      if (testClientId) {
        await prisma.task.deleteMany({ where: { clientId: testClientId } });
        await prisma.note.deleteMany({ where: { clientId: testClientId } });
        await prisma.client.delete({ where: { id: testClientId } });
      }
      if (testWorkflowId) {
        await prisma.workflowExecution.deleteMany({ where: { workflowId: testWorkflowId } });
        await prisma.workflow.delete({ where: { id: testWorkflowId } });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runTest();
