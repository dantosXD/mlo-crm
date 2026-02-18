/**
 * Test Feature #285 - SEND_EMAIL Action
 *
 * This script tests the SEND_EMAIL workflow action:
 * 1. Creates a test workflow with SEND_EMAIL action
 * 2. Manually executes the action
 * 3. Verifies communication record is created
 * 4. Verifies activity log is created
 * 5. Verifies template placeholders are replaced
 */

import { executeCommunicationAction } from './backend/dist/services/actionExecutor.js';

const API_URL = (process.env.API_URL || 'http://localhost:3002').replace(/\/$/, '');

// Test authentication token (admin user)
let authToken = '';
let csrfToken = '';
let sessionCookie = '';

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const requestOptions = { ...options };
  const isApiRequest = typeof url === 'string' && url.startsWith(API_URL);

  if (isApiRequest) {
    const headers = new Headers(options.headers || {});
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (sessionCookie && !headers.has('Cookie')) {
      headers.set('Cookie', sessionCookie);
    }
    requestOptions.headers = headers;
  }

  const response = await nativeFetch(url, requestOptions);

  if (isApiRequest) {
    const nextCsrfToken = response.headers.get('X-CSRF-Token');
    if (nextCsrfToken) {
      csrfToken = nextCsrfToken;
    }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
  }

  return response;
};

// Test data
let testClientId = '';
let testTemplateId = '';
let testWorkflowId = '';

async function login() {
  console.log('\n=== Logging in as test user ===');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'password123',
    }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  authToken = data.accessToken || data.token;

  // Prime CSRF cookie/token for subsequent mutating requests
  await fetch(`${API_URL}/api/clients`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  console.log('✓ Logged in successfully');
  console.log(`  User: ${data.user.name} (${data.user.role})`);
  return data.user;
}

async function createTestClient() {
  console.log('\n=== Creating test client ===');
  const response = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      name: 'TEST_EMAIL_CLIENT',
      email: 'test-email@example.com',
      phone: '+15550100',
      status: 'LEAD',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create test client');
  }

  const data = await response.json();
  testClientId = data.id;
  console.log(`✓ Test client created: ${testClientId}`);
  return data;
}

async function createEmailTemplate() {
  console.log('\n=== Creating email template ===');
  const response = await fetch(`${API_URL}/api/communication-templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      name: 'TEST_EMAIL_TEMPLATE',
      type: 'EMAIL',
      category: 'WELCOME',
      subject: 'Welcome {{client_name}}!',
      body: 'Dear {{client_name}},\n\nWelcome to MLO Dashboard!\n\nYour status is: {{client_status}}\n\nTriggered by: {{trigger_type}}\n\nDate: {{date}}\nTime: {{time}}',
      placeholders: ['client_name', 'client_status', 'trigger_type', 'date', 'time'],
      isActive: true,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create email template');
  }

  const data = await response.json();
  testTemplateId = data.id;
  console.log(`✓ Email template created: ${testTemplateId}`);
  return data;
}

async function testSendEmailFromTemplate() {
  console.log('\n=== Test 1: SEND_EMAIL from template ===');

  const context = {
    clientId: testClientId,
    triggerType: 'CLIENT_CREATED',
    triggerData: {},
    userId: (await login()).id,
  };

  const config = {
    templateId: testTemplateId,
  };

  try {
    const result = await executeCommunicationAction('SEND_EMAIL', config, context);

    if (result.success) {
      console.log('✓ SEND_EMAIL action executed successfully');
      console.log(`  Communication ID: ${result.data.communicationId}`);
      console.log(`  Type: ${result.data.type}`);
      console.log(`  To: ${result.data.to}`);
      console.log(`  Subject: ${result.data.subject}`);
      return result.data.communicationId;
    } else {
      console.error('✗ SEND_EMAIL action failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('✗ Error executing SEND_EMAIL:', error.message);
    return null;
  }
}

async function verifyCommunicationRecord(communicationId) {
  console.log('\n=== Verifying communication record ===');

  const response = await fetch(`${API_URL}/api/communications/${communicationId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    console.error('✗ Failed to fetch communication record');
    return false;
  }

  const communication = await response.json();

  console.log('✓ Communication record found');
  console.log(`  ID: ${communication.id}`);
  console.log(`  Type: ${communication.type}`);
  console.log(`  Status: ${communication.status}`);
  console.log(`  Subject: ${communication.subject}`);
  console.log(`  Body preview: ${communication.body.substring(0, 100)}...`);
  console.log(`  Sent at: ${communication.sentAt}`);
  console.log(`  Template ID: ${communication.templateId}`);

  // Verify status is SENT
  if (communication.status !== 'SENT') {
    console.error('✗ Communication status is not SENT:', communication.status);
    return false;
  }

  // Verify template ID matches
  if (communication.templateId !== testTemplateId) {
    console.error('✗ Template ID mismatch');
    return false;
  }

  // Verify placeholders were replaced
  if (!communication.body.includes('TEST_EMAIL_CLIENT')) {
    console.error('✗ Client name placeholder not replaced');
    return false;
  }

  if (!communication.subject.includes('TEST_EMAIL_CLIENT')) {
    console.error('✗ Client name placeholder not replaced in subject');
    return false;
  }

  console.log('✓ All verification checks passed');
  return true;
}

async function verifyActivityLog(clientId) {
  console.log('\n=== Verifying activity log ===');

  const response = await fetch(`${API_URL}/api/activities?client_id=${clientId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    console.error('✗ Failed to fetch activity log');
    return false;
  }

  const data = await response.json();
  const activities = data.activities || data;

  const communicationActivity = activities.find((a) => a.type === 'COMMUNICATION_SENT');

  if (!communicationActivity) {
    console.error('✗ No COMMUNICATION_SENT activity found');
    return false;
  }

  console.log('✓ Activity log entry found');
  console.log(`  Type: ${communicationActivity.type}`);
  console.log(`  Description: ${communicationActivity.description}`);

  let metadata;
  try {
    metadata = JSON.parse(communicationActivity.metadata || '{}');
  } catch (e) {
    console.log('  Warning: Could not parse metadata');
    metadata = {};
  }
  console.log(`  Communication ID: ${metadata.communicationId}`);
  console.log(`  Type: ${metadata.type}`);
  console.log(`  Template: ${metadata.templateName}`);

  return true;
}

async function testSendEmailWithCustomRecipient() {
  console.log('\n=== Test 2: SEND_EMAIL with custom recipient ===');

  const user = await login();
  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: user.id,
  };

  const config = {
    templateId: testTemplateId,
    to: 'custom-recipient@example.com',
  };

  try {
    const result = await executeCommunicationAction('SEND_EMAIL', config, context);

    if (result.success) {
      console.log('✓ SEND_EMAIL with custom recipient executed');
      console.log(`  To: ${result.data.to}`);

      if (result.data.to !== 'custom-recipient@example.com') {
        console.error('✗ Custom recipient not used');
        return false;
      }

      return true;
    } else {
      console.error('✗ SEND_EMAIL with custom recipient failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

async function testSendEmailWithCustomBody() {
  console.log('\n=== Test 3: SEND_EMAIL with custom body (no template) ===');

  const user = await login();
  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: user.id,
  };

  const config = {
    subject: 'Custom Subject',
    body: 'This is a custom email body for {{client_name}}',
  };

  try {
    const result = await executeCommunicationAction('SEND_EMAIL', config, context);

    if (result.success) {
      console.log('✓ SEND_EMAIL with custom body executed');
      console.log(`  Subject: ${result.data.subject}`);
      console.log(`  Communication ID: ${result.data.communicationId}`);
      return true;
    } else {
      console.error('✗ SEND_EMAIL with custom body failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('\n=== Cleaning up test data ===');

  // Delete communications
  const commsResponse = await fetch(`${API_URL}/api/communications?client_id=${testClientId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (commsResponse.ok) {
    const data = await commsResponse.json();
    const communications = data.communications || data.data || data;

    for (const comm of communications) {
      await fetch(`${API_URL}/api/communications/${comm.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    }
    console.log('✓ Test communications deleted');
  }

  // Delete template
  if (testTemplateId) {
    await fetch(`${API_URL}/api/communication-templates/${testTemplateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    console.log('✓ Test template deleted');
  }

  // Delete client
  if (testClientId) {
    await fetch(`${API_URL}/api/clients/${testClientId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    console.log('✓ Test client deleted');
  }
}

async function runTests() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Feature #285 - SEND_EMAIL Action Tests                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    await login();
    await createTestClient();
    await createEmailTemplate();

    // Test 1: Send email from template
    const communicationId = await testSendEmailFromTemplate();
    if (communicationId) {
      await verifyCommunicationRecord(communicationId);
      await verifyActivityLog(testClientId);
    }

    // Test 2: Send email with custom recipient
    await testSendEmailWithCustomRecipient();

    // Test 3: Send email with custom body (no template)
    await testSendEmailWithCustomBody();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   All tests completed!                                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n✗ Test suite failed:', error.message);
  } finally {
    await cleanup();
    console.log('\n✓ Cleanup complete');
  }
}

runTests();
