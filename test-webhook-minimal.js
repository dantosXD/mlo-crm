/**
 * Minimal webhook test - debug version
 */

async function loginAndGetClientId() {
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'mlo@example.com', password: 'password123'})
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Get user info from token
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  console.log('User ID from token:', payload.userId);

  // Get or create a client
  let clientRes = await fetch('http://localhost:3000/api/clients', {
    headers: {'Authorization': `Bearer ${token}`}
  });
  let clients = await clientRes.json();

  let clientId;
  if (Array.isArray(clients) && clients.length > 0) {
    clientId = clients[0].id;
  } else {
    // Create a test client
    const createRes = await fetch('http://localhost:3000/api/clients', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Webhook Test Client',
        email: 'webhook@test.com',
        phone: '555-9999',
        status: 'LEAD'
      })
    });
    const createData = await createRes.json();
    clientId = createData.id;
  }
  console.log('Client ID:', clientId);

  return { token, userId: payload.userId, clientId };
}

async function testWebhook() {
  console.log('=== Testing CALL_WEBHOOK Action ===\n');

  const { token, userId, clientId } = await loginAndGetClientId();

  console.log('\n1. Calling webhook action...');

  const response = await fetch('http://localhost:3000/api/workflows/test-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      actionType: 'CALL_WEBHOOK',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        bodyTemplate: JSON.stringify({
          title: 'Test Webhook',
          body: 'Testing webhook action',
        }),
        timeoutSeconds: 10,
      },
      context: {
        clientId: clientId,
        triggerType: 'MANUAL',
        triggerData: {},
        userId: userId,
      },
    }),
  });

  console.log('Response status:', response.status);

  const result = await response.json();
  console.log('\nResult:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✅ SUCCESS!');
    console.log('Webhook status:', result.data.statusCode);
    console.log('Attempts:', result.data.attempt);
  } else {
    console.log('\n❌ FAILED:', result.message);
  }
}

testWebhook().catch(console.error);
