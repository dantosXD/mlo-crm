#!/usr/bin/env node
/**
 * Test Feature #284: Condition Evaluator - Context Conditions
 *
 * Tests:
 * 1. USER_ROLE_EQUALS - Check if user has specific role
 * 2. TIME_OF_DAY - Check if current time is within range
 * 3. DAY_OF_WEEK - Check if current day is in allowed days
 * 4. AND - Nested conditions with AND logic
 * 5. OR - Nested conditions with OR logic
 */

import http from 'http';

const API_URL = 'http://localhost:3000';
const TEST_CLIENT_ID = 'TEST_FEATURE_284';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

let authToken = null;
let csrfToken = null;
let testUserId = null;

// Helper: Make HTTP request
function request(method, path, data = null, token = null, csrf = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (csrf) {
      options.headers['X-CSRF-Token'] = csrf;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            data: parsed,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body,
            headers: res.headers
          });
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

// Helper: Log test result
function logTest(testName, passed, message) {
  const status = passed ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
  console.log(`${status} - ${testName}`);
  if (message) {
    console.log(`  ${BLUE}${message}${RESET}`);
  }
}

// Helper: Log section
function logSection(title) {
  console.log(`\n${YELLOW}═══ ${title} ═══${RESET}\n`);
}

// Step 1: Login
async function login() {
  logSection('STEP 1: Login');
  const response = await request('POST', '/api/auth/login', {
    email: 'admin@example.com',
    password: 'password123',
  });

  if (response.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
  }

  authToken = response.data.accessToken;
  csrfToken = response.headers['x-csrf-token'];
  testUserId = response.data.user.id;
  logTest('Login', true, `Logged in as ${response.data.user.name} (${response.data.user.role})`);
  return response.data.user;
}

// Step 2: Create test client
async function createTestClient() {
  logSection('STEP 2: Create Test Client');

  const response = await request('POST', '/api/clients', {
    name: 'Feature 284 Test Client',
    email: 'feature284@test.com',
    phone: '555-0284',
    status: 'LEAD',
  }, authToken, csrfToken);

  if (response.status !== 201) {
    throw new Error(`Client creation failed: ${JSON.stringify(response.data)}`);
  }

  logTest('Create Test Client', true, `Client ID: ${response.data.id}`);
  return response.data.id;
}

// Step 3: Test USER_ROLE_EQUALS condition
async function testUserRoleEquals(clientId) {
  logSection('STEP 3: Test USER_ROLE_EQUALS Condition');

  // Test 1: Check if current user is ADMIN (should be true)
  const test1 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'USER_ROLE_EQUALS',
      value: 'ADMIN',
    },
    clientId,
  }, authToken, csrfToken);

  const passed1 = test1.status === 200 && test1.data.success === true && test1.data.matched === true;
  logTest('USER_ROLE_EQUALS - Admin', passed1, test1.data.message);

  // Test 2: Check if current user is PROCESSOR (should be false)
  const test2 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'USER_ROLE_EQUALS',
      value: 'PROCESSOR',
    },
    clientId,
  }, authToken, csrfToken);

  const passed2 = test2.status === 200 && test2.data.success === true && test2.data.matched === false;
  logTest('USER_ROLE_EQUALS - Not Processor', passed2, test2.data.message);

  // Test 3: Missing userId in context (should fail)
  const test3 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'USER_ROLE_EQUALS',
      value: 'ADMIN',
    },
    clientId,
    noUserId: true, // Signal to omit userId
  }, authToken, csrfToken);

  const passed3 = test3.status === 200 && test3.data.success === false && test3.data.matched === false;
  logTest('USER_ROLE_EQUALS - No UserId (Error)', passed3, test3.data.message);

  return passed1 && passed2 && passed3;
}

// Step 4: Test TIME_OF_DAY condition
async function testTimeOfDay(clientId) {
  logSection('STEP 4: Test TIME_OF_DAY Condition');

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Test 1: Business hours (9am - 5pm)
  const test1 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'TIME_OF_DAY',
      value: {
        start: '09:00',
        end: '17:00',
      },
    },
    clientId,
  }, authToken, csrfToken);

  const isBusinessHours = currentTimeInMinutes >= 540 && currentTimeInMinutes <= 1020;
  const passed1 = test1.status === 200 && test1.data.success === true && test1.data.matched === isBusinessHours;
  logTest('TIME_OF_DAY - Business Hours (9am-5pm)', passed1, test1.data.message);

  // Test 2: All day (midnight to midnight)
  const test2 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'TIME_OF_DAY',
      value: {
        start: '00:00',
        end: '23:59',
      },
    },
    clientId,
  }, authToken, csrfToken);

  const passed2 = test2.status === 200 && test2.data.success === true && test2.data.matched === true;
  logTest('TIME_OF_DAY - All Day', passed2, test2.data.message);

  // Test 3: Invalid time range (missing end)
  const test3 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'TIME_OF_DAY',
      value: {
        start: '09:00',
      },
    },
    clientId,
  }, authToken, csrfToken);

  const passed3 = test3.status === 200 && test3.data.success === false;
  logTest('TIME_OF_DAY - Invalid Range (Error)', passed3, test3.data.message);

  return passed1 && passed2 && passed3;
}

// Step 5: Test DAY_OF_WEEK condition
async function testDayOfWeek(clientId) {
  logSection('STEP 5: Test DAY_OF_WEEK Condition');

  const now = new Date();
  const currentDayNumber = now.getDay(); // 0 = Sunday, 6 = Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[currentDayNumber];

  // Test 1: Weekdays (Mon-Fri)
  const test1 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'DAY_OF_WEEK',
      value: [1, 2, 3, 4, 5], // Mon-Fri
    },
    clientId,
  }, authToken, csrfToken);

  const isWeekday = currentDayNumber >= 1 && currentDayNumber <= 5;
  const passed1 = test1.status === 200 && test1.data.success === true && test1.data.matched === isWeekday;
  logTest('DAY_OF_WEEK - Weekdays (Mon-Fri)', passed1, test1.data.message);

  // Test 2: All days
  const test2 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'DAY_OF_WEEK',
      value: [0, 1, 2, 3, 4, 5, 6], // All days
    },
    clientId,
  }, authToken, csrfToken);

  const passed2 = test2.status === 200 && test2.data.success === true && test2.data.matched === true;
  logTest('DAY_OF_WEEK - All Days', passed2, test2.data.message);

  // Test 3: Using day names
  const test3 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'DAY_OF_WEEK',
      value: [currentDayName], // Current day
    },
    clientId,
  }, authToken, csrfToken);

  const passed3 = test3.status === 200 && test3.data.success === true && test3.data.matched === true;
  logTest('DAY_OF_WEEK - Current Day Name', passed3, test3.data.message);

  // Test 4: Invalid (empty array)
  const test4 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'DAY_OF_WEEK',
      value: [],
    },
    clientId,
  }, authToken, csrfToken);

  const passed4 = test4.status === 200 && test4.data.success === false;
  logTest('DAY_OF_WEEK - Empty Array (Error)', passed4, test4.data.message);

  return passed1 && passed2 && passed3 && passed4;
}

// Step 6: Test AND condition
async function testAndCondition(clientId) {
  logSection('STEP 6: Test AND Condition (Nested Conditions)');

  // Test 1: Both conditions should match (user is ADMIN AND current time is all day)
  const test1 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'AND',
      conditions: [
        {
          type: 'USER_ROLE_EQUALS',
          value: 'ADMIN',
        },
        {
          type: 'TIME_OF_DAY',
          value: {
            start: '00:00',
            end: '23:59',
          },
        },
      ],
    },
    clientId,
  }, authToken, csrfToken);

  const passed1 = test1.status === 200 && test1.data.success === true && test1.data.matched === true;
  logTest('AND - User is Admin AND Time is All Day', passed1, test1.data.message);

  // Test 2: One condition fails (user is ADMIN AND user is PROCESSOR - impossible)
  const test2 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'AND',
      conditions: [
        {
          type: 'USER_ROLE_EQUALS',
          value: 'ADMIN',
        },
        {
          type: 'USER_ROLE_EQUALS',
          value: 'PROCESSOR',
        },
      ],
    },
    clientId,
  }, authToken, csrfToken);

  const passed2 = test2.status === 200 && test2.data.success === true && test2.data.matched === false;
  logTest('AND - Admin AND Processor (Impossible)', passed2, test2.data.message);

  // Test 3: No nested conditions (error)
  const test3 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'AND',
    },
    clientId,
  }, authToken, csrfToken);

  const passed3 = test3.status === 200 && test3.data.success === false;
  logTest('AND - No Nested Conditions (Error)', passed3, test3.data.message);

  return passed1 && passed2 && passed3;
}

// Step 7: Test OR condition
async function testOrCondition(clientId) {
  logSection('STEP 7: Test OR Condition (Nested Conditions)');

  // Test 1: At least one matches (user is ADMIN OR user is PROCESSOR)
  const test1 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'OR',
      conditions: [
        {
          type: 'USER_ROLE_EQUALS',
          value: 'ADMIN',
        },
        {
          type: 'USER_ROLE_EQUALS',
          value: 'PROCESSOR',
        },
      ],
    },
    clientId,
  }, authToken, csrfToken);

  const passed1 = test1.status === 200 && test1.data.success === true && test1.data.matched === true;
  logTest('OR - Admin OR Processor', passed1, test1.data.message);

  // Test 2: Neither matches (weekend if today is weekday, or vice versa)
  const now = new Date();
  const currentDay = now.getDay();
  const oppositeDays = currentDay >= 1 && currentDay <= 5 ? [0, 6] : [1, 2, 3, 4, 5];

  const test2 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'OR',
      conditions: [
        {
          type: 'DAY_OF_WEEK',
          value: oppositeDays,
        },
        {
          type: 'USER_ROLE_EQUALS',
          value: 'NONEXISTENT_ROLE',
        },
      ],
    },
    clientId,
  }, authToken, csrfToken);

  const passed2 = test2.status === 200 && test2.data.success === true && test2.data.matched === false;
  logTest('OR - Neither Condition Matches', passed2, test2.data.message);

  // Test 3: No nested conditions (error)
  const test3 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'OR',
    },
    clientId,
  }, authToken, csrfToken);

  const passed3 = test3.status === 200 && test3.data.success === false;
  logTest('OR - No Nested Conditions (Error)', passed3, test3.data.message);

  return passed1 && passed2 && passed3;
}

// Step 8: Test complex nested conditions
async function testComplexNested(clientId) {
  logSection('STEP 8: Test Complex Nested Conditions');

  // Test: (USER_ROLE_EQUALS = ADMIN AND DAY_OF_WEEK = weekdays) OR (TIME_OF_DAY = all day)
  const test1 = await request('POST', '/api/workflows/test-condition', {
    conditions: {
      type: 'OR',
      conditions: [
        {
          type: 'AND',
          conditions: [
            {
              type: 'USER_ROLE_EQUALS',
              value: 'ADMIN',
            },
            {
              type: 'DAY_OF_WEEK',
              value: [1, 2, 3, 4, 5],
            },
          ],
        },
        {
          type: 'TIME_OF_DAY',
          value: {
            start: '00:00',
            end: '23:59',
          },
        },
      ],
    },
    clientId,
  }, authToken, csrfToken);

  const passed1 = test1.status === 200 && test1.data.success === true && test1.data.matched === true;
  logTest('Complex - (Admin AND Weekday) OR All Day', passed1, test1.data.message);

  return passed1;
}

// Step 9: Cleanup
async function cleanup(clientId) {
  logSection('STEP 9: Cleanup');

  const response = await request('DELETE', `/api/clients/${clientId}`, null, authToken);

  if (response.status === 200 || response.status === 204) {
    logTest('Delete Test Client', true, 'Client deleted successfully');
  } else {
    logTest('Delete Test Client', false, `Failed: ${JSON.stringify(response.data)}`);
  }
}

// Main test runner
async function runTests() {
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  Feature #284: Condition Evaluator - Context Conditions${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);

  let clientId = null;
  const results = [];

  try {
    // Login
    const user = await login();
    results.push({ name: 'Login', passed: true });

    // Create test client
    clientId = await createTestClient();
    results.push({ name: 'Create Test Client', passed: true });

    // Run tests
    const roleResult = await testUserRoleEquals(clientId);
    results.push({ name: 'USER_ROLE_EQUALS', passed: roleResult });

    const timeResult = await testTimeOfDay(clientId);
    results.push({ name: 'TIME_OF_DAY', passed: timeResult });

    const dayResult = await testDayOfWeek(clientId);
    results.push({ name: 'DAY_OF_WEEK', passed: dayResult });

    const andResult = await testAndCondition(clientId);
    results.push({ name: 'AND Condition', passed: andResult });

    const orResult = await testOrCondition(clientId);
    results.push({ name: 'OR Condition', passed: orResult });

    const complexResult = await testComplexNested(clientId);
    results.push({ name: 'Complex Nested', passed: complexResult });

  } catch (error) {
    console.error(`${RED}ERROR: ${error.message}${RESET}`);
    results.push({ name: 'Tests', passed: false, error: error.message });
  } finally {
    // Cleanup
    if (clientId) {
      await cleanup(clientId);
    }
  }

  // Summary
  logSection('TEST SUMMARY');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(r => {
    const status = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`${status} ${r.name}`);
    if (r.error) {
      console.log(`  ${RED}${r.error}${RESET}`);
    }
  });

  console.log(`\n${BLUE}Total: ${passed}/${total} tests passed${RESET}\n`);

  if (passed === total) {
    console.log(`${GREEN}╔═══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${GREEN}║  ✓ FEATURE #284: ALL TESTS PASSED                       ║${RESET}`);
    console.log(`${GREEN}╚═══════════════════════════════════════════════════════════╝${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}╔═══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${RED}║  ✗ FEATURE #284: SOME TESTS FAILED                       ║${RESET}`);
    console.log(`${RED}╚═══════════════════════════════════════════════════════════╝${RESET}\n`);
    process.exit(1);
  }
}

// Run tests
runTests();
