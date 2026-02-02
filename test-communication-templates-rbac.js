import jwt from './backend/node_modules/jsonwebtoken/index.js';

const API_BASE = 'http://localhost:3000/api/communication-templates';
const JWT_SECRET = 'dev-secret-key-change-in-production-min-32-chars';

// Generate MLO token (non-admin)
const mloPayload = {
  userId: 'mlo-id',
  email: 'mlo@example.com',
  role: 'MLO'
};
const MLO_TOKEN = jwt.sign(mloPayload, JWT_SECRET, { expiresIn: '1h' });

// Generate MANAGER token
const managerPayload = {
  userId: 'manager-id',
  email: 'manager@example.com',
  role: 'MANAGER'
};
const MANAGER_TOKEN = jwt.sign(managerPayload, JWT_SECRET, { expiresIn: '1h' });

async function testAPI(name, token, method, endpoint, body = null) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${name}`);
    console.log(`METHOD: ${method} ${endpoint}`);
    console.log(`ROLE: ${jwt.decode(token).role}`);

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    console.log(`STATUS: ${response.status}`);
    console.log(`RESPONSE: ${JSON.stringify(data, null, 2)}`);

    return { status: response.status, data };
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return null;
  }
}

async function runRBACTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Communication Templates RBAC Test Suite               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Test 1: MLO can GET all templates (read-only access)
  await testAPI(
    'MLO can GET all templates',
    MLO_TOKEN,
    'GET',
    ''
  );

  // Test 2: MLO cannot POST (create) templates
  await testAPI(
    'MLO cannot CREATE template',
    MLO_TOKEN,
    'POST',
    '',
    {
      name: 'Unauthorized Template',
      type: 'EMAIL',
      body: 'Test body'
    }
  );

  // Test 3: MLO cannot PUT (update) templates
  await testAPI(
    'MLO cannot UPDATE template',
    MLO_TOKEN,
    'PUT',
    '/f1635765-b6b0-4e36-85d9-98e571d643ef',
    {
      name: 'Unauthorized Update'
    }
  );

  // Test 4: MLO cannot DELETE templates
  await testAPI(
    'MLO cannot DELETE template',
    MLO_TOKEN,
    'DELETE',
    '/f1635765-b6b0-4e36-85d9-98e571d643ef'
  );

  // Test 5: MLO cannot PATCH (toggle) templates
  await testAPI(
    'MLO cannot TOGGLE template',
    MLO_TOKEN,
    'PATCH',
    '/f1635765-b6b0-4e36-85d9-98e571d643ef/toggle'
  );

  // Test 6: MANAGER can GET all templates
  await testAPI(
    'MANAGER can GET all templates',
    MANAGER_TOKEN,
    'GET',
    ''
  );

  // Test 7: MANAGER can POST (create) templates
  await testAPI(
    'MANAGER can CREATE template',
    MANAGER_TOKEN,
    'POST',
    '',
    {
      name: 'Manager Created Template',
      type: 'EMAIL',
      category: 'WELCOME',
      subject: 'Manager Test',
      body: 'Test body from manager',
      isActive: true
    }
  );

  // Test 8: MANAGER can PUT (update) templates
  await testAPI(
    'MANAGER can UPDATE template',
    MANAGER_TOKEN,
    'PUT',
    '/f1635765-b6b0-4e36-85d9-98e571d643ef',
    {
      name: 'Manager Updated Template'
    }
  );

  // Test 9: MANAGER can PATCH (toggle) templates
  await testAPI(
    'MANAGER can TOGGLE template',
    MANAGER_TOKEN,
    'PATCH',
    '/f1635765-b6b0-4e36-85d9-98e571d643ef/toggle'
  );

  // Test 10: MANAGER cannot DELETE templates (ADMIN only)
  await testAPI(
    'MANAGER cannot DELETE template',
    MANAGER_TOKEN,
    'DELETE',
    '/f1635765-b6b0-4e36-85d9-98e571d643ef'
  );

  // Test 11: Test without authentication token
  await testAPI(
    'No token - should fail',
    'invalid-token',
    'GET',
    ''
  );

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     All RBAC Tests Completed                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

runRBACTests().catch(console.error);
