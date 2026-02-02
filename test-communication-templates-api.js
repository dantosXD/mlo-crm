import jwt from './backend/node_modules/jsonwebtoken/index.js';

const API_BASE = 'http://localhost:3000/api/communication-templates';
const JWT_SECRET = 'dev-secret-key-change-in-production-min-32-chars';

// Generate admin token
const payload = {
  userId: '7bb31287-5e33-4255-95fe-d26c3194985a',
  email: 'admin@example.com',
  role: 'ADMIN'
};
const TOKEN = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function testAPI(name, method, endpoint, body = null) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${name}`);
    console.log(`METHOD: ${method} ${endpoint}`);
    if (body) console.log(`BODY: ${JSON.stringify(body, null, 2)}`);

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    console.log(`STATUS: ${response.status}`);
    console.log(`RESPONSE: ${JSON.stringify(data, null, 2)}`);

    if (response.ok) {
      console.log(`✅ PASSED`);
      return data;
    } else {
      console.log(`❌ FAILED`);
      return null;
    }
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    console.log(`❌ FAILED`);
    return null;
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Communication Templates CRUD API Test Suite          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  let templateId = null;

  // Test 1: GET all communication templates (should be empty initially)
  await testAPI(
    'Get all templates (empty list)',
    'GET',
    ''
  );

  // Test 2: GET meta/types
  await testAPI(
    'Get available template types',
    'GET',
    '/meta/types'
  );

  // Test 3: GET meta/categories
  await testAPI(
    'Get available template categories',
    'GET',
    '/meta/categories'
  );

  // Test 4: GET meta/placeholders
  await testAPI(
    'Get available placeholder variables',
    'GET',
    '/meta/placeholders'
  );

  // Test 5: POST - Create EMAIL template
  const emailTemplate = await testAPI(
    'Create EMAIL template',
    'POST',
    '',
    {
      name: 'Test Welcome Email',
      type: 'EMAIL',
      category: 'WELCOME',
      subject: 'Welcome to Our Mortgage Services!',
      body: 'Dear {{client_name}},\n\nWelcome to our mortgage services! We are excited to work with you.\n\nBest regards,\n{{loan_officer_name}}',
      placeholders: ['client_name', 'loan_officer_name'],
      isActive: true
    }
  );

  if (emailTemplate && emailTemplate.id) {
    templateId = emailTemplate.id;
    console.log(`\n✓ Template ID saved: ${templateId}`);
  }

  // Test 6: POST - Create SMS template
  const smsTemplate = await testAPI(
    'Create SMS template',
    'POST',
    '',
    {
      name: 'Test Appointment Reminder SMS',
      type: 'SMS',
      category: 'REMINDER',
      body: 'Hi {{client_name}}, reminder of your appointment on {{due_date}}. Reply YES to confirm.',
      placeholders: ['client_name', 'due_date'],
      isActive: true
    }
  );

  if (smsTemplate && smsTemplate.id) {
    console.log(`\n✓ SMS Template ID: ${smsTemplate.id}`);
  }

  // Test 7: POST - Create LETTER template
  await testAPI(
    'Create LETTER template',
    'POST',
    '',
    {
      name: 'Test Pre-approval Letter',
      type: 'LETTER',
      category: 'STATUS_UPDATE',
      subject: 'Pre-approval Letter',
      body: 'Dear {{client_name}},\n\nYou are pre-approved for a loan of {{loan_amount}}.\n\nSincerely,\n{{loan_officer_name}}',
      placeholders: ['client_name', 'loan_amount', 'loan_officer_name'],
      isActive: true
    }
  );

  // Test 8: GET all templates (should show 3 templates now)
  await testAPI(
    'Get all templates (with 3 created)',
    'GET',
    ''
  );

  // Test 9: GET templates by type (EMAIL)
  await testAPI(
    'Get EMAIL templates only',
    'GET',
    '?type=EMAIL'
  );

  // Test 10: GET templates by category (WELCOME)
  await testAPI(
    'Get WELCOME category templates',
    'GET',
    '?category=WELCOME'
  );

  // Test 11: GET templates by active status
  await testAPI(
    'Get active templates only',
    'GET',
    '?is_active=true'
  );

  // Test 12: GET single template by ID
  if (templateId) {
    await testAPI(
      'Get single template by ID',
      'GET',
      `/${templateId}`
    );
  }

  // Test 13: PUT - Update template
  if (templateId) {
    await testAPI(
      'Update template',
      'PUT',
      `/${templateId}`,
      {
        name: 'Updated Welcome Email',
        category: 'FOLLOWUP',
        isActive: false
      }
    );
  }

  // Test 14: PATCH - Toggle template active status
  if (templateId) {
    await testAPI(
      'Toggle template active status',
      'PATCH',
      `/${templateId}/toggle`
    );
  }

  // Test 15: Validation test - Create template without required fields
  await testAPI(
    'Validation: Missing required fields',
    'POST',
    '',
    {
      name: 'Invalid Template'
      // Missing type and body
    }
  );

  // Test 16: Validation test - Invalid type
  await testAPI(
    'Validation: Invalid type',
    'POST',
    '',
    {
      name: 'Invalid Type Template',
      type: 'INVALID_TYPE',
      body: 'Test body'
    }
  );

  // Test 17: Validation test - EMAIL without subject
  await testAPI(
    'Validation: EMAIL without subject',
    'POST',
    '',
    {
      name: 'Email Without Subject',
      type: 'EMAIL',
      body: 'Test body'
      // Missing subject for EMAIL type
    }
  );

  // Test 18: GET all templates with pagination
  await testAPI(
    'Get templates with pagination',
    'GET',
    '?page=1&limit=2'
  );

  // Test 19: GET all templates with search
  await testAPI(
    'Search templates by name/subject',
    'GET',
    '?search=Welcome'
  );

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     All Tests Completed                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

runTests().catch(console.error);
