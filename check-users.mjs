// Check existing users and create test templates
const API_URL = 'http://localhost:3000/api';

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function main() {
  console.log('=== Creating Test Communication Templates ===\n');

  // Try to login with different credentials
  const loginAttempts = [
    { email: 'admin@test.com', password: 'admin123' },
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'test@test.com', password: 'test123' },
  ];

  let adminToken = null;

  for (const attempt of loginAttempts) {
    const result = await makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(attempt),
    });

    if (result.ok && result.data.accessToken) {
      adminToken = result.data.accessToken;
      console.log(`✓ Logged in as ${attempt.email}`);
      break;
    }
  }

  if (!adminToken) {
    console.log('Trying to create admin user...');
    const registerResult = await makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'ADMIN',
      }),
    });

    if (registerResult.ok) {
      console.log('✓ Created admin user');

      // Try logging in again
      const loginResult = await makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@test.com',
          password: 'admin123',
        }),
      });

      if (loginResult.ok && loginResult.data.accessToken) {
        adminToken = loginResult.data.accessToken;
        console.log('✓ Logged in as admin');
      }
    }
  }

  if (!adminToken) {
    console.log('Failed to get admin token');
    process.exit(1);
  }

  console.log('\nCreating test templates...\n');

  const templates = [
    {
      name: 'New Client Welcome',
      type: 'EMAIL',
      category: 'WELCOME',
      subject: 'Welcome to Our Mortgage Team!',
      body: 'Dear {{client_name}},\n\nWelcome to our mortgage team!\n\nBest regards,\n{{loan_officer_name}}',
      placeholders: ['{{client_name}}', '{{loan_officer_name}}'],
      isActive: true,
    },
    {
      name: 'Document Request SMS',
      type: 'SMS',
      category: 'DOCUMENT_REQUEST',
      subject: null,
      body: 'Hi {{client_name}}, please upload documents by {{due_date}}.',
      placeholders: ['{{client_name}}', '{{due_date}}'],
      isActive: true,
    },
    {
      name: 'Status Update Email',
      type: 'EMAIL',
      category: 'STATUS_UPDATE',
      subject: 'Application Status Update',
      body: 'Dear {{client_name}},\n\nYour application status is: {{status}}.\n\nBest regards',
      placeholders: ['{{client_name}}', '{{status}}'],
      isActive: true,
    },
    {
      name: 'Inactive Template',
      type: 'LETTER',
      category: 'OTHER',
      subject: 'Old Template',
      body: 'This is inactive',
      placeholders: [],
      isActive: false,
    },
  ];

  for (const template of templates) {
    const result = await makeRequest('/communication-templates', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(template),
    });

    if (result.ok) {
      console.log(`✓ Created: ${template.name}`);
    } else {
      console.log(`✗ Failed: ${template.name} - ${result.data.message || result.data.error}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
