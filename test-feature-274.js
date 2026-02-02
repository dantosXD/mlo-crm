/**
 * Test Feature #274: Workflow Templates API
 *
 * Tests:
 * 1. GET /api/workflows/templates - List template workflows
 * 2. POST /api/workflows/templates/:id/use - Clone template as new workflow
 * 3. Verify is_template flag is set correctly
 * 4. Verify templates are seeded on startup
 */

const fs = require('fs');
const path = require('path');

// API base URL
const API_BASE = 'http://localhost:3000/api';

// Store auth token and CSRF token
let authToken = '';
let csrfToken = '';
let cookies = '';

// Helper to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...(cookies && { Cookie: cookies }),
      ...(csrfToken && options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase()) && { 'X-CSRF-Token': csrfToken }),
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  // Store cookies from response
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    const cookiesArray = setCookieHeader.split(', ').map(cookie => cookie.split(';')[0]);
    cookies = cookiesArray.join('; ');
  }

  // Extract CSRF token from response header
  const responseCsrfToken = response.headers.get('X-CSRF-Token');
  if (responseCsrfToken) {
    csrfToken = responseCsrfToken;
  }

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, headers: response.headers };
}

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test 1: Login as admin
async function testLogin() {
  log('\n=== Test 1: Login as Admin ===', 'blue');

  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'password123',
    }),
  });

  if (result.status === 200 && result.data.accessToken) {
    log('✓ Login successful', 'green');
    log(`  User: ${result.data.user.email} (${result.data.user.role})`, 'green');
    authToken = result.data.accessToken; // Store token for subsequent requests
    return result.data.accessToken;
  } else {
    log('✗ Login failed', 'red');
    log(JSON.stringify(result.data, null, 2), 'red');
    return null;
  }
}

// Test 2: Get workflow templates
async function testGetTemplates() {
  log('\n=== Test 2: GET /api/workflows/templates ===', 'blue');

  const result = await apiRequest('/workflows/templates');

  if (result.status === 200 && result.data.templates) {
    log(`✓ Found ${result.data.templates.length} workflow templates`, 'green');
    log(`Count: ${result.data.count}`, 'green');

    // Display templates
    result.data.templates.forEach(template => {
      log(`  - ${template.name} (${template.triggerType})`, 'yellow');
      log(`    Description: ${template.description}`, 'yellow');
      log(`    Actions: ${template.actions.length}`, 'yellow');
    });

    return result.data.templates;
  } else {
    log('✗ Failed to fetch templates', 'red');
    log(JSON.stringify(result.data, null, 2), 'red');
    return [];
  }
}

// Test 3: Filter templates by trigger type
async function testFilterTemplatesByTrigger() {
  log('\n=== Test 3: Filter templates by trigger type ===', 'blue');

  const result = await apiRequest('/workflows/templates?trigger_type=CLIENT_STATUS_CHANGED');

  if (result.status === 200 && result.data.templates) {
    log(`✓ Found ${result.data.templates.length} templates with CLIENT_STATUS_CHANGED trigger`, 'green');

    result.data.templates.forEach(template => {
      log(`  - ${template.name}`, 'yellow');
    });

    return result.data.templates;
  } else {
    log('✗ Failed to filter templates', 'red');
    return [];
  }
}

// Test 4: Search templates
async function testSearchTemplates() {
  log('\n=== Test 4: Search templates ===', 'blue');

  const result = await apiRequest('/workflows/templates?search=closing');

  if (result.status === 200 && result.data.templates) {
    log(`✓ Found ${result.data.templates.length} templates matching "closing"`, 'green');

    result.data.templates.forEach(template => {
      log(`  - ${template.name}`, 'yellow');
    });

    return result.data.templates;
  } else {
    log('✗ Failed to search templates', 'red');
    return [];
  }
}

// Test 5: Use a template to create a workflow
async function testUseTemplate(templates) {
  log('\n=== Test 5: POST /api/workflows/templates/:id/use ===', 'blue');

  if (!templates || templates.length === 0) {
    log('✗ No templates available to test with', 'red');
    return null;
  }

  const template = templates[0];
  log(`Using template: ${template.name}`, 'yellow');

  const result = await apiRequest(`/workflows/templates/${template.id}/use`, {
    method: 'POST',
    body: JSON.stringify({
      name: `Test Workflow from ${template.name}`,
    }),
  });

  if (result.status === 201 && result.data.id) {
    log('✓ Successfully created workflow from template', 'green');
    log(`  New Workflow ID: ${result.data.id}`, 'green');
    log(`  Name: ${result.data.name}`, 'green');
    log(`  isActive: ${result.data.isActive}`, 'green');
    log(`  isTemplate: ${result.data.isTemplate}`, 'green');
    log(`  Trigger Type: ${result.data.triggerType}`, 'green');
    log(`  Actions: ${result.data.actions.length}`, 'green');

    return result.data;
  } else {
    log('✗ Failed to create workflow from template', 'red');
    log(JSON.stringify(result.data, null, 2), 'red');
    return null;
  }
}

// Test 6: Use template with customizations
async function testUseTemplateWithCustomization(templates) {
  log('\n=== Test 6: Use template with customizations ===', 'blue');

  if (!templates || templates.length < 2) {
    log('✗ Not enough templates to test customization', 'red');
    return null;
  }

  const template = templates[1];
  log(`Using template: ${template.name}`, 'yellow');

  const customization = {
    triggerConfig: {
      inactiveDays: 14, // Customize from default 7 days
    },
    conditions: {
      type: 'AND',
      rules: [
        {
          field: 'client.status',
          operator: 'equals',
          value: 'LEAD',
        },
        {
          field: 'client.tags',
          operator: 'contains',
          value: 'vip',
        },
      ],
    },
  };

  const result = await apiRequest(`/workflows/templates/${template.id}/use`, {
    method: 'POST',
    body: JSON.stringify({
      name: `Customized ${template.name}`,
      customize: customization,
    }),
  });

  if (result.status === 201 && result.data.id) {
    log('✓ Successfully created customized workflow from template', 'green');
    log(`  New Workflow ID: ${result.data.id}`, 'green');
    log(`  Name: ${result.data.name}`, 'green');

    if (result.data.triggerConfig) {
      log(`  Custom triggerConfig: ${JSON.stringify(result.data.triggerConfig)}`, 'green');
    }

    if (result.data.conditions) {
      log(`  Custom conditions: ${JSON.stringify(result.data.conditions)}`, 'green');
    }

    return result.data;
  } else {
    log('✗ Failed to create customized workflow from template', 'red');
    log(JSON.stringify(result.data, null, 2), 'red');
    return null;
  }
}

// Test 7: Verify template vs regular workflow
async function testTemplateVsRegular() {
  log('\n=== Test 7: Verify template vs regular workflow ===', 'blue');

  // Get all workflows
  const allWorkflows = await apiRequest('/workflows');
  const templates = await apiRequest('/workflows/templates');

  if (allWorkflows.status === 200 && templates.status === 200) {
    const templateCount = allWorkflows.data.workflows.filter(w => w.isTemplate).length;
    const regularCount = allWorkflows.data.workflows.filter(w => !w.isTemplate).length;

    log(`Total workflows: ${allWorkflows.data.pagination.total}`, 'yellow');
    log(`Template workflows (isTemplate=true): ${templateCount}`, 'green');
    log(`Regular workflows (isTemplate=false): ${regularCount}`, 'green');
    log(`Templates endpoint count: ${templates.data.count}`, 'green');

    if (templateCount === templates.data.count) {
      log('✓ Template counts match', 'green');
      return true;
    } else {
      log('✗ Template counts do not match', 'red');
      return false;
    }
  } else {
    log('✗ Failed to fetch workflows', 'red');
    return false;
  }
}

// Test 8: Verify non-templates cannot use template endpoint
async function testNonTemplateCannotUse() {
  log('\n=== Test 8: Non-template workflows cannot use template endpoint ===', 'blue');

  // Get a regular workflow (not a template)
  const allWorkflows = await apiRequest('/workflows');

  if (allWorkflows.status !== 200) {
    log('✗ Failed to fetch workflows', 'red');
    return false;
  }

  const regularWorkflow = allWorkflows.data.workflows.find(w => !w.isTemplate);

  if (!regularWorkflow) {
    log('✗ No regular workflows found to test with', 'red');
    return false;
  }

  log(`Attempting to use non-template workflow: ${regularWorkflow.name}`, 'yellow');

  const result = await apiRequest(`/workflows/templates/${regularWorkflow.id}/use`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Should fail',
    }),
  });

  if (result.status === 400 && result.data.message?.includes('not a template')) {
    log('✓ Correctly rejected non-template workflow', 'green');
    log(`  Error: ${result.data.message}`, 'yellow');
    return true;
  } else {
    log('✗ Should have rejected non-template workflow', 'red');
    log(JSON.stringify(result.data, null, 2), 'red');
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n🧪 Testing Feature #274: Workflow Templates API', 'blue');
  log('=================================================', 'blue');

  try {
    // Test 1: Login
    const token = await testLogin();
    if (!token) {
      log('\n❌ Cannot proceed without authentication', 'red');
      process.exit(1);
    }

    // Test 2: Get templates
    const templates = await testGetTemplates();

    // Test 3: Filter by trigger type
    await testFilterTemplatesByTrigger();

    // Test 4: Search templates
    await testSearchTemplates();

    // Test 5: Use template
    const createdWorkflow = await testUseTemplate(templates);

    // Test 6: Use template with customizations
    await testUseTemplateWithCustomization(templates);

    // Test 7: Verify template vs regular
    await testTemplateVsRegular();

    // Test 8: Non-template validation
    await testNonTemplateCannotUse();

    log('\n✅ All Feature #274 tests completed!', 'green');
    log('=================================================\n', 'blue');

  } catch (error) {
    log(`\n❌ Test execution failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests();
