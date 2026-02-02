/**
 * Test Feature #285 - SEND_SMS and GENERATE_LETTER Actions
 *
 * This script tests the SEND_SMS and GENERATE_LETTER workflow actions
 */

import { executeCommunicationAction } from './backend/dist/services/actionExecutor.js';

const API_URL = 'http://localhost:3000';

let authToken = '';
let testClientId = '';
let testSmsTemplateId = '';
let testLetterTemplateId = '';

async function login() {
  console.log('\n=== Logging in as test user ===');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testadmin@mlodash.com',
      password: 'admin123',
    }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  authToken = data.accessToken || data.token;
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
      name: 'TEST_SMS_LETTER_CLIENT',
      email: 'test-sms-letter@example.com',
      phone: '+15550200',
      status: 'ACTIVE',
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

async function createSmsTemplate() {
  console.log('\n=== Creating SMS template ===');
  const response = await fetch(`${API_URL}/api/communication-templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      name: 'TEST_SMS_TEMPLATE',
      type: 'SMS',
      category: 'REMINDER',
      body: 'Hi {{client_name}}! Your loan application status is {{client_status}}. Date: {{date}}',
      placeholders: ['client_name', 'client_status', 'date'],
      isActive: true,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create SMS template');
  }

  const data = await response.json();
  testSmsTemplateId = data.id;
  console.log(`✓ SMS template created: ${testSmsTemplateId}`);
  return data;
}

async function createLetterTemplate() {
  console.log('\n=== Creating Letter template ===');
  const response = await fetch(`${API_URL}/api/communication-templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      name: 'TEST_LETTER_TEMPLATE',
      type: 'LETTER',
      category: 'STATUS_UPDATE',
      subject: 'Loan Application Status Update - {{client_name}}',
      body: `Dear {{client_name}},

This letter is to inform you that your loan application status has been updated to: {{client_status}}.

Should you have any questions, please do not hesitate to contact us.

Sincerely,
Your Mortgage Team

Date: {{date}}`,
      placeholders: ['client_name', 'client_status', 'date'],
      isActive: true,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create Letter template');
  }

  const data = await response.json();
  testLetterTemplateId = data.id;
  console.log(`✓ Letter template created: ${testLetterTemplateId}`);
  return data;
}

async function testSendSmsFromTemplate() {
  console.log('\n=== Test 1: SEND_SMS from template ===');

  const user = await login();
  const context = {
    clientId: testClientId,
    triggerType: 'CLIENT_STATUS_CHANGED',
    triggerData: {},
    userId: user.id,
  };

  const config = {
    templateId: testSmsTemplateId,
  };

  try {
    const result = await executeCommunicationAction('SEND_SMS', config, context);

    if (result.success) {
      console.log('✓ SEND_SMS action executed successfully');
      console.log(`  Communication ID: ${result.data.communicationId}`);
      console.log(`  Type: ${result.data.type}`);
      console.log(`  To: ${result.data.to}`);
      console.log(`  Body: ${result.data.body}`);

      // Verify placeholder replacement
      if (!result.data.body.includes('TEST_SMS_LETTER_CLIENT')) {
        console.error('✗ Client name placeholder not replaced in SMS body');
        return false;
      }

      return result.data.communicationId;
    } else {
      console.error('✗ SEND_SMS action failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('✗ Error executing SEND_SMS:', error.message);
    return null;
  }
}

async function testSendSmsWithCustomPhone() {
  console.log('\n=== Test 2: SEND_SMS with custom phone number ===');

  const user = await login();
  const context = {
    clientId: testClientId,
    triggerType: 'MANUAL',
    triggerData: {},
    userId: user.id,
  };

  const config = {
    templateId: testSmsTemplateId,
    to: '+15559999999',
  };

  try {
    const result = await executeCommunicationAction('SEND_SMS', config, context);

    if (result.success) {
      console.log('✓ SEND_SMS with custom phone executed');
      console.log(`  To: ${result.data.to}`);

      if (result.data.to !== '+15559999999') {
        console.error('✗ Custom phone number not used');
        return false;
      }

      return true;
    } else {
      console.error('✗ SEND_SMS with custom phone failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

async function testGenerateLetterFromTemplate() {
  console.log('\n=== Test 3: GENERATE_LETTER from template ===');

  const user = await login();
  const context = {
    clientId: testClientId,
    triggerType: 'CLIENT_STATUS_CHANGED',
    triggerData: {},
    userId: user.id,
  };

  const config = {
    templateId: testLetterTemplateId,
  };

  try {
    const result = await executeCommunicationAction('GENERATE_LETTER', config, context);

    if (result.success) {
      console.log('✓ GENERATE_LETTER action executed successfully');
      console.log(`  Communication ID: ${result.data.communicationId}`);
      console.log(`  Type: ${result.data.type}`);
      console.log(`  Subject: ${result.data.subject}`);
      console.log(`  Client Name: ${result.data.clientName}`);

      return result.data.communicationId;
    } else {
      console.error('✗ GENERATE_LETTER action failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('✗ Error executing GENERATE_LETTER:', error.message);
    return null;
  }
}

async function verifySmsCommunicationRecord(communicationId) {
  console.log('\n=== Verifying SMS communication record ===');

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
  console.log(`  Body: ${communication.body}`);
  console.log(`  Sent at: ${communication.sentAt}`);

  // Verify status is SENT
  if (communication.status !== 'SENT') {
    console.error('✗ Communication status is not SENT:', communication.status);
    return false;
  }

  // Verify type is SMS
  if (communication.type !== 'SMS') {
    console.error('✗ Communication type is not SMS:', communication.type);
    return false;
  }

  console.log('✓ All SMS verification checks passed');
  return true;
}

async function verifyLetterCommunicationRecord(communicationId) {
  console.log('\n=== Verifying Letter communication record ===');

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

  // Verify status is SENT
  if (communication.status !== 'SENT') {
    console.error('✗ Communication status is not SENT:', communication.status);
    return false;
  }

  // Verify type is LETTER
  if (communication.type !== 'LETTER') {
    console.error('✗ Communication type is not LETTER:', communication.type);
    return false;
  }

  // Verify subject includes client name
  if (!communication.subject.includes('TEST_SMS_LETTER_CLIENT')) {
    console.error('✗ Client name placeholder not replaced in subject');
    return false;
  }

  console.log('✓ All Letter verification checks passed');
  return true;
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

  // Delete templates
  if (testSmsTemplateId) {
    await fetch(`${API_URL}/api/communication-templates/${testSmsTemplateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    console.log('✓ Test SMS template deleted');
  }

  if (testLetterTemplateId) {
    await fetch(`${API_URL}/api/communication-templates/${testLetterTemplateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    console.log('✓ Test Letter template deleted');
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
    console.log('║   Feature #285 - SEND_SMS & GENERATE_LETTER Tests        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    await login();
    await createTestClient();
    await createSmsTemplate();
    await createLetterTemplate();

    // Test 1: Send SMS from template
    const smsCommId = await testSendSmsFromTemplate();
    if (smsCommId) {
      await verifySmsCommunicationRecord(smsCommId);
    }

    // Test 2: Send SMS with custom phone
    await testSendSmsWithCustomPhone();

    // Test 3: Generate letter from template
    const letterCommId = await testGenerateLetterFromTemplate();
    if (letterCommId) {
      await verifyLetterCommunicationRecord(letterCommId);
    }

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
