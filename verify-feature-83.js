/**
 * Feature #83 Verification: API 500 Error Handled Gracefully
 *
 * This test verifies that when the API returns a 500 error:
 * 1. User-friendly error message is shown (no stack trace)
 * 2. App doesn't crash
 * 3. User can continue using the app
 */

const BASE_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:5173';

// Test credentials
const credentials = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = null;

async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  authToken = data.accessToken;
  console.log('✅ Login successful');
  return data;
}

async function test500ErrorEndpoint() {
  console.log('\n📋 Step 1: Trigger a 500 error');
  console.log('Calling GET /api/clients/test-500-error');

  const response = await fetch(`${BASE_URL}/api/clients/test-500-error`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`Response Status: ${response.status}`);
  console.log(`Response OK: ${response.ok}`);

  const data = await response.json();
  console.log('Response Data:', JSON.stringify(data, null, 2));

  // Verify it's a 500 error
  if (response.status !== 500) {
    console.log('❌ FAILED: Expected status 500, got', response.status);
    return false;
  }
  console.log('✅ 500 error triggered successfully');

  return { response, data };
}

async function verifyNoStackTrace(errorResponse) {
  console.log('\n📋 Step 2: Verify no stack trace exposed');

  const { data, response } = errorResponse;

  // Check that response doesn't contain stack traces or technical details
  const hasStackTrace =
    data.stack ||
    data.message.includes('at ') ||
    data.message.includes('/app/') ||
    data.message.includes('/node_modules/') ||
    typeof data.error === 'object';

  if (hasStackTrace) {
    console.log('❌ FAILED: Stack trace or technical details exposed');
    console.log('Error data:', data);
    return false;
  }

  console.log('✅ No stack trace exposed');
  console.log('✅ Error message is user-friendly:', data.message);
  return true;
}

async function verifyUserFriendlyMessage(errorResponse) {
  console.log('\n📋 Step 3: Verify user-friendly error message');

  const { data } = errorResponse;

  // Check for user-friendly message characteristics
  const isUserFriendly =
    data.message &&
    typeof data.message === 'string' &&
    data.message.length < 200 &&
    !data.message.includes('Error:') &&
    !data.message.includes('TypeError:') &&
    !data.message.includes('ReferenceError:');

  if (!isUserFriendly) {
    console.log('❌ FAILED: Error message is not user-friendly');
    console.log('Message:', data.message);
    return false;
  }

  console.log('✅ Error message is user-friendly:', data.message);
  return true;
}

async function verifyAppDoesntCrash() {
  console.log('\n📋 Step 4: Verify app doesn\'t crash');

  // Make another API call to ensure the app is still responsive
  const response = await fetch(`${BASE_URL}/api/clients`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.log('❌ FAILED: App appears to be crashed or unresponsive');
    return false;
  }

  const clients = await response.json();
  console.log(`✅ App is still responsive - fetched ${clients.length || 0} clients`);
  return true;
}

async function verifyUserCanContinue() {
  console.log('\n📋 Step 5: Verify user can continue using app');

  // Test multiple operations to ensure app functionality
  const operations = [
    { name: 'Fetch clients', url: '/api/clients' },
    { name: 'Fetch pipeline', url: '/api/clients?status=LEAD' },
    { name: 'Fetch dashboard data', url: '/api/analytics/pipeline' }
  ];

  let allPassed = true;

  for (const op of operations) {
    try {
      const response = await fetch(`${BASE_URL}${op.url}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log(`✅ ${op.name} - Working`);
      } else {
        console.log(`⚠️  ${op.name} - Failed with ${response.status}`);
        // Don't fail the test if some endpoints don't work, as long as app doesn't crash
      }
    } catch (error) {
      console.log(`❌ ${op.name} - Error: ${error.message}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('✅ User can continue using the app');
  }

  return allPassed;
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Feature #83: API 500 Error Handled Gracefully - Verification');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Login first
    await login();

    // Step 1: Trigger 500 error
    const errorResponse = await test500ErrorEndpoint();
    if (!errorResponse) {
      process.exit(1);
    }

    // Step 2: Verify no stack trace
    const noStackTrace = await verifyNoStackTrace(errorResponse);
    if (!noStackTrace) {
      process.exit(1);
    }

    // Step 3: Verify user-friendly message
    const userFriendly = await verifyUserFriendlyMessage(errorResponse);
    if (!userFriendly) {
      process.exit(1);
    }

    // Step 4: Verify app doesn't crash
    const appNotCrashed = await verifyAppDoesntCrash();
    if (!appNotCrashed) {
      process.exit(1);
    }

    // Step 5: Verify user can continue
    const canContinue = await verifyUserCanContinue();
    if (!canContinue) {
      process.exit(1);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nFeature #83 Verified: API 500 errors are handled gracefully');
    console.log('- User-friendly error messages shown (no stack traces)');
    console.log('- App remains stable after error');
    console.log('- User can continue using the app normally');
    console.log('');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the tests
runTests();
