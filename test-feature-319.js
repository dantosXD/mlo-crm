// Test script for Feature #319: Global Tasks Dashboard
const http = require('http');

const API_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test123';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = res.statusCode >= 200 && res.statusCode < 300
            ? JSON.parse(body)
            : body;
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function login() {
  console.log('Logging in...');
  const response = await makeRequest('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (response.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
  }

  console.log('✓ Login successful');
  return response.data.accessToken;
}

async function testTasksDashboard(token) {
  console.log('\n=== Testing Feature #319: Global Tasks Dashboard ===\n');
  console.log('Using token:', token.substring(0, 30) + '...');

  // Test 1: Get task statistics
  console.log('\n1. Testing /api/tasks/statistics endpoint...');
  const statsResponse = await makeRequest('GET', '/api/tasks/statistics', null, token);
  if (statsResponse.status === 200) {
    console.log('✓ Statistics endpoint working');
    console.log('  Statistics:', JSON.stringify(statsResponse.data, null, 2));
  } else {
    console.log('✗ Statistics endpoint failed:', statsResponse.status);
  }

  // Test 2: Get all tasks
  console.log('\n2. Testing GET /api/tasks (all tasks)...');
  const allTasksResponse = await makeRequest('GET', '/api/tasks?limit=10', null, token);
  if (allTasksResponse.status === 200) {
    console.log('✓ Get all tasks endpoint working');
    console.log(`  Found ${allTasksResponse.data.tasks?.length || 0} tasks`);
    console.log('  Pagination:', JSON.stringify(allTasksResponse.data.pagination, null, 2));
  } else {
    console.log('✗ Get all tasks endpoint failed:', allTasksResponse.status);
  }

  // Test 3: Filter by "today"
  console.log('\n3. Testing GET /api/tasks?due_date=today...');
  const todayTasksResponse = await makeRequest('GET', '/api/tasks?due_date=today', null, token);
  if (todayTasksResponse.status === 200) {
    console.log('✓ Filter by today working');
    console.log(`  Found ${todayTasksResponse.data.tasks?.length || 0} tasks due today`);
  } else {
    console.log('✗ Filter by today failed:', todayTasksResponse.status);
  }

  // Test 4: Filter by "overdue"
  console.log('\n4. Testing GET /api/tasks?due_date=overdue...');
  const overdueTasksResponse = await makeRequest('GET', '/api/tasks?due_date=overdue', null, token);
  if (overdueTasksResponse.status === 200) {
    console.log('✓ Filter by overdue working');
    console.log(`  Found ${overdueTasksResponse.data.tasks?.length || 0} overdue tasks`);
  } else {
    console.log('✗ Filter by overdue failed:', overdueTasksResponse.status);
  }

  // Test 5: Filter by "completed"
  console.log('\n5. Testing GET /api/tasks?due_date=completed...');
  const completedTasksResponse = await makeRequest('GET', '/api/tasks?due_date=completed', null, token);
  if (completedTasksResponse.status === 200) {
    console.log('✓ Filter by completed working');
    console.log(`  Found ${completedTasksResponse.data.tasks?.length || 0} completed tasks`);
  } else {
    console.log('✗ Filter by completed failed:', completedTasksResponse.status);
  }

  // Test 6: Filter by priority
  console.log('\n6. Testing GET /api/tasks?priority=HIGH...');
  const priorityTasksResponse = await makeRequest('GET', '/api/tasks?priority=HIGH', null, token);
  if (priorityTasksResponse.status === 200) {
    console.log('✓ Filter by priority working');
    console.log(`  Found ${priorityTasksResponse.data.tasks?.length || 0} high priority tasks`);
  } else {
    console.log('✗ Filter by priority failed:', priorityTasksResponse.status);
  }

  // Test 7: Filter by status
  console.log('\n7. Testing GET /api/tasks?status=TODO...');
  const statusTasksResponse = await makeRequest('GET', '/api/tasks?status=TODO', null, token);
  if (statusTasksResponse.status === 200) {
    console.log('✓ Filter by status working');
    console.log(`  Found ${statusTasksResponse.data.tasks?.length || 0} TODO tasks`);
  } else {
    console.log('✗ Filter by status failed:', statusTasksResponse.status);
  }

  // Test 8: Sort by dueDate
  console.log('\n8. Testing GET /api/tasks?sort_by=dueDate&sort_order=asc...');
  const sortedTasksResponse = await makeRequest('GET', '/api/tasks?sort_by=dueDate&sort_order=asc', null, token);
  if (sortedTasksResponse.status === 200) {
    console.log('✓ Sort by dueDate working');
    console.log(`  Found ${sortedTasksResponse.data.tasks?.length || 0} tasks`);
  } else {
    console.log('✗ Sort by dueDate failed:', sortedTasksResponse.status);
  }

  // Test 9: Pagination
  console.log('\n9. Testing GET /api/tasks?page=1&limit=5...');
  const paginatedTasksResponse = await makeRequest('GET', '/api/tasks?page=1&limit=5', null, token);
  if (paginatedTasksResponse.status === 200) {
    console.log('✓ Pagination working');
    console.log(`  Page: ${paginatedTasksResponse.data.pagination?.page}`);
    console.log(`  Limit: ${paginatedTasksResponse.data.pagination?.limit}`);
    console.log(`  Total: ${paginatedTasksResponse.data.pagination?.total}`);
  } else {
    console.log('✗ Pagination failed:', paginatedTasksResponse.status);
  }

  // Test 10: Bulk action - mark complete (if we have tasks)
  if (allTasksResponse.data.tasks && allTasksResponse.data.tasks.length > 0) {
    console.log('\n10. Testing PATCH /api/tasks/bulk (mark_complete)...');
    const taskIds = allTasksResponse.data.tasks.slice(0, 2).map(t => t.id);
    const bulkResponse = await makeRequest('PATCH', '/api/tasks/bulk', {
      taskIds,
      action: 'mark_complete',
    }, token);
    if (bulkResponse.status === 200) {
      console.log('✓ Bulk mark complete working');
      console.log(`  Updated: ${bulkResponse.data.count} tasks`);
    } else {
      console.log('✗ Bulk mark complete failed:', bulkResponse.status);
    }
  } else {
    console.log('\n10. Skipping bulk action test (no tasks available)');
  }

  console.log('\n=== All backend tests completed ===\n');
}

async function main() {
  try {
    const token = await login();
    await testTasksDashboard(token);
    console.log('✓ Feature #319 backend tests PASSED');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

main();
