/**
 * Test script for Feature #291 - CALL_WEBHOOK Action Executor
 *
 * This script tests the webhook action executor with various scenarios:
 * 1. Basic webhook call with POST
 * 2. Webhook with custom headers
 * 3. Webhook with body template and placeholder replacement
 * 4. Retry logic on failure
 * 5. Different HTTP methods
 * 6. Timeout handling
 *
 * Prerequisites:
 * - Backend server running on http://localhost:3000
 * - Valid JWT token for authentication
 * - Test client ID in the database
 */

const API_URL = 'http://localhost:3000';
const TEST_WEBHOOK_URL = 'https://webhook.site/#!/test-endpoint'; // Public webhook test service

// Test credentials
const TEST_USER = {
  email: 'manager@test.com',
  password: 'password123',
};

let authToken = null;
let testClientId = null;

/**
 * Login and get JWT token
 */
async function login() {
  console.log('\n=== Logging in ===');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  authToken = data.token;
  console.log('✅ Login successful');
  return data;
}

/**
 * Get or create a test client
 */
async function getTestClient() {
  console.log('\n=== Getting test client ===');

  // Try to get existing clients
  const response = await fetch(`${API_URL}/api/clients?limit=1`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get clients: ${response.status}`);
  }

  const data = await response.json();

  if (data.clients && data.clients.length > 0) {
    testClientId = data.clients[0].id;
    console.log(`✅ Using existing client: ${testClientId}`);
    return data.clients[0];
  }

  // Create a test client if none exists
  console.log('Creating test client...');
  const createResponse = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Webhook Test Client',
      email: 'webhooktest@example.com',
      phone: '555-0199',
      status: 'LEAD',
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create client: ${createResponse.status}`);
  }

  const client = await createResponse.json();
  testClientId = client.id;
  console.log(`✅ Created test client: ${testClientId}`);
  return client;
}

/**
 * Test webhook action executor
 */
async function testCallWebhookAction() {
  console.log('\n========================================');
  console.log('TEST 1: Basic Webhook Call (POST)');
  console.log('========================================');

  const response = await fetch(`${API_URL}/api/workflows/test-action`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts', // Public test API
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test-value',
        },
        bodyTemplate: JSON.stringify({
          title: 'Test Webhook',
          body: 'Testing webhook action from MLO Dashboard',
          clientId: '{{clientId}}',
          timestamp: '{{date}}',
        }),
        retryOnFailure: true,
        maxRetries: 2,
        retryDelaySeconds: 1,
        timeoutSeconds: 10,
      },
      context: {
        clientId: testClientId,
        triggerType: 'MANUAL',
        triggerData: {},
        userId: authToken,
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Webhook call successful');
    console.log(`   Status: ${result.data.statusCode}`);
    console.log(`   Attempts: ${result.data.attempt}`);
    console.log(`   Retries: ${result.data.retries}`);
    console.log(`   Response: ${result.data.responseBody.substring(0, 200)}...`);
  } else {
    console.log('❌ Webhook call failed');
    console.log(`   Error: ${result.message}`);
    if (result.data) {
      console.log(`   Last response: ${JSON.stringify(result.data.lastResponse)}`);
    }
  }

  return result;
}

/**
 * Test webhook with GET method
 */
async function testWebhookGet() {
  console.log('\n========================================');
  console.log('TEST 2: Webhook Call (GET)');
  console.log('========================================');

  const response = await fetch(`${API_URL}/api/workflows/test-action`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
        timeoutSeconds: 10,
      },
      context: {
        clientId: testClientId,
        triggerType: 'MANUAL',
        triggerData: {},
        userId: authToken,
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ GET webhook call successful');
    console.log(`   Status: ${result.data.statusCode}`);
    console.log(`   Response: ${result.data.responseBody.substring(0, 200)}...`);
  } else {
    console.log('❌ GET webhook call failed');
    console.log(`   Error: ${result.message}`);
  }

  return result;
}

/**
 * Test webhook with placeholder replacement
 */
async function testWebhookPlaceholders() {
  console.log('\n========================================');
  console.log('TEST 3: Webhook with Placeholder Replacement');
  console.log('========================================');

  const response = await fetch(`${API_URL}/api/workflows/test-action`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        bodyTemplate: JSON.stringify({
          client_name: '{{client_name}}',
          client_email: '{{client_email}}',
          client_status: '{{client_status}}',
          trigger_type: '{{trigger_type}}',
          date: '{{date}}',
          time: '{{time}}',
        }),
        timeoutSeconds: 10,
      },
      context: {
        clientId: testClientId,
        triggerType: 'CLIENT_CREATED',
        triggerData: {},
        userId: authToken,
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Webhook with placeholders successful');
    console.log(`   Status: ${result.data.statusCode}`);
    console.log(`   Response: ${result.data.responseBody.substring(0, 300)}...`);
  } else {
    console.log('❌ Webhook with placeholders failed');
    console.log(`   Error: ${result.message}`);
  }

  return result;
}

/**
 * Test webhook retry logic
 */
async function testWebhookRetry() {
  console.log('\n========================================');
  console.log('TEST 4: Webhook Retry Logic (Invalid URL)');
  console.log('========================================');

  const response = await fetch(`${API_URL}/api/workflows/test-action`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://this-domain-does-not-exist-12345.com/webhook',
        method: 'POST',
        retryOnFailure: true,
        maxRetries: 2,
        retryDelaySeconds: 1,
        timeoutSeconds: 5,
      },
      context: {
        clientId: testClientId,
        triggerType: 'MANUAL',
        triggerData: {},
        userId: authToken,
      },
    }),
  });

  const result = await response.json();

  if (!result.success) {
    console.log('✅ Webhook failed as expected (invalid domain)');
    console.log(`   Error: ${result.message}`);
    console.log(`   Attempts: ${result.data?.attempts}`);
    console.log(`   Max retries: ${result.data?.maxRetries}`);
  } else {
    console.log('❌ Webhook should have failed but succeeded');
  }

  return result;
}

/**
 * Test webhook validation (missing URL)
 */
async function testWebhookValidation() {
  console.log('\n========================================');
  console.log('TEST 5: Webhook Validation (Missing URL)');
  console.log('========================================');

  const response = await fetch(`${API_URL}/api/workflows/test-action`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        method: 'POST',
      },
      context: {
        clientId: testClientId,
        triggerType: 'MANUAL',
        triggerData: {},
        userId: authToken,
      },
    }),
  });

  const result = await response.json();

  if (!result.success && result.message.includes('URL is required')) {
    console.log('✅ Validation working correctly');
    console.log(`   Error: ${result.message}`);
  } else {
    console.log('❌ Validation not working');
    console.log(`   Result: ${JSON.stringify(result)}`);
  }

  return result;
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   Feature #291 - CALL_WEBHOOK Action Tests   ║');
    console.log('╚════════════════════════════════════════════════╝');

    // Setup
    await login();
    await getTestClient();

    // Run tests
    const results = [];

    results.push(await testCallWebhookAction());
    results.push(await testWebhookGet());
    results.push(await testWebhookPlaceholders());
    results.push(await testWebhookRetry());
    results.push(await testWebhookValidation());

    // Summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');

    const passed = results.filter((r, i) => {
      // Test 4 should fail (expected)
      if (i === 3) return !r.success;
      return r.success;
    }).length;

    console.log(`\nTotal Tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${results.length - passed}`);

    if (passed === results.length) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed');
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
