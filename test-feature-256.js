#!/usr/bin/env node

/**
 * Direct API test for Feature #256: Communication Status Management
 */

const http = require('http');

const requestOptions = (method, path, data, token) => ({
  hostname: 'localhost',
  port: 3000,
  path: path,
  method: method,
  headers: {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  },
});

const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null,
          });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function testFeature256() {
  console.log('=== Feature #256: Communication Status Management API ===\n');

  // Step 1: Login
  console.log('Step 1: Logging in...');
  const loginRes = await makeRequest(requestOptions('POST', '/api/auth/login', {
    email: 'admin@test.com',
    password: 'admin123',
  }));

  if (loginRes.status !== 200) {
    console.error('❌ Login failed');
    return;
  }

  const token = loginRes.data.accessToken || loginRes.data.token;
  console.log('✅ Login successful\n');

  // Step 2: Get a client
  console.log('Step 2: Getting a client...');
  const clientsRes = await makeRequest(requestOptions('GET', '/api/clients?limit=1', null, token));

  if (clientsRes.status !== 200 || !clientsRes.data?.data?.length) {
    console.error('❌ No clients found');
    console.log('Response:', clientsRes);
    return;
  }

  const clientId = clientsRes.data.data[0].id;
  console.log(`✅ Using client: ${clientId.substring(0, 8)}...\n`);

  // Step 3: Create DRAFT communication
  console.log('Step 3: Creating DRAFT communication...');
  const createRes = await makeRequest(requestOptions('POST', '/api/communications', {
    clientId,
    type: 'EMAIL',
    subject: 'Feature 256 Test',
    body: 'Testing communication status management',
  }, token));

  if (createRes.status !== 201) {
    console.error('❌ Failed to create communication');
    console.log(createRes.data);
    return;
  }

  const commId = createRes.data.id;
  console.log(`✅ Created communication: ${commId.substring(0, 8)}...`);
  console.log(`   Status: ${createRes.data.status}\n`);

  // Step 4: Test PATCH /status - DRAFT to READY
  console.log('Step 4: Testing PATCH /status (DRAFT -> READY)...');
  const statusRes1 = await makeRequest(requestOptions('PATCH', `/api/communications/${commId}/status`, {
    status: 'READY',
  }, token));

  if (statusRes1.status !== 200) {
    console.error('❌ Failed to update status to READY');
    console.log(statusRes1.data);
    return;
  }

  console.log('✅ Status updated to READY');
  console.log(`   Status: ${statusRes1.data.status}\n`);

  // Step 5: Test invalid transition (READY -> DRAFT)
  console.log('Step 5: Testing invalid transition (READY -> DRAFT)...');
  const invalidRes = await makeRequest(requestOptions('PATCH', `/api/communications/${commId}/status`, {
    status: 'DRAFT',
  }, token));

  if (invalidRes.status !== 400) {
    console.error('❌ Should have rejected backward transition');
    return;
  }

  console.log('✅ Backward transition correctly rejected');
  console.log(`   Error: ${invalidRes.data.message}\n`);

  // Step 6: Test POST /send - mark as sent
  console.log('Step 6: Testing POST /send endpoint...');
  const sendRes = await makeRequest(requestOptions('POST', `/api/communications/${commId}/send`, {
    metadata: { test: 'data' },
  }, token));

  if (sendRes.status !== 200) {
    console.error('❌ Failed to send communication');
    console.log(sendRes.data);
    return;
  }

  console.log('✅ Communication sent successfully');
  console.log(`   Status: ${sendRes.data.status}`);
  console.log(`   Sent At: ${sendRes.data.sentAt}\n`);

  // Step 7: Test that SENT cannot change
  console.log('Step 7: Testing that SENT cannot transition...');
  const sentRes = await makeRequest(requestOptions('PATCH', `/api/communications/${commId}/status`, {
    status: 'READY',
  }, token));

  if (sentRes.status !== 400) {
    console.error('❌ Should have rejected transition from SENT');
    return;
  }

  console.log('✅ Transition from SENT correctly rejected');
  console.log(`   Error: ${sentRes.data.message}\n`);

  // Step 8: Test transition to FAILED
  console.log('Step 8: Testing transition to FAILED...');
  const createRes2 = await makeRequest(requestOptions('POST', '/api/communications', {
    clientId,
    type: 'EMAIL',
    subject: 'Test 2',
    body: 'Will be failed',
  }, token));

  if (createRes2.status !== 201) {
    console.error('❌ Failed to create second communication');
    return;
  }

  const commId2 = createRes2.data.id;
  const failRes = await makeRequest(requestOptions('PATCH', `/api/communications/${commId2}/status`, {
    status: 'FAILED',
  }, token));

  if (failRes.status !== 200) {
    console.error('❌ Failed to mark as FAILED');
    console.log(failRes.data);
    return;
  }

  console.log('✅ Communication marked as FAILED');
  console.log(`   Status: ${failRes.data.status}\n`);

  console.log('=== All Tests Passed! ✅ ===\n');
  console.log('Summary:');
  console.log('✅ PATCH /api/communications/:id/status working');
  console.log('✅ POST /api/communications/:id/send working');
  console.log('✅ Status transitions validated');
  console.log('✅ Backward transitions prevented');
  console.log('✅ SENT state is immutable\n');
}

testFeature256().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
