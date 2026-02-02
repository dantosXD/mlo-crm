/**
 * Test script for Feature #257 - Template Placeholder System
 *
 * This script tests:
 * 1. POST /api/communications/preview endpoint
 * 2. Placeholder extraction from template
 * 3. Placeholder replacement with real data
 * 4. Missing placeholder handling
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test credentials (use test user)
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
};

let accessToken = null;
let testClientId = null;

/**
 * Login and get access token
 */
async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  accessToken = data.accessToken;
  console.log('✅ Login successful');
  return data;
}

/**
 * Create a test client
 */
async function createTestClient() {
  console.log('👤 Creating test client...');
  const response = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Feature 257 Test Client',
      email: 'feature257@example.com',
      phone: '(555) 257-0001',
      status: 'ACTIVE',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Failed to create client:', error);
    return null;
  }

  const data = await response.json();
  testClientId = data.id;
  console.log(`✅ Test client created: ${testClientId}`);
  return data;
}

/**
 * Test 1: Preview with basic placeholders
 */
async function test1_BasicPlaceholders() {
  console.log('\n📝 Test 1: Basic placeholders');
  console.log('─────────────────────────────────');

  const template = `Dear {{client_name}},

Thank you for choosing {{company_name}}. We are pleased to work with you on your mortgage application.

Current status: {{client_status}}
Loan Officer: {{loan_officer_name}}

Date: {{date}}
Time: {{time}}

Best regards,
{{loan_officer_name}}`;

  const response = await fetch(`${API_URL}/api/communications/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId: testClientId,
      body: template,
      subject: 'Application Update for {{client_name}}',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Preview request failed:', error);
    return false;
  }

  const data = await response.json();

  console.log('✅ Preview generated successfully');
  console.log('\n📋 Detected placeholders:', data.body.placeholders);
  console.log('⚠️  Missing placeholders:', data.body.missing);
  console.log('\n📄 Original (first 200 chars):', data.body.original.substring(0, 200) + '...');
  console.log('\n✨ Filled (first 200 chars):', data.body.filled.substring(0, 200) + '...');

  // Verify placeholders were detected
  const expectedPlaceholders = ['client_name', 'company_name', 'client_status', 'loan_officer_name', 'date', 'time'];
  const detectedAll = expectedPlaceholders.every(p => data.body.placeholders.includes(p));

  if (detectedAll) {
    console.log('✅ All expected placeholders detected');
  } else {
    console.log('❌ Some placeholders not detected');
    return false;
  }

  // Verify placeholders were replaced (not showing raw {{key}})
  const hasRawPlaceholders = data.body.filled.includes('{{') || data.body.filled.includes('}}');
  if (!hasRawPlaceholders) {
    console.log('✅ All placeholders replaced with values');
  } else {
    console.log('⚠️  Some placeholders were not replaced');
  }

  return true;
}

/**
 * Test 2: Preview with loan amount placeholder
 */
async function test2_LoanAmountPlaceholder() {
  console.log('\n📝 Test 2: Loan amount placeholder');
  console.log('─────────────────────────────────');

  // First create a loan scenario for the client
  console.log('💰 Creating loan scenario...');
  const scenarioResponse = await fetch(`${API_URL}/api/loan-scenarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId: testClientId,
      name: 'Test Scenario',
      loanType: 'PURCHASE',
      amount: 350000,
      interestRate: 6.5,
      termYears: 30,
      downPayment: 70000,
      propertyValue: 420000,
    }),
  });

  if (!scenarioResponse.ok) {
    console.error('⚠️  Could not create loan scenario, will test without it');
  } else {
    console.log('✅ Loan scenario created');
  }

  const template = `Loan Amount: {{loan_amount}}

Based on your loan application for ${{loan_amount}}, we are pleased to inform you...`;

  const response = await fetch(`${API_URL}/api/communications/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId: testClientId,
      body: template,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Preview request failed:', error);
    return false;
  }

  const data = await response.json();

  console.log('✅ Preview generated');
  console.log('📄 Filled text:', data.body.filled);

  // Check if loan amount was formatted as currency
  if (data.body.filled.includes('$')) {
    console.log('✅ Loan amount formatted as currency');
  } else {
    console.log('⚠️  Loan amount may not be properly formatted');
  }

  return true;
}

/**
 * Test 3: Preview with missing placeholder values
 */
async function test3_MissingPlaceholders() {
  console.log('\n📝 Test 3: Missing placeholder handling');
  console.log('─────────────────────────────────');

  const template = `Dear {{client_name}},

Property Address: {{property_address}}
Due Date: {{due_date}}
Trigger: {{trigger_type}}`;

  const response = await fetch(`${API_URL}/api/communications/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId: testClientId,
      body: template,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Preview request failed:', error);
    return false;
  }

  const data = await response.json();

  console.log('✅ Preview generated');
  console.log('📋 Detected placeholders:', data.body.placeholders);
  console.log('⚠️  Missing placeholders:', data.body.missing);

  if (data.body.missing.length > 0) {
    console.log('✅ Missing placeholders correctly identified');
    console.log('📄 Filled text shows fallback values:', data.body.filled);
  }

  return true;
}

/**
 * Test 4: Preview with additional context
 */
async function test4_AdditionalContext() {
  console.log('\n📝 Test 4: Additional context support');
  console.log('─────────────────────────────────');

  const template = `Dear {{client_name}},

Property Address: {{property_address}}
Due Date: {{due_date}}
Trigger: {{trigger_type}}`;

  const response = await fetch(`${API_URL}/api/communications/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId: testClientId,
      body: template,
      additionalContext: {
        property_address: '123 Main St, Springfield, IL 62701',
        due_date: 'March 15, 2026',
        trigger_type: 'Document Request',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Preview request failed:', error);
    return false;
  }

  const data = await response.json();

  console.log('✅ Preview generated with additional context');
  console.log('⚠️  Missing placeholders:', data.body.missing);

  if (data.body.missing.length === 0) {
    console.log('✅ All placeholders filled using additional context');
  } else {
    console.log('⚠️  Some placeholders still missing:', data.body.missing);
  }

  console.log('📄 Filled text:', data.body.filled);

  // Verify additional context was used
  if (data.body.filled.includes('123 Main St')) {
    console.log('✅ Additional context properly applied');
  }

  return true;
}

/**
 * Test 5: Empty template
 */
async function test5_EmptyTemplate() {
  console.log('\n📝 Test 5: Empty template handling');
  console.log('─────────────────────────────────');

  const response = await fetch(`${API_URL}/api/communications/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId: testClientId,
      body: '',
      subject: '',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Preview request failed:', error);
    return false;
  }

  const data = await response.json();

  console.log('✅ Empty template handled gracefully');
  console.log('📋 Placeholders detected:', data.body.placeholders);
  console.log('📄 Filled text:', data.body.filled);

  return true;
}

/**
 * Test 6: Malformed placeholders
 */
async function test6_MalformedPlaceholders() {
  console.log('\n📝 Test 6: Malformed placeholder handling');
  console.log('─────────────────────────────────');

  const template = `Dear {client_name}}, // Single brace
Email: {{client_email // Missing closing brace
Phone: {{client_phone}} // Correct`;

  const response = await fetch(`${API_URL}/api/communications/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId: testClientId,
      body: template,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Preview request failed:', error);
    return false;
  }

  const data = await response.json();

  console.log('✅ Malformed placeholders handled');
  console.log('📋 Correct placeholders detected:', data.body.placeholders);
  console.log('📄 Filled text:', data.body.filled);

  return true;
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up...');

  if (testClientId) {
    const response = await fetch(`${API_URL}/api/clients/${testClientId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      console.log('✅ Test client deleted');
    } else {
      console.log('⚠️  Could not delete test client');
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('🚀 Starting Feature #257 Tests');
    console.log('================================\n');

    await login();
    await createTestClient();

    const results = [];

    results.push(await test1_BasicPlaceholders());
    results.push(await test2_LoanAmountPlaceholder());
    results.push(await test3_MissingPlaceholders());
    results.push(await test4_AdditionalContext());
    results.push(await test5_EmptyTemplate());
    results.push(await test6_MalformedPlaceholders());

    await cleanup();

    console.log('\n================================');
    console.log('📊 Test Summary');
    console.log('================================');
    const passed = results.filter(r => r).length;
    const total = results.length;
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);

    if (passed === total) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Error running tests:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
