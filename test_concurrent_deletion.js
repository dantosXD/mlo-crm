// Test script for concurrent client deletion
// This simulates User A viewing/editing while User B deletes the client

const API_URL = 'http://localhost:3000/api';

// Need to get a valid token first
async function loginAndGetToken() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testuser@example.com',
      password: 'password123'
    })
  });

  const data = await response.json();
  if (data.token) {
    return data.token;
  }
  throw new Error('Login failed');
}

async function createTestClient(token) {
  const response = await fetch(`${API_URL}/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'CONCURRENT_TEST_CLIENT',
      email: 'concurrent@test.com',
      phone: '555-1234',
      status: 'LEAD'
    })
  });

  const data = await response.json();
  if (data.id) {
    return data;
  }
  throw new Error('Failed to create client');
}

async function testConcurrentDeletion() {
  console.log('Starting concurrent deletion test...');

  // Step 1: Login and create a test client
  const token = await loginAndGetToken();
  console.log('✓ Logged in successfully');

  const client = await createTestClient(token);
  console.log(`✓ Created test client with ID: ${client.id}`);

  // Step 2: Simulate User A viewing the client (fetch)
  console.log('\nStep 1: User A views client details...');
  const viewResponse = await fetch(`${API_URL}/clients/${client.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (viewResponse.status === 200) {
    const viewedClient = await viewResponse.json();
    console.log(`✓ User A is viewing client: ${viewedClient.name}`);
  }

  // Step 3: Simulate User B deleting the client
  console.log('\nStep 2: User B deletes the client...');
  const deleteResponse = await fetch(`${API_URL}/clients/${client.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (deleteResponse.status === 200 || deleteResponse.status === 204) {
    console.log('✓ User B successfully deleted the client');
  }

  // Step 4: Simulate User A trying to edit the deleted client
  console.log('\nStep 3: User A tries to edit the deleted client...');
  const editResponse = await fetch(`${API_URL}/clients/${client.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'EDITED_NAME',
      email: 'concurrent@test.com',
      phone: '555-1234',
      status: 'ACTIVE'
    })
  });

  console.log(`Edit response status: ${editResponse.status}`);

  if (editResponse.status === 404) {
    console.log('✓ Step 4: Got 404 error as expected - graceful handling!');
    console.log('✓ Step 5: No crash or data corruption - test PASSED!');
    return true;
  } else {
    console.log('✗ Did not get 404 error - test FAILED');
    return false;
  }
}

// Run the test
testConcurrentDeletion()
  .then(success => {
    console.log('\n' + '='.repeat(50));
    console.log(`Test result: ${success ? 'PASSED ✓' : 'FAILED ✗'}`);
    console.log('='.repeat(50));
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
