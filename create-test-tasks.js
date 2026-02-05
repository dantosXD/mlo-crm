// Create test tasks for Feature #319
const http = require('http');

const API_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test123';

let csrfToken = null;

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

    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      options.headers['X-CSRF-Token'] = csrfToken;
    }

    const req = http.request(options, (res) => {
      // Capture CSRF token from response headers
      const returnedCsrf = res.headers['x-csrf-token'];
      if (returnedCsrf) {
        csrfToken = returnedCsrf;
      }

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

async function createTestTasks() {
  console.log('Creating test tasks...');

  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const token = loginResponse.data.accessToken;

  // Get a client to assign tasks to
  const clientsResponse = await makeRequest('GET', '/api/clients', null, token);
  const clientId = clientsResponse.data.clients?.[0]?.id;

  if (!clientId) {
    console.log('No clients found. Creating a test client first...');
    const createClientResponse = await makeRequest('POST', '/api/clients', {
      name: 'Test Client for Tasks',
      email: 'tasktest@example.com',
      phone: '555-0101',
      status: 'LEAD',
    }, token);

    if (createClientResponse.status === 201) {
      console.log('✓ Test client created');
    } else {
      console.log('✗ Failed to create client:', createClientResponse.data);
      return;
    }
  }

  const tasksToCreate = [
    {
      text: 'Complete loan application',
      description: 'Finish processing the mortgage application',
      priority: 'HIGH',
      status: 'TODO',
      dueDate: new Date().toISOString(),
    },
    {
      text: 'Review documents',
      description: 'Check all uploaded documents for completeness',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    },
    {
      text: 'Schedule appraisal',
      description: 'Contact appraisal company',
      priority: 'LOW',
      status: 'TODO',
      dueDate: new Date(Date.now() + 172800000).toISOString(), // In 2 days
    },
    {
      text: 'Overdue task test',
      description: 'This task is overdue',
      priority: 'URGENT',
      status: 'TODO',
      dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    },
    {
      text: 'Completed task test',
      description: 'This task is already done',
      priority: 'MEDIUM',
      status: 'COMPLETE',
      dueDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    },
  ];

  let created = 0;
  for (const task of tasksToCreate) {
    const response = await makeRequest('POST', '/api/tasks', {
      ...task,
      clientId,
    }, token);

    if (response.status === 201) {
      created++;
      console.log(`✓ Created task: ${task.text}`);
    } else {
      console.log(`✗ Failed to create task: ${task.text}`);
    }
  }

  console.log(`\n✓ Created ${created}/${tasksToCreate.length} test tasks`);
}

createTestTasks().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
