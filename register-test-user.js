#!/usr/bin/env node

/**
 * Register test user for CSRF testing
 */

const http = require('http');

const API_URL = 'http://localhost:3000';

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function registerTestUser() {
  console.log('Registering test user for CSRF testing...');

  const testUser = {
    email: 'csrftest@example.com',
    password: 'Test1234!',
    name: 'CSRF Test User',
    role: 'MLO',
  };

  try {
    const response = await makeRequest('POST', '/api/auth/register', {}, testUser);

    if (response.statusCode === 201 || response.statusCode === 200) {
      console.log('✓ Test user registered successfully');
      console.log(`  - Email: ${testUser.email}`);
      console.log(`  - Password: ${testUser.password}`);
      console.log(`  - User ID: ${response.body?.user?.id || 'Unknown'}`);
    } else if (response.statusCode === 409) {
      console.log('✓ Test user already exists');
      console.log(`  - Email: ${testUser.email}`);
      console.log(`  - Password: ${testUser.password}`);
    } else {
      console.log('✗ Registration failed');
      console.log(`  Status: ${response.statusCode}`);
      console.log(`  Body: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

registerTestUser();
