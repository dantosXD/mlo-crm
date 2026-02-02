// Test script for Communication Templates UI
const API_URL = 'http://localhost:3000/api';

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  console.log('=== Communication Templates UI Test ===\n');

  // Get admin token
  console.log('1. Getting admin token...');
  const loginResponse = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@mlo.com',
      password: 'admin123',
    }),
  });

  const adminToken = loginResponse.accessToken;
  console.log('✓ Got admin token\n');

  // Create test templates
  console.log('2. Creating test communication templates...');

  const templates = [
    {
      name: 'New Client Welcome',
      type: 'EMAIL',
      category: 'WELCOME',
      subject: 'Welcome to Our Mortgage Team!',
      body: `Dear {{client_name}},

Welcome to our mortgage team! We are excited to work with you on your journey to homeownership.

Your loan officer {{loan_officer_name}} will be your primary point of contact.

Best regards,
The Mortgage Team`,
      placeholders: ['{{client_name}}', '{{loan_officer_name}}'],
      isActive: true,
    },
    {
      name: 'Document Request - Pay Stubs',
      type: 'SMS',
      category: 'DOCUMENT_REQUEST',
      subject: null,
      body: 'Hi {{client_name}}, please upload your last 2 pay stubs to your portal by {{due_date}}. Thanks!',
      placeholders: ['{{client_name}}', '{{due_date}}'],
      isActive: true,
    },
    {
      name: 'Pre-Approval Approved',
      type: 'EMAIL',
      category: 'STATUS_UPDATE',
      subject: 'Great News! Your Pre-Approval is Approved',
      body: `Dear {{client_name}},

Great news! Your pre-approval has been approved for {{loan_amount}}.

Next steps:
1. Start house hunting
2. Submit any offers you find
3. We will help with the formal application

Congratulations!
{{loan_officer_name}}`,
      placeholders: ['{{client_name}}', '{{loan_amount}}', '{{loan_officer_name}}'],
      isActive: true,
    },
    {
      name: 'Closing Notification',
      type: 'EMAIL',
      category: 'CLOSING',
      subject: 'Congratulations - Your Loan is Closed!',
      body: `Dear {{client_name}},

Congratulations! Your loan has been successfully closed.

You are now a homeowner! Here are your documents:
- Closing Disclosure
- Final Loan Terms
- Payment Schedule

Your first payment of {{monthly_payment}} is due on {{first_payment_date}}.

Best regards,
The Mortgage Team`,
      placeholders: ['{{client_name}}', '{{monthly_payment}}', '{{first_payment_date}}'],
      isActive: true,
    },
    {
      name: 'Old Welcome Letter',
      type: 'LETTER',
      category: 'WELCOME',
      subject: 'Welcome Letter (Old Version)',
      body: 'This is an old version of the welcome letter template.',
      placeholders: [],
      isActive: false,
    },
  ];

  for (const template of templates) {
    try {
      await makeRequest('/communication-templates', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(template),
      });
      console.log(`✓ Created ${template.name} (${template.type})`);
    } catch (error) {
      console.log(`✗ Failed to create ${template.name}: ${error.message}`);
    }
  }

  console.log('\n3. Fetching templates to verify...');
  const templatesResponse = await makeRequest('/communication-templates', {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  console.log(`\nTotal templates: ${templatesResponse.pagination.total}`);
  console.log(`Active templates: ${templatesResponse.data.filter(t => t.isActive).length}`);

  console.log('\n=== Test templates created successfully ===');
  console.log('Navigate to http://localhost:5173/communication-templates to view the UI');
}

main().catch(console.error);
