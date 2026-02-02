/**
 * Test Feature #286 - Task Actions
 *
 * This script tests the CREATE_TASK, COMPLETE_TASK, and ASSIGN_TASK workflow actions
 */

import { executeCreateTask, executeCompleteTask, executeAssignTask } from './backend/dist/services/actionExecutor.js';

const API_URL = 'http://localhost:3000';

let authToken = '';
let testClientId = '';
let testUserId = '';
let createdTaskIds = [];

async function login() {
  console.log('\n=== Logging in as test user ===');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testadmin@mlodash.com',
      password: 'admin123',
    }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  authToken = data.accessToken || data.token;
  testUserId = data.user.id;
  console.log('✓ Logged in successfully');
  console.log(`  User: ${data.user.name} (${data.user.role})`);
  return data.user;
}

async function createTestClient() {
  console.log('\n=== Creating test client ===');
  const response = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      name: 'TEST_TASK_CLIENT',
      email: 'test-tasks@example.com',
      phone: '+15550300',
      status: 'ACTIVE',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create test client');
  }

  const data = await response.json();
  testClientId = data.id;
  console.log(`✓ Test client created: ${testClientId}`);
  return data;
}

async function testCreateTask() {
  console.log('\n=== Test 1: CREATE_TASK ===');

  const context = {
    clientId: testClientId,
    triggerType: 'CLIENT_CREATED',
    triggerData: {},
    userId: testUserId,
  };

  const config = {
    text: 'Follow up with {{client_name}}',
    description: 'Contact the client to discuss their application',
    priority: 'HIGH',
    dueDays: 7,
  };

  try {
    const result = await executeCreateTask(config, context);

    if (result.success) {
      console.log('✓ CREATE_TASK executed successfully');
      console.log(`  Task ID: ${result.data.taskId}`);
      console.log(`  Text: ${result.data.text}`);
      console.log(`  Priority: ${result.data.priority}`);
      console.log(`  Due Date: ${result.data.dueDate}`);
      console.log(`  Assigned To: ${result.data.assignedToId}`);

      // Verify placeholder replacement
      if (!result.data.text.includes('TEST_TASK_CLIENT')) {
        console.error('✗ Client name placeholder not replaced');
        return null;
      }

      createdTaskIds.push(result.data.taskId);
      return result.data.taskId;
    } else {
      console.error('✗ CREATE_TASK failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return null;
  }
}

async function verifyTaskCreated(taskId) {
  console.log('\n=== Verifying task creation ===');

  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    console.error('✗ Failed to fetch task');
    return false;
  }

  const task = await response.json();

  console.log('✓ Task found');
  console.log(`  ID: ${task.id}`);
  console.log(`  Text: ${task.text}`);
  console.log(`  Status: ${task.status}`);
  console.log(`  Priority: ${task.priority}`);
  console.log(`  Due Date: ${task.dueDate}`);
  console.log(`  Client ID: ${task.clientId}`);

  // Verify status
  if (task.status !== 'TODO') {
    console.error('✗ Task status is not TODO');
    return false;
  }

  // Verify priority
  if (task.priority !== 'HIGH') {
    console.error('✗ Task priority is not HIGH');
    return false;
  }

  // Verify client link
  if (task.clientId !== testClientId) {
    console.error('✗ Task not linked to correct client');
    return false;
  }

  console.log('✓ All verification checks passed');
  return true;
}

async function testCompleteTask(taskId) {
  console.log('\n=== Test 2: COMPLETE_TASK ===');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  const config = {
    taskId: taskId,
  };

  try {
    const result = await executeCompleteTask(config, context);

    if (result.success) {
      console.log('✓ COMPLETE_TASK executed successfully');
      console.log(`  Task ID: ${result.data.taskId}`);
      console.log(`  Status: ${result.data.status}`);
      console.log(`  Completed At: ${result.data.completedAt}`);

      // Verify status changed
      if (result.data.status !== 'COMPLETE') {
        console.error('✗ Task status not changed to COMPLETE');
        return false;
      }

      return true;
    } else {
      console.error('✗ COMPLETE_TASK failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

async function testCreateTaskWithRoleAssignment() {
  console.log('\n=== Test 3: CREATE_TASK with role assignment ===');

  const context = {
    clientId: testClientId,
    triggerType: 'CLIENT_STATUS_CHANGED',
    triggerData: {},
    userId: testUserId,
  };

  const config = {
    text: 'Review {{client_name}} documents',
    priority: 'MEDIUM',
    dueDays: 3,
    assignedToRole: 'MLO',
  };

  try {
    const result = await executeCreateTask(config, context);

    if (result.success) {
      console.log('✓ CREATE_TASK with role assignment executed');
      console.log(`  Task ID: ${result.data.taskId}`);
      console.log(`  Assigned To: ${result.data.assignedToId}`);

      createdTaskIds.push(result.data.taskId);
      return result.data.taskId;
    } else {
      console.error('✗ CREATE_TASK with role assignment failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return null;
  }
}

async function testAssignTask(taskId) {
  console.log('\n=== Test 4: ASSIGN_TASK ===');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  const config = {
    taskId: taskId,
    assignedToId: testUserId, // Assign to ourselves
  };

  try {
    const result = await executeAssignTask(config, context);

    if (result.success) {
      console.log('✓ ASSIGN_TASK executed successfully');
      console.log(`  Task ID: ${result.data.taskId}`);
      console.log(`  Assigned To: ${result.data.assignedToId}`);
      console.log(`  Assignee Name: ${result.data.assignedToName}`);

      return true;
    } else {
      console.error('✗ ASSIGN_TASK failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

async function testAssignTaskByRole(taskId) {
  console.log('\n=== Test 5: ASSIGN_TASK by role ===');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  const config = {
    taskId: taskId,
    assignedToRole: 'ADMIN',
  };

  try {
    const result = await executeAssignTask(config, context);

    if (result.success) {
      console.log('✓ ASSIGN_TASK by role executed');
      console.log(`  Task ID: ${result.data.taskId}`);
      console.log(`  Assigned To: ${result.data.assignedToId}`);
      console.log(`  Assignee Name: ${result.data.assignedToName}`);

      return true;
    } else {
      console.error('✗ ASSIGN_TASK by role failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

async function verifyActivityLogForTasks() {
  console.log('\n=== Verifying activity log entries ===');

  const response = await fetch(`${API_URL}/api/activities?client_id=${testClientId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    console.error('✗ Failed to fetch activities');
    return false;
  }

  const data = await response.json();
  const activities = data.activities || data;

  const taskActivities = activities.filter((a) =>
    a.type.startsWith('TASK_')
  );

  console.log(`✓ Found ${taskActivities.length} task-related activities`);

  taskActivities.forEach((activity) => {
    console.log(`  - ${activity.type}: ${activity.description}`);
  });

  return true;
}

async function cleanup() {
  console.log('\n=== Cleaning up test data ===');

  // Delete tasks
  for (const taskId of createdTaskIds) {
    await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }
  console.log(`✓ Deleted ${createdTaskIds.length} test tasks`);

  // Delete client
  if (testClientId) {
    await fetch(`${API_URL}/api/clients/${testClientId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    console.log('✓ Test client deleted');
  }
}

async function runTests() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Feature #286 - Task Actions Tests                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    await login();
    await createTestClient();

    // Test 1: Create task
    const task1Id = await testCreateTask();
    if (task1Id) {
      await verifyTaskCreated(task1Id);
    }

    // Test 2: Complete task
    if (task1Id) {
      await testCompleteTask(task1Id);
    }

    // Test 3: Create task with role assignment
    const task2Id = await testCreateTaskWithRoleAssignment();

    // Test 4: Assign task to specific user
    if (task2Id) {
      await testAssignTask(task2Id);
    }

    // Test 5: Assign task by role
    if (task2Id) {
      await testAssignTaskByRole(task2Id);
    }

    // Verify activity log
    await verifyActivityLogForTasks();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   All tests completed!                                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n✗ Test suite failed:', error.message);
  } finally {
    await cleanup();
    console.log('\n✓ Cleanup complete');
  }
}

runTests();
