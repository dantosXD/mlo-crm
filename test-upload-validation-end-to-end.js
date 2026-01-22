/**
 * End-to-End Test for File Upload Validation (Feature #81)
 *
 * This script tests that .exe files and other dangerous file types
 * are rejected during document upload with appropriate error messages.
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_URL = 'http://localhost:3000';
const TEST_EMAIL = 'admin@mlodash.com';
const TEST_PASSWORD = 'Admin123!';

// Test configuration
const tests = [];

// Helper function to make HTTP requests
function makeRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

// Test 1: Login to get access token
async function testLogin() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Login to get access token');
  console.log('='.repeat(80));

  try {
    const response = await makeRequest('POST', '/api/auth/login', JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }), {
      'Content-Type': 'application/json',
    });

    if (response.statusCode === 200 && response.body?.accessToken) {
      console.log('✓ Login successful');
      console.log(`  Access token: ${response.body.accessToken.substring(0, 20)}...`);
      return response.body.accessToken;
    } else {
      console.log('❌ Login failed');
      console.log(`  Status: ${response.statusCode}`);
      console.log(`  Response:`, response.body);
      return null;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return null;
  }
}

// Test 2: Try to upload a .exe file (should be rejected)
async function testExeUpload(accessToken) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Upload .exe file (should be rejected)');
  console.log('='.repeat(80));

  if (!accessToken) {
    console.log('⊘ Skipped (no access token)');
    return false;
  }

  try {
    // Create a temporary .exe file
    const tempExePath = path.join(__dirname, 'temp-test.exe');
    fs.writeFileSync(tempExePath, 'MZ\x90\x00fake executable content');

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(tempExePath), 'test.exe');
    form.append('clientId', 'test-client-id');
    form.append('name', 'Test Executable');
    form.append('category', 'OTHER');

    // Get form data headers
    const headers = form.getHeaders();
    headers['Authorization'] = `Bearer ${accessToken}`;

    // Make upload request
    const response = await new Promise((resolve, reject) => {
      const url = new URL('/api/documents/upload', API_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: headers,
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: body ? JSON.parse(body) : null,
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              body: body,
            });
          }
        });
      });

      req.on('error', reject);

      form.pipe(req);
    });

    // Clean up temp file
    fs.unlinkSync(tempExePath);

    // Check if upload was rejected
    if (response.statusCode === 400) {
      console.log('✓ .exe file rejected');
      console.log(`  Status: ${response.statusCode}`);
      console.log(`  Error:`, response.body?.error || response.body?.message || 'Unknown error');

      // Check for specific error message about file type
      const errorMsg = response.body?.message || response.body?.error || '';
      if (errorMsg.includes('File type not allowed') || errorMsg.includes('not allowed')) {
        console.log('  ✓ Error message mentions file type validation');

        if (errorMsg.includes('.exe') || errorMsg.includes('dangerous')) {
          console.log('  ✓ Error message mentions .exe or dangerous file types');
          return true;
        }
      }
    }

    console.log('❌ .exe file was NOT properly rejected');
    console.log(`  Status: ${response.statusCode}`);
    console.log(`  Response:`, response.body);
    return false;

  } catch (error) {
    console.log('❌ Upload test error:', error.message);
    return false;
  }
}

// Test 3: Verify error message contains allowed file types
async function testErrorMessageContent(accessToken) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Verify error message mentions allowed file types');
  console.log('='.repeat(80));

  if (!accessToken) {
    console.log('⊘ Skipped (no access token)');
    return false;
  }

  try {
    // Create a temporary .bat file
    const tempBatPath = path.join(__dirname, 'temp-test.bat');
    fs.writeFileSync(tempBatPath, '@echo off');

    const form = new FormData();
    form.append('file', fs.createReadStream(tempBatPath), 'test.bat');
    form.append('clientId', 'test-client-id');
    form.append('name', 'Test Batch');
    form.append('category', 'OTHER');

    const headers = form.getHeaders();
    headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await new Promise((resolve, reject) => {
      const url = new URL('/api/documents/upload', API_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: headers,
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: body ? JSON.parse(body) : null,
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              body: body,
            });
          }
        });
      });

      req.on('error', reject);
      form.pipe(req);
    });

    fs.unlinkSync(tempBatPath);

    if (response.statusCode === 400) {
      const errorMsg = response.body?.message || response.body?.error || '';

      // Check if error message mentions allowed types
      const mentionsAllowedTypes = errorMsg.includes('PDF') ||
                                   errorMsg.includes('images') ||
                                   errorMsg.includes('documents') ||
                                   errorMsg.includes('Allowed');

      if (mentionsAllowedTypes) {
        console.log('✓ Error message includes information about allowed file types');
        console.log(`  Message: ${errorMsg.substring(0, 100)}...`);
        return true;
      } else {
        console.log('⚠ Error message could be more helpful');
        console.log(`  Message: ${errorMsg}`);
      }
    }

    return false;

  } catch (error) {
    console.log('❌ Error message test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('FILE UPLOAD VALIDATION TEST SUITE (Feature #81)');
  console.log('='.repeat(80));
  console.log('\nTesting that dangerous file types (.exe, .bat, etc.) are rejected');
  console.log('with appropriate error messages during document upload.\n');

  const accessToken = await testLogin();
  const test2Result = await testExeUpload(accessToken);
  const test3Result = await testErrorMessageContent(accessToken);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Test 1 (Login): ${accessToken ? '✓ PASSED' : '⊘ SKIPPED'}`);
  console.log(`Test 2 (.exe Rejection): ${test2Result ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`Test 3 (Helpful Error Message): ${test3Result ? '✓ PASSED' : '❌ FAILED'}`);

  const allPassed = test2Result && test3Result;
  console.log('\n' + (allPassed ? '✓ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
  console.log('='.repeat(80) + '\n');
}

// Run the tests
runTests().catch(console.error);
