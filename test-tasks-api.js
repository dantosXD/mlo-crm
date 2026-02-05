// Test tasks API
const API_URL = 'http://localhost:3000';

async function testTasksAPI() {
  // Login
  console.log('Logging in...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@mlo.com',
      password: 'test123',
    }),
  });

  if (!loginResponse.ok) {
    console.log('❌ Login failed');
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.accessToken;
  console.log('✅ Logged in');

  // Test tasks list
  console.log('\nFetching tasks...');
  const tasksResponse = await fetch(`${API_URL}/api/tasks?page=1&limit=50`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('Status:', tasksResponse.status);
  if (tasksResponse.ok) {
    const tasksData = await tasksResponse.json();
    console.log('✅ Tasks fetched successfully');
    console.log('Task count:', tasksData.tasks?.length || 0);
    console.log('Pagination:', tasksData.pagination);
  } else {
    const error = await tasksResponse.json();
    console.log('❌ Failed to fetch tasks');
    console.log('Error:', error);
  }

  // Test statistics
  console.log('\nFetching statistics...');
  const statsResponse = await fetch(`${API_URL}/api/tasks/statistics`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('Status:', statsResponse.status);
  if (statsResponse.ok) {
    const stats = await statsResponse.json();
    console.log('✅ Statistics fetched successfully');
    console.log('Statistics:', stats);
  } else {
    const error = await statsResponse.json();
    console.log('❌ Failed to fetch statistics');
    console.log('Error:', error);
  }
}

testTasksAPI().catch(console.error);
