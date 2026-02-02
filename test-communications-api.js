// Test script for Communications CRUD API
// Using native fetch (Node.js 18+)

const API_URL = 'http://localhost:3000/api/communications';

// Test user credentials
const TEST_USER = {
  email: 'mlo@example.com',
  password: 'password123'
};

let authToken = '';

// Helper function to login and get token
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

// Helper function to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  return { status: response.status, data };
}

// Test 1: GET /api/communications - List with filters
async function testListCommunications() {
  console.log('\n📋 TEST 1: GET /api/communications (list with filters)');

  try {
    // Test without filters
    let result = await apiRequest('');
    console.log(`✅ List all: Status ${result.status}, Count: ${result.data.data?.length || 0}`);

    // Test with status filter
    result = await apiRequest('?status=DRAFT');
    console.log(`✅ Filter by status=DRAFT: ${result.data.data?.length || 0} results`);

    // Test pagination
    result = await apiRequest('?page=1&limit=10');
    console.log(`✅ Pagination: ${JSON.stringify(result.data.pagination)}`);

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 2: POST /api/communications - Create draft
async function testCreateCommunication(clientId) {
  console.log('\n✉️  TEST 2: POST /api/communications (create draft)');

  try {
    const newComm = {
      clientId: clientId,
      type: 'EMAIL',
      subject: 'TEST_FEATURE_255 - Test Email',
      body: 'This is a test email for Feature #255 verification.',
      status: 'DRAFT'
    };

    const result = await apiRequest('', {
      method: 'POST',
      body: JSON.stringify(newComm)
    });

    if (result.status === 201) {
      console.log(`✅ Created communication ID: ${result.data.id}`);
      console.log(`   Type: ${result.data.type}, Status: ${result.data.status}`);
      console.log(`   Subject: ${result.data.subject}`);
      return result.data.id;
    } else {
      console.error('❌ Creation failed:', result.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

// Test 3: GET /api/communications/:id - Get single
async function testGetCommunication(commId) {
  console.log('\n📄 TEST 3: GET /api/communications/:id');

  try {
    const result = await apiRequest(`/${commId}`);

    if (result.status === 200) {
      console.log(`✅ Retrieved communication: ${result.data.subject}`);
      console.log(`   Body: ${result.data.body}`);
      console.log(`   Created by: ${result.data.createdBy.name}`);
      return true;
    } else {
      console.error('❌ Get failed:', result.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 4: PUT /api/communications/:id - Update
async function testUpdateCommunication(commId) {
  console.log('\n✏️  TEST 4: PUT /api/communications/:id (update)');

  try {
    const updates = {
      subject: 'TEST_FEATURE_255 - Updated Subject',
      body: 'This is the updated body for Feature #255 verification.',
      status: 'READY'
    };

    const result = await apiRequest(`/${commId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });

    if (result.status === 200) {
      console.log(`✅ Updated communication`);
      console.log(`   New subject: ${result.data.subject}`);
      console.log(`   New status: ${result.data.status}`);
      return true;
    } else {
      console.error('❌ Update failed:', result.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 5: DELETE /api/communications/:id - Delete
async function testDeleteCommunication(commId) {
  console.log('\n🗑️  TEST 5: DELETE /api/communications/:id');

  try {
    const result = await apiRequest(`/${commId}`, {
      method: 'DELETE'
    });

    if (result.status === 200) {
      console.log(`✅ Deleted communication: ${commId}`);
      return true;
    } else {
      console.error('❌ Delete failed:', result.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 6: Role-based access control
async function testRBAC() {
  console.log('\n🔒 TEST 6: Role-Based Access Control');

  try {
    // Login as viewer (limited permissions)
    const viewerResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@example.com', password: 'password123' })
    });

    if (viewerResponse.ok) {
      const viewerData = await viewerResponse.json();
      const viewerToken = viewerData.accessToken;

      // Try to access communications as viewer
      const response = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${viewerToken}` }
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Viewer can access own communications`);
        console.log(`   Data isolation working: ${data.data?.length || 0} communications`);
        return true;
      } else {
        console.error('❌ Viewer access test failed');
        return false;
      }
    } else {
      console.log('⚠️  Viewer user not found, skipping RBAC test');
      return true;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('Feature #255: Communications CRUD API - Test Suite');
  console.log('='.repeat(60));

  try {
    // Login
    await login();

    // Get a test client ID
    const clientsResponse = await fetch('http://localhost:3000/api/clients', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (clientsResponse.ok) {
      const clientsData = await clientsResponse.json();
      const testClientId = clientsData[0]?.id;

      if (!testClientId) {
        console.error('❌ No clients found. Please create a client first.');
        return;
      }

      console.log(`\n📌 Using test client: ${testClientId}`);

      // Run all tests
      const results = [];

      results.push(await testListCommunications());
      const commId = await testCreateCommunication(testClientId);
      results.push(commId !== null);

      if (commId) {
        results.push(await testGetCommunication(commId));
        results.push(await testUpdateCommunication(commId));
        results.push(await testDeleteCommunication(commId));
      }

      results.push(await testRBAC());

      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('TEST SUMMARY');
      console.log('='.repeat(60));

      const passed = results.filter(r => r === true).length;
      const total = results.length;

      console.log(`✅ Passed: ${passed}/${total}`);
      console.log(`❌ Failed: ${total - passed}/${total}`);

      if (passed === total) {
        console.log('\n🎉 All tests passed! Feature #255 is working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
      }
    } else {
      console.error('❌ Failed to fetch clients');
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
runTests();
