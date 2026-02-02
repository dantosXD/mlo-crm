#!/usr/bin/env node
/**
 * Test Feature #284: Condition Evaluator - Context Conditions (Direct Test)
 *
 * Tests the condition evaluator directly without HTTP layer
 */

import { PrismaClient } from './backend/node_modules/@prisma/client/index.js';
import bcrypt from './backend/node_modules/bcryptjs/index.js';
import {
  evaluateConditions,
} from './backend/dist/services/conditionEvaluator.js';

const prisma = new PrismaClient();

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

// Helper: Log test result
function logTest(testName, passed, message) {
  const status = passed ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
  console.log(`${status} - ${testName}`);
  if (message) {
    console.log(`  ${BLUE}${message}${RESET}`);
  }
  return passed;
}

// Helper: Log section
function logSection(title) {
  console.log(`\n${YELLOW}═══ ${title} ═══${RESET}\n`);
}

// Test data
let testClientId = null;
let testUserId = null;

async function setup() {
  logSection('SETUP: Creating Test Data');

  // Create test user
  const passwordHash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'feature284@test.com' },
    update: {},
    create: {
      email: 'feature284@test.com',
      passwordHash,
      name: 'Feature 284 Test User',
      role: 'ADMIN',
    },
  });

  testUserId = user.id;
  logTest('Create Test User', true, `User ID: ${user.id}, Role: ${user.role}`);

  // Create test client
  const client = await prisma.client.create({
    data: {
      nameEncrypted: JSON.stringify({
        first: 'Feature',
        middle: '',
        last: '284 Test',
      }),
      emailEncrypted: JSON.stringify('feature284-client@test.com'),
      phoneEncrypted: JSON.stringify('555-0284'),
      nameHash: Buffer.from('feature284-test-client').toString('hex'),
      emailHash: Buffer.from('feature284-client@test.com').toString('hex'),
      phoneHash: Buffer.from('555-0284').toString('hex'),
      status: 'LEAD',
      tags: JSON.stringify(['test-tag']),
      createdBy: {
        connect: { id: user.id },
      },
    },
  });

  testClientId = client.id;
  logTest('Create Test Client', true, `Client ID: ${client.id}`);

  // Now update the client with the proper createdBy relationship
  await prisma.client.update({
    where: { id: client.id },
    data: {
      createdBy: {
        connect: { id: user.id },
      },
    },
  });
}

async function testUserRoleEquals() {
  logSection('TEST 1: USER_ROLE_EQUALS');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  // Test 1: Check if user is ADMIN (should be true)
  const result1 = await evaluateConditions(
    { type: 'USER_ROLE_EQUALS', value: 'ADMIN' },
    context
  );
  const test1 = logTest('USER_ROLE_EQUALS - Admin', result1.success && result1.matched, result1.message);

  // Test 2: Check if user is PROCESSOR (should be false)
  const result2 = await evaluateConditions(
    { type: 'USER_ROLE_EQUALS', value: 'PROCESSOR' },
    context
  );
  const test2 = logTest('USER_ROLE_EQUALS - Not Processor', result2.success && !result2.matched, result2.message);

  // Test 3: Missing userId (should fail)
  const noUserContext = { ...context, userId: undefined };
  const result3 = await evaluateConditions(
    { type: 'USER_ROLE_EQUALS', value: 'ADMIN' },
    noUserContext
  );
  const test3 = logTest('USER_ROLE_EQUALS - No UserId (Error)', !result3.success, result3.message);

  return test1 && test2 && test3;
}

async function testTimeOfDay() {
  logSection('TEST 2: TIME_OF_DAY');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  const now = new Date();
  const currentHour = now.getHours();
  const currentTimeInMinutes = currentHour * 60 + now.getMinutes();

  // Test 1: All day range (should always be true)
  const result1 = await evaluateConditions(
    {
      type: 'TIME_OF_DAY',
      value: { start: '00:00', end: '23:59' },
    },
    context
  );
  const test1 = logTest('TIME_OF_DAY - All Day', result1.success && result1.matched, result1.message);

  // Test 2: Business hours (9am-5pm)
  const isBusinessHours = currentTimeInMinutes >= 540 && currentTimeInMinutes <= 1020;
  const result2 = await evaluateConditions(
    {
      type: 'TIME_OF_DAY',
      value: { start: '09:00', end: '17:00' },
    },
    context
  );
  const test2 = logTest('TIME_OF_DAY - Business Hours', result2.success && result2.matched === isBusinessHours, result2.message);

  // Test 3: Invalid range (missing end)
  const result3 = await evaluateConditions(
    {
      type: 'TIME_OF_DAY',
      value: { start: '09:00' },
    },
    context
  );
  const test3 = logTest('TIME_OF_DAY - Invalid Range (Error)', !result3.success, result3.message);

  return test1 && test2 && test3;
}

async function testDayOfWeek() {
  logSection('TEST 3: DAY_OF_WEEK');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  const now = new Date();
  const currentDayNumber = now.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[currentDayNumber];

  // Test 1: All days (should be true)
  const result1 = await evaluateConditions(
    {
      type: 'DAY_OF_WEEK',
      value: [0, 1, 2, 3, 4, 5, 6],
    },
    context
  );
  const test1 = logTest('DAY_OF_WEEK - All Days', result1.success && result1.matched, result1.message);

  // Test 2: Current day (should be true)
  const result2 = await evaluateConditions(
    {
      type: 'DAY_OF_WEEK',
      value: [currentDayNumber],
    },
    context
  );
  const test2 = logTest('DAY_OF_WEEK - Current Day Number', result2.success && result2.matched, result2.message);

  // Test 3: Current day by name (should be true)
  const result3 = await evaluateConditions(
    {
      type: 'DAY_OF_WEEK',
      value: [currentDayName],
    },
    context
  );
  const test3 = logTest('DAY_OF_WEEK - Current Day Name', result3.success && result3.matched, result3.message);

  // Test 4: Empty array (should fail)
  const result4 = await evaluateConditions(
    {
      type: 'DAY_OF_WEEK',
      value: [],
    },
    context
  );
  const test4 = logTest('DAY_OF_WEEK - Empty Array (Error)', !result4.success, result4.message);

  return test1 && test2 && test3 && test4;
}

async function testAndCondition() {
  logSection('TEST 4: AND Condition (Nested)');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  // Test 1: Both conditions match (Admin AND All Day)
  const result1 = await evaluateConditions(
    {
      type: 'AND',
      conditions: [
        { type: 'USER_ROLE_EQUALS', value: 'ADMIN' },
        { type: 'TIME_OF_DAY', value: { start: '00:00', end: '23:59' } },
      ],
    },
    context
  );
  const test1 = logTest('AND - Admin AND All Day', result1.success && result1.matched, result1.message);

  // Test 2: One condition fails (Admin AND Processor - impossible)
  const result2 = await evaluateConditions(
    {
      type: 'AND',
      conditions: [
        { type: 'USER_ROLE_EQUALS', value: 'ADMIN' },
        { type: 'USER_ROLE_EQUALS', value: 'PROCESSOR' },
      ],
    },
    context
  );
  const test2 = logTest('AND - Admin AND Processor (Impossible)', result2.success && !result2.matched, result2.message);

  // Test 3: No nested conditions (error)
  const result3 = await evaluateConditions(
    { type: 'AND' },
    context
  );
  const test3 = logTest('AND - No Nested Conditions (Error)', !result3.success, result3.message);

  return test1 && test2 && test3;
}

async function testOrCondition() {
  logSection('TEST 5: OR Condition (Nested)');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  // Test 1: At least one matches (Admin OR Processor)
  const result1 = await evaluateConditions(
    {
      type: 'OR',
      conditions: [
        { type: 'USER_ROLE_EQUALS', value: 'ADMIN' },
        { type: 'USER_ROLE_EQUALS', value: 'PROCESSOR' },
      ],
    },
    context
  );
  const test1 = logTest('OR - Admin OR Processor', result1.success && result1.matched, result1.message);

  // Test 2: Neither matches
  const now = new Date();
  const currentDay = now.getDay();
  const oppositeDays = currentDay >= 1 && currentDay <= 5 ? [0, 6] : [1, 2, 3, 4, 5];

  const result2 = await evaluateConditions(
    {
      type: 'OR',
      conditions: [
        { type: 'DAY_OF_WEEK', value: oppositeDays },
        { type: 'USER_ROLE_EQUALS', value: 'NONEXISTENT_ROLE' },
      ],
    },
    context
  );
  const test2 = logTest('OR - Neither Matches', result2.success && !result2.matched, result2.message);

  // Test 3: No nested conditions (error)
  const result3 = await evaluateConditions(
    { type: 'OR' },
    context
  );
  const test3 = logTest('OR - No Nested Conditions (Error)', !result3.success, result3.message);

  return test1 && test2 && test3;
}

async function testComplexNested() {
  logSection('TEST 6: Complex Nested Conditions');

  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: testUserId,
  };

  // Test: (Admin AND Weekday) OR (All Day)
  const result1 = await evaluateConditions(
    {
      type: 'OR',
      conditions: [
        {
          type: 'AND',
          conditions: [
            { type: 'USER_ROLE_EQUALS', value: 'ADMIN' },
            { type: 'DAY_OF_WEEK', value: [1, 2, 3, 4, 5] },
          ],
        },
        { type: 'TIME_OF_DAY', value: { start: '00:00', end: '23:59' } },
      ],
    },
    context
  );
  const test1 = logTest('Complex - (Admin AND Weekday) OR All Day', result1.success && result1.matched, result1.message);

  return test1;
}

async function cleanup() {
  logSection('CLEANUP');

  try {
    if (testClientId) {
      await prisma.client.delete({
        where: { id: testClientId },
      });
      logTest('Delete Test Client', true, 'Client deleted');
    }
  } catch (error) {
    logTest('Delete Test Client', false, error.message);
  }

  try {
    await prisma.user.deleteMany({
      where: { email: 'feature284@test.com' },
    });
    logTest('Delete Test User', true, 'User deleted');
  } catch (error) {
    logTest('Delete Test User', false, error.message);
  }

  await prisma.$disconnect();
}

async function runTests() {
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  Feature #284: Condition Evaluator - Context Conditions${RESET}`);
  console.log(`${BLUE}  Direct Service Test (No HTTP Layer)${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);

  const results = [];

  try {
    await setup();
    results.push({ name: 'Setup', passed: true });

    const roleResult = await testUserRoleEquals();
    results.push({ name: 'USER_ROLE_EQUALS', passed: roleResult });

    const timeResult = await testTimeOfDay();
    results.push({ name: 'TIME_OF_DAY', passed: timeResult });

    const dayResult = await testDayOfWeek();
    results.push({ name: 'DAY_OF_WEEK', passed: dayResult });

    const andResult = await testAndCondition();
    results.push({ name: 'AND Condition', passed: andResult });

    const orResult = await testOrCondition();
    results.push({ name: 'OR Condition', passed: orResult });

    const complexResult = await testComplexNested();
    results.push({ name: 'Complex Nested', passed: complexResult });

  } catch (error) {
    console.error(`${RED}ERROR: ${error.message}${RESET}`);
    console.error(error.stack);
    results.push({ name: 'Tests', passed: false, error: error.message });
  } finally {
    await cleanup();
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

runTests();
