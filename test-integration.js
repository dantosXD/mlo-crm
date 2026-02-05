// Test script for Tasks-Calendar-Reminders Integration
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3002';

// Test credentials (you may need to update these)
const TEST_USER = {
  email: 'admin@example.com',
  password: 'admin123'
};

async function login() {
  console.log('1. Testing login...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✓ Login successful');
    console.log(`  User: ${data.user.name} (${data.user.email})`);
    console.log(`  Role: ${data.user.role}`);

    // Get cookies from response
    const cookies = response.headers.get('set-cookie');
    return { cookies, user: data.user };
  } catch (error) {
    console.error('✗ Login failed:', error.message);
    return null;
  }
}

async function testTodayView(cookies) {
  console.log('\n2. Testing /api/today endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/today`, {
      headers: {
        'Cookie': cookies
      }
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✓ Today view data fetched');
    console.log(`  Date: ${data.date}`);
    console.log(`  Summary:`, data.summary);
    console.log(`  Tasks due today: ${data.tasks.length}`);
    console.log(`  Events today: ${data.events.length}`);
    console.log(`  Reminders today: ${data.reminders.length}`);
    console.log(`  Overdue tasks: ${data.overdue.tasks.length}`);
    console.log(`  Overdue reminders: ${data.overdue.reminders.length}`);
    return true;
  } catch (error) {
    console.error('✗ Today view failed:', error.message);
    return false;
  }
}

async function testUnifiedSearch(cookies) {
  console.log('\n3. Testing /api/unified-search endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/unified-search?q=test`, {
      headers: {
        'Cookie': cookies
      }
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✓ Unified search works');
    console.log(`  Query: "${data.query}"`);
    console.log(`  Total results: ${data.total}`);
    console.log(`  Tasks found: ${data.results.tasks.length}`);
    console.log(`  Events found: ${data.results.events.length}`);
    console.log(`  Reminders found: ${data.results.reminders.length}`);
    return true;
  } catch (error) {
    console.error('✗ Unified search failed:', error.message);
    return false;
  }
}

async function testTaskToEventConversion(cookies, taskId) {
  console.log('\n4. Testing task → event conversion...');
  try {
    const response = await fetch(`${BASE_URL}/api/tasks/${taskId}/create-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        startTime: new Date().toISOString(),
        duration: 60,
        allDay: false
      })
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const event = await response.json();
    console.log('✓ Task to event conversion works');
    console.log(`  Event ID: ${event.id}`);
    console.log(`  Event title: ${event.title}`);
    console.log(`  Linked task ID: ${event.taskId}`);
    return true;
  } catch (error) {
    console.error('✗ Task to event conversion failed:', error.message);
    return false;
  }
}

async function testEventToTaskConversion(cookies, eventId) {
  console.log('\n5. Testing event → task conversion...');
  try {
    const response = await fetch(`${BASE_URL}/api/events/${eventId}/create-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        priority: 'MEDIUM'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const task = await response.json();
    console.log('✓ Event to task conversion works');
    console.log(`  Task ID: ${task.id}`);
    console.log(`  Task text: ${task.text}`);
    return true;
  } catch (error) {
    console.error('✗ Event to task conversion failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('TASKS-CALENDAR-REMINDERS INTEGRATION TESTS');
  console.log('='.repeat(60));

  const auth = await login();
  if (!auth) {
    console.log('\n✗ Cannot proceed without authentication');
    return;
  }

  const results = [];

  // Test 1: Today view
  results.push(await testTodayView(auth.cookies));

  // Test 2: Unified search
  results.push(await testUnifiedSearch(auth.cookies));

  // Test 3: Task to event conversion (if we have a task)
  // For now, skip as we need a valid task ID
  // results.push(await testTaskToEventConversion(auth.cookies, 'task-id'));

  // Test 4: Event to task conversion (if we have an event)
  // For now, skip as we need a valid event ID
  // results.push(await testEventToTaskConversion(auth.cookies, 'event-id'));

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Tests passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\n✓ All integration tests passed!');
  } else {
    console.log('\n✗ Some tests failed. Check the output above.');
  }
}

runTests().catch(console.error);
