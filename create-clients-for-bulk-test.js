const http = require('http');

const API_URL = 'http://localhost:3001';

async function request(method, path, data = null, token = null) {
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
          const response = body ? JSON.parse(body) : {};
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

(async () => {
  try {
    // Login
    console.log('Logging in...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'test123',
    });

    const token = loginRes.data.accessToken;
    console.log('✅ Logged in');

    // Create test clients
    const clients = [
      { name: 'Bulk Test Client 1', email: 'bulk1@example.com', phone: '555-0001', status: 'LEAD' },
      { name: 'Bulk Test Client 2', email: 'bulk2@example.com', phone: '555-0002', status: 'LEAD' },
      { name: 'Bulk Test Client 3', email: 'bulk3@example.com', phone: '555-0003', status: 'LEAD' },
    ];

    for (const client of clients) {
      console.log(`Creating client: ${client.name}...`);
      const res = await request('POST', '/api/clients', client, token);
      if (res.status === 201 || res.status === 200) {
        console.log(`  ✅ Created: ${res.data.name}`);
      } else {
        console.log(`  ❌ Failed: ${res.status}`);
      }
    }

    console.log('\n✅ Test clients created successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
