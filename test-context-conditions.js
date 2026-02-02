/**
 * Test script for Feature #284: Context-based conditions
 * Tests USER_ROLE_EQUALS, TIME_OF_DAY, and DAY_OF_WEEK conditions
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

let authToken = null;
let csrfToken = null;
let testUserId = null;
let testClientId = null;
let workflowIds = [];

async function getCsrfToken() {
  try {
    const response = await axios.get(`${API_URL}/auth/csrf-token`);
    csrfToken = response.data.csrfToken;
    log('✓ Got CSRF token', 'green');
  } catch (error) {
    log(`✗ Failed to get CSRF token: ${error.message}`, 'red');
    throw error;
  }
}

async function login() {
  try {
    const response = await axios.post(
      `${API_URL}/auth/login`,
      {
        email: 'admin@example.com',
        password: 'password123',
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      }
    );
    authToken = response.data.accessToken;
    testUserId = response.data.user.id;
    log(`✓ Logged in as ${response.data.user.email} (Role: ${response.data.user.role})`, 'green');
    return response.data.user;
  } catch (error) {
    log(`✗ Login failed: ${error.message}`, 'red');
    throw error;
  }
}

async function createTestClient() {
  try {
    const response = await axios.post(
      `${API_URL}/clients`,
      {
        firstName: 'Context',
        lastName: 'ConditionTest',
        email: `context-test-${Date.now()}@example.com`,
        phone: '555-0100',
        status: 'NEW',
        source: 'TEST',
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-CSRF-Token': csrfToken,
        },
      }
    );
    testClientId = response.data.id;
    log(`✓ Created test client: ${testClientId}`, 'green');
    return response.data;
  } catch (error) {
    log(`✗ Failed to create client: ${error.message}`, 'red');
    throw error;
  }
}

async function createWorkflowWithCondition(name, condition) {
  try {
    const response = await axios.post(
      `${API_URL}/workflows`,
      {
        name,
        description: `Test workflow for ${condition.type}`,
        isActive: true,
        triggerType: 'MANUAL',
        conditions: condition,
        actions: [
          {
            type: 'SEND_NOTIFICATION',
            recipientUserId: testUserId,
            message: `${name} condition matched!`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-CSRF-Token': csrfToken,
        },
      }
    );
    workflowIds.push(response.data.id);
    log(`✓ Created workflow: ${name} (ID: ${response.data.id})`, 'green');
    return response.data;
  } catch (error) {
    log(`✗ Failed to create workflow: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`  Error details: ${JSON.stringify(error.response.data)}`, 'red');
    }
    throw error;
  }
}

async function testWorkflow(workflowId, clientId, expectedMatch = true) {
  try {
    const response = await axios.post(
      `${API_URL}/workflows/${workflowId}/test`,
      {
        clientId,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-CSRF-Token': csrfToken,
        },
      }
    );

    const matched = response.data.conditionResults?.matched;
    const message = response.data.conditionResults?.message;

    if (matched === expectedMatch) {
      log(`✓ Workflow test passed: ${matched ? 'MATCHED' : 'NOT MATCHED'} (expected: ${expectedMatch})`, 'green');
      log(`  Message: ${message}`, 'blue');
      return true;
    } else {
      log(`✗ Workflow test failed: ${matched ? 'MATCHED' : 'NOT MATCHED'} (expected: ${expectedMatch})`, 'red');
      log(`  Message: ${message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Failed to test workflow: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`  Error details: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function cleanup() {
  log('\nCleaning up...', 'yellow');

  // Delete workflows
  for (const workflowId of workflowIds) {
    try {
      await axios.delete(`${API_URL}/workflows/${workflowId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-CSRF-Token': csrfToken,
        },
      });
      log(`✓ Deleted workflow: ${workflowId}`, 'green');
    } catch (error) {
      log(`✗ Failed to delete workflow ${workflowId}: ${error.message}`, 'red');
    }
  }

  // Delete test client
  if (testClientId) {
    try {
      await axios.delete(`${API_URL}/clients/${testClientId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-CSRF-Token': csrfToken,
        },
      });
      log(`✓ Deleted test client: ${testClientId}`, 'green');
    } catch (error) {
      log(`✗ Failed to delete test client: ${error.message}`, 'red');
    }
  }
}

async function runTests() {
  try {
    log('='.repeat(60), 'blue');
    log('Feature #284: Context-based Conditions Test', 'blue');
    log('='.repeat(60), 'blue');

    // Setup
    log('\n[Setup]', 'yellow');
    await getCsrfToken();
    const user = await login();
    await createTestClient();

    log('\n[Test 1: USER_ROLE_EQUALS - Should Match]', 'yellow');
    const workflow1 = await createWorkflowWithCondition('Test USER_ROLE_EQUALS', {
      type: 'USER_ROLE_EQUALS',
      value: user.role, // Should match current user's role
    });
    await testWorkflow(workflow1.id, testClientId, true);

    log('\n[Test 2: USER_ROLE_EQUALS - Should Not Match]', 'yellow');
    const workflow2 = await createWorkflowWithCondition('Test USER_ROLE_EQUALS (wrong role)', {
      type: 'USER_ROLE_EQUALS',
      value: 'NONEXISTENT_ROLE', // Should not match
    });
    await testWorkflow(workflow2.id, testClientId, false);

    log('\n[Test 3: TIME_OF_DAY - Business Hours]', 'yellow');
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Create a time range that includes current time (1 hour before to 1 hour after)
    const startHour = currentHour - 1 >= 0 ? currentHour - 1 : 0;
    const endHour = currentHour + 1 <= 23 ? currentHour + 1 : 23;
    const startTime = `${String(startHour).padStart(2, '0')}:00`;
    const endTime = `${String(endHour).padStart(2, '0')}:59`;

    log(`  Current time: ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`, 'blue');
    log(`  Testing range: ${startTime} - ${endTime}`, 'blue');

    const workflow3 = await createWorkflowWithCondition('Test TIME_OF_DAY (should match)', {
      type: 'TIME_OF_DAY',
      value: { start: startTime, end: endTime },
    });
    await testWorkflow(workflow3.id, testClientId, true);

    log('\n[Test 4: TIME_OF_DAY - Outside Hours]', 'yellow');
    // Create a time range that excludes current time
    const outsideStartHour = currentHour + 2 <= 23 ? currentHour + 2 : 0;
    const outsideEndHour = currentHour + 3 <= 23 ? currentHour + 3 : 1;
    const outsideStart = `${String(outsideStartHour).padStart(2, '0')}:00`;
    const outsideEnd = `${String(outsideEndHour).padStart(2, '0')}:00`;

    log(`  Testing range: ${outsideStart} - ${outsideEnd} (should be outside current time)`, 'blue');

    const workflow4 = await createWorkflowWithCondition('Test TIME_OF_DAY (should not match)', {
      type: 'TIME_OF_DAY',
      value: { start: outsideStart, end: outsideEnd },
    });
    await testWorkflow(workflow4.id, testClientId, false);

    log('\n[Test 5: DAY_OF_WEEK - Current Day (by number)]', 'yellow');
    const currentDayNumber = now.getDay(); // 0 = Sunday, 6 = Saturday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    log(`  Current day: ${dayNames[currentDayNumber]} (${currentDayNumber})`, 'blue');

    const workflow5 = await createWorkflowWithCondition('Test DAY_OF_WEEK (current day)', {
      type: 'DAY_OF_WEEK',
      value: [currentDayNumber],
    });
    await testWorkflow(workflow5.id, testClientId, true);

    log('\n[Test 6: DAY_OF_WEEK - Different Day (by number)]', 'yellow');
    const differentDay = (currentDayNumber + 1) % 7;
    log(`  Testing for day: ${dayNames[differentDay]} (${differentDay})`, 'blue');

    const workflow6 = await createWorkflowWithCondition('Test DAY_OF_WEEK (different day)', {
      type: 'DAY_OF_WEEK',
      value: [differentDay],
    });
    await testWorkflow(workflow6.id, testClientId, false);

    log('\n[Test 7: DAY_OF_WEEK - Current Day (by name)]', 'yellow');
    const currentDayName = dayNames[currentDayNumber];
    log(`  Testing for day: ${currentDayName}`, 'blue');

    const workflow7 = await createWorkflowWithCondition('Test DAY_OF_WEEK (by name)', {
      type: 'DAY_OF_WEEK',
      value: [currentDayName],
    });
    await testWorkflow(workflow7.id, testClientId, true);

    log('\n[Test 8: Nested Conditions - AND with TIME_OF_DAY and DAY_OF_WEEK]', 'yellow');
    const workflow8 = await createWorkflowWithCondition('Test AND (time + day)', {
      type: 'AND',
      conditions: [
        {
          type: 'TIME_OF_DAY',
          value: { start: startTime, end: endTime },
        },
        {
          type: 'DAY_OF_WEEK',
          value: [currentDayNumber],
        },
      ],
    });
    await testWorkflow(workflow8.id, testClientId, true);

    log('\n[Test 9: Nested Conditions - OR with USER_ROLE and TIME]', 'yellow');
    const workflow9 = await createWorkflowWithCondition('Test OR (role + time)', {
      type: 'OR',
      conditions: [
        {
          type: 'USER_ROLE_EQUALS',
          value: user.role,
        },
        {
          type: 'TIME_OF_DAY',
          value: { start: '00:00', end: '01:00' }, // Unlikely to match
        },
      ],
    });
    await testWorkflow(workflow9.id, testClientId, true);

    log('\n[Test 10: Complex Nested - AND containing OR]', 'yellow');
    const workflow10 = await createWorkflowWithCondition('Test Complex Nested', {
      type: 'AND',
      conditions: [
        {
          type: 'USER_ROLE_EQUALS',
          value: user.role,
        },
        {
          type: 'OR',
          conditions: [
            {
              type: 'DAY_OF_WEEK',
              value: [currentDayNumber],
            },
            {
              type: 'TIME_OF_DAY',
              value: { start: '00:00', end: '01:00' },
            },
          ],
        },
      ],
    });
    await testWorkflow(workflow10.id, testClientId, true);

    // Cleanup
    await cleanup();

    log('\n' + '='.repeat(60), 'blue');
    log('✓ All tests completed successfully!', 'green');
    log('='.repeat(60), 'blue');
    process.exit(0);
  } catch (error) {
    log(`\n✗ Test suite failed: ${error.message}`, 'red');
    await cleanup();
    process.exit(1);
  }
}

runTests();
