/**
 * Feature #282 - Condition Evaluator for Client Conditions - Comprehensive Test
 *
 * Tests all condition types:
 * 1. client_status_equals
 * 2. client_has_tag
 * 3. client_age_days (greater/less than)
 * 4. client_missing_documents
 * 5. AND/OR logic between conditions
 */

const TEST_USER = {
  email: 'mlo@example.com',
  password: 'password123'
};

let authToken = null;
let testClientId = null;
const API_URL = (process.env.API_URL || 'http://localhost:3002').replace(/\/$/, '');
let csrfToken = null;
let sessionCookie = null;

function syncCsrfState(res) {
  const headerToken = res.headers.get('X-CSRF-Token');
  if (headerToken) {
    csrfToken = headerToken;
  }

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
}

// Login
async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(TEST_USER)
  });
  syncCsrfState(res);
  const data = await res.json();
  authToken = data.accessToken;
  return authToken;
}

// Get or create client
async function getTestClient() {
  // Try to get the tagged client we just created
  const res = await fetch(`${API_URL}/api/clients`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      ...(sessionCookie ? { Cookie: sessionCookie } : {})
    }
  });
  syncCsrfState(res);
  const clients = await res.json();

  if (Array.isArray(clients)) {
    // Look for the tagged client
    const taggedClient = clients.find(c => c.email === 'tagged@example.com');
    if (taggedClient) {
      return taggedClient.id;
    }

    // Otherwise use any client
    if (clients.length > 0) {
      return clients[0].id;
    }
  }

  // Create test client
  const createRes = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(sessionCookie ? { Cookie: sessionCookie } : {})
    },
    body: JSON.stringify({
      name: 'Condition Test Client',
      email: 'condition-test@example.com',
      phone: '555-7777',
      status: 'LEAD',
      tags: JSON.stringify(['test-tag', 'priority'])
    })
  });
  syncCsrfState(createRes);
  const client = await createRes.json();
  return client.id;
}

// Test condition evaluation
async function testCondition(conditions, clientId) {
  const res = await fetch(`${API_URL}/api/workflows/test-condition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(sessionCookie ? { Cookie: sessionCookie } : {})
    },
    body: JSON.stringify({ conditions, clientId })
  });
  syncCsrfState(res);
  return await res.json();
}

console.log('╔════════════════════════════════════════════════╗');
console.log('║   Feature #282 - Condition Evaluator Tests  ║');
console.log('╚════════════════════════════════════════════════╝');

(async () => {
  try {
    await login();
    testClientId = await getTestClient();
    console.log(`\n📋 Using Client ID: ${testClientId}\n`);

    const results = [];

    // Test 1: CLIENT_STATUS_EQUALS (matching)
    console.log('TEST 1: CLIENT_STATUS_EQUALS (Match)');
    console.log('--------------------------------------');
    const test1 = await testCondition({
      type: 'CLIENT_STATUS_EQUALS',
      value: 'LEAD'
    }, testClientId);
    results.push({name: 'Status equals (match)', passed: test1.matched === true, data: test1});
    console.log(test1.matched ? '✅ PASS' : '❌ FAIL', test1.message);
    console.log();

    // Test 2: CLIENT_STATUS_EQUALS (not matching)
    console.log('TEST 2: CLIENT_STATUS_EQUALS (No Match)');
    console.log('--------------------------------------');
    const test2 = await testCondition({
      type: 'CLIENT_STATUS_EQUALS',
      value: 'CLOSED'
    }, testClientId);
    results.push({name: 'Status equals (no match)', passed: test2.matched === false, data: test2});
    console.log(!test2.matched ? '✅ PASS' : '❌ FAIL', test2.message);
    console.log();

    // Test 3: CLIENT_HAS_TAG (matching)
    console.log('TEST 3: CLIENT_HAS_TAG (Match)');
    console.log('--------------------------------------');
    const test3 = await testCondition({
      type: 'CLIENT_HAS_TAG',
      value: 'test-tag'
    }, testClientId);
    results.push({name: 'Has tag (match)', passed: test3.matched === true, data: test3});
    console.log(test3.matched ? '✅ PASS' : '❌ FAIL', test3.message);
    console.log();

    // Test 4: CLIENT_HAS_TAG (not matching)
    console.log('TEST 4: CLIENT_HAS_TAG (No Match)');
    console.log('--------------------------------------');
    const test4 = await testCondition({
      type: 'CLIENT_HAS_TAG',
      value: 'non-existent-tag'
    }, testClientId);
    results.push({name: 'Has tag (no match)', passed: test4.matched === false, data: test4});
    console.log(!test4.matched ? '✅ PASS' : '❌ FAIL', test4.message);
    console.log();

    // Test 5: CLIENT_AGE_DAYS (greater than or equal)
    console.log('TEST 5: CLIENT_AGE_DAYS (Greater Than or Equal)');
    console.log('--------------------------------------');
    const test5 = await testCondition({
      type: 'CLIENT_AGE_DAYS',
      operator: 'greater_than_or_equal',
      value: 0 // Should always be >= 0 days
    }, testClientId);
    results.push({name: 'Age >= 0 days', passed: test5.matched === true, data: test5});
    console.log(test5.matched ? '✅ PASS' : '❌ FAIL', test5.message);
    console.log();

    // Test 6: CLIENT_AGE_DAYS (less than)
    console.log('TEST 6: CLIENT_AGE_DAYS (Less Than)');
    console.log('--------------------------------------');
    const test6 = await testCondition({
      type: 'CLIENT_AGE_DAYS',
      operator: 'less_than',
      value: 36500 // Should be less than 100 years
    }, testClientId);
    results.push({name: 'Age < 36500 days', passed: test6.matched === true, data: test6});
    console.log(test6.matched ? '✅ PASS' : '❌ FAIL', test6.message);
    console.log();

    // Test 7: CLIENT_MISSING_DOCUMENTS (has missing)
    console.log('TEST 7: CLIENT_MISSING_DOCUMENTS');
    console.log('--------------------------------------');
    const test7 = await testCondition({
      type: 'CLIENT_MISSING_DOCUMENTS'
    }, testClientId);
    results.push({name: 'Missing documents', passed: test7.success === true, data: test7});
    console.log(test7.success ? '✅ PASS' : '❌ FAIL', test7.message);
    console.log();

    // Test 8: AND condition (both match)
    console.log('TEST 8: AND Condition (Both Match)');
    console.log('--------------------------------------');
    const test8 = await testCondition({
      type: 'AND',
      conditions: [
        { type: 'CLIENT_STATUS_EQUALS', value: 'LEAD' },
        { type: 'CLIENT_HAS_TAG', value: 'test-tag' }
      ]
    }, testClientId);
    results.push({name: 'AND (both match)', passed: test8.matched === true, data: test8});
    console.log(test8.matched ? '✅ PASS' : '❌ FAIL', test8.message);
    console.log();

    // Test 9: AND condition (one fails)
    console.log('TEST 9: AND Condition (One Fails)');
    console.log('--------------------------------------');
    const test9 = await testCondition({
      type: 'AND',
      conditions: [
        { type: 'CLIENT_STATUS_EQUALS', value: 'LEAD' },
        { type: 'CLIENT_HAS_TAG', value: 'non-existent' }
      ]
    }, testClientId);
    results.push({name: 'AND (one fails)', passed: test9.matched === false, data: test9});
    console.log(!test9.matched ? '✅ PASS' : '❌ FAIL', test9.message);
    console.log();

    // Test 10: OR condition (one matches)
    console.log('TEST 10: OR Condition (One Matches)');
    console.log('--------------------------------------');
    const test10 = await testCondition({
      type: 'OR',
      conditions: [
        { type: 'CLIENT_STATUS_EQUALS', value: 'CLOSED' },
        { type: 'CLIENT_HAS_TAG', value: 'test-tag' }
      ]
    }, testClientId);
    results.push({name: 'OR (one matches)', passed: test10.matched === true, data: test10});
    console.log(test10.matched ? '✅ PASS' : '❌ FAIL', test10.message);
    console.log();

    // Test 11: OR condition (none match)
    console.log('TEST 11: OR Condition (None Match)');
    console.log('--------------------------------------');
    const test11 = await testCondition({
      type: 'OR',
      conditions: [
        { type: 'CLIENT_STATUS_EQUALS', value: 'CLOSED' },
        { type: 'CLIENT_HAS_TAG', value: 'non-existent' }
      ]
    }, testClientId);
    results.push({name: 'OR (none match)', passed: test11.matched === false, data: test11});
    console.log(!test11.matched ? '✅ PASS' : '❌ FAIL', test11.message);
    console.log();

    // Test 12: Complex nested conditions
    console.log('TEST 12: Complex Nested Conditions');
    console.log('--------------------------------------');
    const test12 = await testCondition({
      type: 'AND',
      conditions: [
        {
          type: 'OR',
          conditions: [
            { type: 'CLIENT_STATUS_EQUALS', value: 'LEAD' },
            { type: 'CLIENT_STATUS_EQUALS', value: 'ACTIVE' }
          ]
        },
        { type: 'CLIENT_HAS_TAG', value: 'test-tag' }
      ]
    }, testClientId);
    results.push({name: 'Complex nested', passed: test12.matched === true, data: test12});
    console.log(test12.matched ? '✅ PASS' : '❌ FAIL', test12.message);
    console.log();

    // Summary
    console.log('========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    const passed = results.filter(r => r.passed).length;
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${results.length - passed}`);

    if (passed === results.length) {
      console.log('\n✅ ALL TESTS PASSED!');
      console.log('\nFeature #282 - Condition Evaluator');
      console.log('All condition types verified:');
      console.log('  ✅ 1. CLIENT_STATUS_EQUALS');
      console.log('  ✅ 2. CLIENT_HAS_TAG');
      console.log('  ✅ 3. CLIENT_AGE_DAYS (greater/less than)');
      console.log('  ✅ 4. CLIENT_MISSING_DOCUMENTS');
      console.log('  ✅ 5. AND/OR logic between conditions');
      console.log('  ✅ 6. Complex nested conditions');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
      results.forEach(r => {
        if (!r.passed) console.log(`   ❌ ${r.name}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    process.exit(1);
  }
})();
