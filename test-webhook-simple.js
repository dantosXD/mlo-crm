/**
 * Simple test for Feature #291 - CALL_WEBHOOK Action Executor
 * Tests the webhook executor directly with hardcoded values
 */

const TEST_USER = {
  email: 'mlo@example.com',
  password: 'password123'
};

let authToken = '';

// Helper function to login
async function login() {
  console.log('\n🔐 Logging in...');
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const data = await response.json();
  authToken = data.accessToken;
  console.log('✅ Login successful');
  return authToken;
}

// Helper to get a test client ID
async function getTestClientId() {
  const response = await fetch('http://localhost:3000/api/clients?limit=1', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (!response.ok) {
    return 'test-client-id'; // Fallback
  }

  const data = await response.json();
  if (data.clients && data.clients.length > 0) {
    return data.clients[0].id;
  }

  return 'test-client-id';
}

// Test 1: Basic webhook call with validation
async function test1_BasicWebhook() {
  console.log('\n=== TEST 1: Basic Webhook Call ===');

  const response = await fetch('http://localhost:3000/api/workflows/test-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dummy-token-for-dev',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        bodyTemplate: JSON.stringify({
          title: 'Test Webhook',
          body: 'Testing CALL_WEBHOOK action',
          clientId: '{{clientId}}',
        }),
        timeoutSeconds: 10,
      },
      context: {
        clientId: 'test-client-id-123',
        triggerType: 'MANUAL',
        triggerData: {},
        userId: 'test-user-id',
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ PASS: Webhook call successful');
    console.log(`   Status: ${result.data.statusCode}`);
    console.log(`   Response: ${result.data.responseBody.substring(0, 100)}...`);
    return true;
  } else {
    console.log('❌ FAIL: Webhook call failed');
    console.log(`   Error: ${result.message}`);
    return false;
  }
}

// Test 2: Webhook with GET method
async function test2_WebhookGet() {
  console.log('\n=== TEST 2: Webhook GET Request ===');

  const response = await fetch('http://localhost:3000/api/workflows/test-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dummy-token-for-dev',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
        timeoutSeconds: 10,
      },
      context: {
        clientId: 'test-client-id-123',
        triggerType: 'MANUAL',
        triggerData: {},
        userId: 'test-user-id',
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ PASS: GET webhook successful');
    console.log(`   Status: ${result.data.statusCode}`);
    return true;
  } else {
    console.log('❌ FAIL: GET webhook failed');
    console.log(`   Error: ${result.message}`);
    return false;
  }
}

// Test 3: Webhook validation (missing URL)
async function test3_Validation() {
  console.log('\n=== TEST 3: Webhook Validation (Missing URL) ===');

  const response = await fetch('http://localhost:3000/api/workflows/test-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dummy-token-for-dev',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        method: 'POST',
      },
      context: {
        clientId: 'test-client-id-123',
        triggerType: 'MANUAL',
        triggerData: {},
        userId: 'test-user-id',
      },
    }),
  });

  const result = await response.json();

  if (!result.success && result.message.includes('URL is required')) {
    console.log('✅ PASS: Validation working correctly');
    console.log(`   Error: ${result.message}`);
    return true;
  } else {
    console.log('❌ FAIL: Validation not working');
    console.log(`   Result: ${JSON.stringify(result)}`);
    return false;
  }
}

// Test 4: Webhook retry logic
async function test4_RetryLogic() {
  console.log('\n=== TEST 4: Webhook Retry Logic ===');

  const response = await fetch('http://localhost:3000/api/workflows/test-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dummy-token-for-dev',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://invalid-domain-test-12345.com/webhook',
        method: 'POST',
        retryOnFailure: true,
        maxRetries: 2,
        retryDelaySeconds: 1,
        timeoutSeconds: 3,
      },
      context: {
        clientId: 'test-client-id-123',
        triggerType: 'MANUAL',
        triggerData: {},
        userId: 'test-user-id',
      },
    }),
  });

  const result = await response.json();

  if (!result.success) {
    console.log('✅ PASS: Webhook failed as expected with retries');
    console.log(`   Attempts: ${result.data?.attempts || 'N/A'}`);
    console.log(`   Error: ${result.message}`);
    return true;
  } else {
    console.log('❌ FAIL: Webhook should have failed');
    return false;
  }
}

// Test 5: Webhook with custom headers
async function test5_CustomHeaders() {
  console.log('\n=== TEST 5: Webhook with Custom Headers ===');

  const response = await fetch('http://localhost:3000/api/workflows/test-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dummy-token-for-dev',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'Custom-Value',
          'X-Test-Id': 'TEST-12345',
        },
        bodyTemplate: JSON.stringify({
          title: 'Test with Headers',
        }),
        timeoutSeconds: 10,
      },
      context: {
        clientId: 'test-client-id-123',
        triggerType: 'MANUAL',
        triggerData: {},
        userId: 'test-user-id',
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ PASS: Webhook with custom headers successful');
    console.log(`   Status: ${result.data.statusCode}`);
    return true;
  } else {
    console.log('❌ FAIL: Webhook with headers failed');
    console.log(`   Error: ${result.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Feature #291 - CALL_WEBHOOK Action Tests   ║');
  console.log('╚════════════════════════════════════════════════╝');

  try {
    const results = [];

    results.push(await test1_BasicWebhook());
    results.push(await test2_WebhookGet());
    results.push(await test3_Validation());
    results.push(await test4_RetryLogic());
    results.push(await test5_CustomHeaders());

    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r).length}`);
    console.log(`Failed: ${results.filter(r => !r).length}`);

    if (results.every(r => r)) {
      console.log('\n✅ ALL TESTS PASSED!');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
    }

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    process.exit(1);
  }
}

runTests();
