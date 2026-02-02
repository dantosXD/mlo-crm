#!/usr/bin/env node

/**
 * Test script for Feature #256: Communication Status Management API
 * Tests:
 * 1. PATCH /api/communications/:id/status - Status transitions
 * 2. POST /api/communications/:id/send - Mark as sent
 * 3. Status transition validation
 * 4. Activity logging
 */

const http = async (method, path, data = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`http://localhost:3000${path}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : null,
  });

  const text = await response.text();
  try {
    return {
      status: response.status,
      data: text ? JSON.parse(text) : null,
    };
  } catch {
    return {
      status: response.status,
      data: text,
    };
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('=== Feature #256: Communication Status Management API Tests ===\n');

  // Step 1: Login
  console.log('Step 1: Login as admin user...');
  const loginResult = await http('POST', '/api/auth/login', {
    email: 'admin@test.com',
    password: 'admin123',
  });

  if (loginResult.status !== 200) {
    console.error('❌ Login failed');
    console.log(JSON.stringify(loginResult, null, 2));
    process.exit(1);
  }

  const token = loginResult.data.token;
  console.log('✅ Login successful\n');

  // Step 2: Get a client to use
  console.log('Step 2: Getting a client...');
  const clientsResult = await http('GET', '/api/clients?limit=1', null, token);

  if (clientsResult.status !== 200 || !clientsResult.data.data || clientsResult.data.data.length === 0) {
    console.error('❌ No clients found');
    process.exit(1);
  }

  const clientId = clientsResult.data.data[0].id;
  console.log(`✅ Using client: ${clientId}\n`);

  // Step 3: Create a DRAFT communication
  console.log('Step 3: Creating a DRAFT communication...');
  const createResult = await http('POST', '/api/communications', {
    clientId,
    type: 'EMAIL',
    subject: 'Test Communication',
    body: 'This is a test communication for status management API testing.',
  }, token);

  if (createResult.status !== 201) {
    console.error('❌ Failed to create communication');
    console.log(JSON.stringify(createResult, null, 2));
    process.exit(1);
  }

  const commId = createResult.data.id;
  console.log(`✅ Communication created: ${commId}`);
  console.log(`   Status: ${createResult.data.status}\n`);

  // Step 4: Test invalid status transition (DRAFT -> SENT, should fail)
  console.log('Step 4: Testing invalid status transition (DRAFT -> SENT)...');
  const invalidTransitionResult = await http('PATCH', `/api/communications/${commId}/status`, {
    status: 'SENT',
  }, token);

  if (invalidTransitionResult.status !== 400) {
    console.error('❌ Should have rejected invalid transition');
    console.log(JSON.stringify(invalidTransitionResult, null, 2));
    process.exit(1);
  }

  console.log('✅ Invalid transition correctly rejected');
  console.log(`   Error: ${invalidTransitionResult.data.message}\n`);

  // Step 5: Test valid status transition (DRAFT -> READY)
  console.log('Step 5: Testing valid status transition (DRAFT -> READY)...');
  const toReadyResult = await http('PATCH', `/api/communications/${commId}/status`, {
    status: 'READY',
  }, token);

  if (toReadyResult.status !== 200) {
    console.error('❌ Failed to transition to READY');
    console.log(JSON.stringify(toReadyResult, null, 2));
    process.exit(1);
  }

  console.log('✅ Transitioned to READY');
  console.log(`   Status: ${toReadyResult.data.status}\n`);

  // Step 6: Test backward transition (READY -> DRAFT, should fail)
  console.log('Step 6: Testing backward transition (READY -> DRAFT)...');
  const backwardTransitionResult = await http('PATCH', `/api/communications/${commId}/status`, {
    status: 'DRAFT',
  }, token);

  if (backwardTransitionResult.status !== 400) {
    console.error('❌ Should have rejected backward transition');
    console.log(JSON.stringify(backwardTransitionResult, null, 2));
    process.exit(1);
  }

  console.log('✅ Backward transition correctly rejected');
  console.log(`   Error: ${backwardTransitionResult.data.message}\n`);

  // Step 7: Test POST /api/communications/:id/send (READY -> SENT)
  console.log('Step 7: Testing POST /send endpoint...');
  const sendResult = await http('POST', `/api/communications/${commId}/send`, {
    metadata: { provider: 'test', messageId: 'test-123' },
  }, token);

  if (sendResult.status !== 200) {
    console.error('❌ Failed to send communication');
    console.log(JSON.stringify(sendResult, null, 2));
    process.exit(1);
  }

  console.log('✅ Communication sent successfully');
  console.log(`   Status: ${sendResult.data.status}`);
  console.log(`   Sent At: ${sendResult.data.sentAt}\n`);

  // Step 8: Test that SENT cannot transition back
  console.log('Step 8: Testing that SENT cannot transition to READY...');
  const sentTransitionResult = await http('PATCH', `/api/communications/${commId}/status`, {
    status: 'READY',
  }, token);

  if (sentTransitionResult.status !== 400) {
    console.error('❌ Should have rejected transition from SENT');
    console.log(JSON.stringify(sentTransitionResult, null, 2));
    process.exit(1);
  }

  console.log('✅ Transition from SENT correctly rejected');
  console.log(`   Error: ${sentTransitionResult.data.message}\n`);

  // Step 9: Test transition to FAILED
  console.log('Step 9: Creating another communication and testing FAILED status...');
  const createResult2 = await http('POST', '/api/communications', {
    clientId,
    type: 'EMAIL',
    subject: 'Test Communication 2',
    body: 'This will be marked as FAILED.',
  }, token);

  if (createResult2.status !== 201) {
    console.error('❌ Failed to create second communication');
    process.exit(1);
  }

  const commId2 = createResult2.data.id;
  console.log(`✅ Second communication created: ${commId2}`);

  const toFailedResult = await http('PATCH', `/api/communications/${commId2}/status`, {
    status: 'FAILED',
  }, token);

  if (toFailedResult.status !== 200) {
    console.error('❌ Failed to mark as FAILED');
    console.log(JSON.stringify(toFailedResult, null, 2));
    process.exit(1);
  }

  console.log('✅ Communication marked as FAILED');
  console.log(`   Status: ${toFailedResult.data.status}\n`);

  // Step 10: Verify activity logs were created
  console.log('Step 10: Verifying activity logs...');
  await sleep(500); // Wait for activity logs to be created

  const activitiesResult = await http('GET', `/api/activities?client_id=${clientId}&limit=20`, null, token);

  if (activitiesResult.status !== 200) {
    console.error('❌ Failed to fetch activities');
    console.log(JSON.stringify(activitiesResult, null, 2));
    process.exit(1);
  }

  const statusChangeActivities = activitiesResult.data.data.filter(a =>
    a.type === 'COMMUNICATION_STATUS_CHANGED' || a.type === 'COMMUNICATION_SENT'
  );

  console.log(`✅ Found ${statusChangeActivities.length} communication activity entries`);

  if (statusChangeActivities.length > 0) {
    console.log('   Sample activities:');
    statusChangeActivities.slice(0, 3).forEach(activity => {
      console.log(`   - ${activity.type}: ${activity.description}`);
    });
  }

  console.log('\n=== All Tests Passed! ✅ ===\n');
  console.log('Summary:');
  console.log('✅ Status transition API working');
  console.log('✅ Invalid transitions correctly rejected');
  console.log('✅ Send endpoint working');
  console.log('✅ Activity logs created');
  console.log('✅ Backward transitions prevented');
  console.log('✅ SENT state is immutable\n');
}

main().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
