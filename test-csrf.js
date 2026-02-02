#!/usr/bin/env node

/**
 * CSRF Protection Test Script
 * Tests Feature #16: CSRF protection on state-changing requests
 */

const http = require('http');
const crypto = require('crypto');

const API_URL = 'http://localhost:3000';
const sessionId = crypto.randomBytes(32).toString('hex'); // Consistent session ID for all requests
let authToken = null;
let csrfToken = null;

// Helper function to make HTTP requests
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
        'X-Session-ID': sessionId, // Send consistent session ID
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

async function testCsrfProtection() {
  console.log('='.repeat(60));
  console.log('CSRF Protection Test - Feature #16');
  console.log('='.repeat(60));

  // Step 1: Login successfully
  console.log('\n[Step 1] Testing login...');
  try {
    const loginResponse = await makeRequest('POST', '/api/auth/login', {}, {
      email: 'csrftest@example.com',
      password: 'Test1234',
    });

    if (loginResponse.statusCode === 200 || loginResponse.statusCode === 201) {
      authToken = loginResponse.body.accessToken || loginResponse.body.token;
      // sessionId is already set as a constant above

      // Check for CSRF token in response headers
      csrfToken = loginResponse.headers['x-csrf-token'];

      console.log('✓ Login successful');
      console.log(`  - Auth Token: ${authToken.substring(0, 20)}...`);
      console.log(`  - CSRF Token: ${csrfToken || 'NOT FOUND IN HEADERS'}`);
      console.log(`  - Session ID: ${sessionId}`);
    } else {
      console.log('✗ Login failed');
      console.log(`  Status: ${loginResponse.statusCode}`);
      console.log(`  Body: ${JSON.stringify(loginResponse.body)}`);
      return false;
    }
  } catch (error) {
    console.log('✗ Login error:', error);
    console.log('  Details:', JSON.stringify(error, null, 2));
    return false;
  }

  // Step 2: Get CSRF token from a GET request
  console.log('\n[Step 2] Getting CSRF token from GET request...');
  try {
    const getResponse = await makeRequest('GET', '/api/clients', {
      'Authorization': `Bearer ${authToken}`,
    });

    csrfToken = getResponse.headers['x-csrf-token'];
    console.log(`✓ GET request successful (Status: ${getResponse.statusCode})`);
    console.log(`  - CSRF Token in headers: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'NOT FOUND'}`);
    console.log(`  - All response headers:`, JSON.stringify(getResponse.headers, null, 2));

    if (!csrfToken) {
      console.log('  ! WARNING: CSRF token not found in response headers');
    }
  } catch (error) {
    console.log('✗ GET request error:', error.message);
  }

  // Step 3: Attempt POST request WITHOUT CSRF token
  console.log('\n[Step 3] Testing POST request WITHOUT CSRF token...');
  try {
    const postResponse = await makeRequest('POST', '/api/clients', {
      'Authorization': `Bearer ${authToken}`,
      // Deliberately NOT including X-CSRF-Token header
    }, {
      name: 'Test Client',
      email: 'test@example.com',
      phone: '555-1234',
      status: 'Lead',
    });

    if (postResponse.statusCode === 403) {
      console.log('✓ Request correctly REJECTED with 403 Forbidden');
      console.log(`  - Error: ${postResponse.body?.error || 'Unknown'}`);
      console.log(`  - Message: ${postResponse.body?.message || 'No message'}`);

      if (postResponse.body?.message?.toLowerCase().includes('csrf')) {
        console.log('  ✓ Error message mentions CSRF token requirement');
      }
    } else {
      console.log(`✗ Request ACCEPTED (should have been rejected!)`);
      console.log(`  - Status: ${postResponse.statusCode}`);
      console.log(`  - Body: ${JSON.stringify(postResponse.body)}`);
    }
  } catch (error) {
    console.log('✗ POST request error:', error.message);
  }

  // Step 4: Attempt POST request WITH invalid CSRF token
  console.log('\n[Step 4] Testing POST request with INVALID CSRF token...');
  try {
    const postResponse = await makeRequest('POST', '/api/clients', {
      'Authorization': `Bearer ${authToken}`,
      'X-CSRF-Token': 'invalid-token-12345',
    }, {
      name: 'Test Client',
      email: 'test@example.com',
      phone: '555-1234',
      status: 'Lead',
    });

    if (postResponse.statusCode === 403) {
      console.log('✓ Request correctly REJECTED with 403 Forbidden');
      console.log(`  - Error: ${postResponse.body?.error || 'Unknown'}`);
      console.log(`  - Message: ${postResponse.body?.message || 'No message'}`);
    } else {
      console.log(`✗ Request ACCEPTED (should have been rejected!)`);
      console.log(`  - Status: ${postResponse.statusCode}`);
    }
  } catch (error) {
    console.log('✗ POST request error:', error.message);
  }

  // Step 5: Attempt POST request WITH valid CSRF token
  console.log('\n[Step 5] Testing POST request WITH valid CSRF token...');
  if (!csrfToken) {
    console.log('✗ Cannot test - no CSRF token available');
    console.log('  This indicates CSRF token generation is not working properly');
    return false;
  }

  try {
    const postResponse = await makeRequest('POST', '/api/clients', {
      'Authorization': `Bearer ${authToken}`,
      'X-CSRF-Token': csrfToken,
    }, {
      name: 'CSRF Test Client',
      email: 'csrftest@example.com',
      phone: '555-9999',
      status: 'Lead',
    });

    if (postResponse.statusCode === 201 || postResponse.statusCode === 200) {
      console.log('✓ Request ACCEPTED with valid CSRF token');
      console.log(`  - Status: ${postResponse.statusCode}`);
      console.log(`  - Client created: ${postResponse.body?.id || 'Unknown'}`);

      // Cleanup: Delete the test client
      if (postResponse.body?.id) {
        console.log(`\n[Cleanup] Deleting test client ${postResponse.body.id}...`);
        await makeRequest('DELETE', `/api/clients/${postResponse.body.id}`, {
          'Authorization': `Bearer ${authToken}`,
          'X-CSRF-Token': csrfToken,
        });
        console.log('✓ Test client deleted');
      }
    } else {
      console.log(`? Request returned status ${postResponse.statusCode}`);
      console.log(`  - Body: ${JSON.stringify(postResponse.body)}`);
    }
  } catch (error) {
    console.log('✗ POST request error:', error.message);
  }

  // Step 6: Test GET request without CSRF (should work)
  console.log('\n[Step 6] Testing GET request WITHOUT CSRF token...');
  try {
    const getResponse = await makeRequest('GET', '/api/clients', {
      'Authorization': `Bearer ${authToken}`,
      // No CSRF token
    });

    if (getResponse.statusCode === 200) {
      console.log('✓ GET request allowed without CSRF token (correct behavior)');
      console.log(`  - Status: ${getResponse.statusCode}`);
    } else {
      console.log(`? GET request returned ${getResponse.statusCode}`);
    }
  } catch (error) {
    console.log('✗ GET request error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('CSRF Protection Test Complete');
  console.log('='.repeat(60));

  return true;
}

// Run the test
testCsrfProtection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
