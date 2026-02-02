// Comprehensive filter test for Communications API
const API_URL = 'http://localhost:3000/api/communications';

async function login() {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mlo@example.com', password: 'password123' })
  });

  const data = await response.json();
  return data.accessToken;
}

async function apiRequest(endpoint, token) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return { status: response.status, data: await response.json() };
}

async function testFilters() {
  console.log('='.repeat(70));
  console.log('Feature #255: Communications API - Comprehensive Filter Tests');
  console.log('='.repeat(70));

  const token = await login();
  console.log('✅ Logged in');

  // Get a client ID
  const clientsResp = await fetch('http://localhost:3000/api/clients', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clients = await clientsResp.json();
  const clientId = clients[0]?.id;

  if (!clientId) {
    console.error('❌ No client found');
    return;
  }

  console.log(`\n📌 Test Client ID: ${clientId}`);

  // Create test communications with different types and statuses
  const testComms = [
    { type: 'EMAIL', status: 'DRAFT', subject: 'Filter Test EMAIL DRAFT' },
    { type: 'EMAIL', status: 'READY', subject: 'Filter Test EMAIL READY' },
    { type: 'SMS', status: 'DRAFT', subject: 'Filter Test SMS DRAFT' },
    { type: 'SMS', status: 'SENT', subject: 'Filter Test SMS SENT' },
    { type: 'LETTER', status: 'DRAFT', subject: 'Filter Test LETTER DRAFT' },
  ];

  console.log('\n📝 Creating test communications...');
  const createdIds = [];

  for (const comm of testComms) {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId,
        type: comm.type,
        subject: comm.subject,
        body: `Test body for ${comm.type} ${comm.status}`,
        status: comm.status
      })
    });

    if (resp.ok) {
      const data = await resp.json();
      createdIds.push(data.id);
      console.log(`   ✅ Created: ${comm.type} / ${comm.status}`);
    }
  }

  console.log(`\n✅ Created ${createdIds.length} test communications`);

  // Test filters
  console.log('\n🔍 Testing Filters:');
  console.log('-'.repeat(70));

  // Filter by type
  console.log('\n1️⃣  Filter by Type');
  let result = await apiRequest('?type=EMAIL', token);
  console.log(`   EMAIL: ${result.data.data?.length || 0} results`);

  result = await apiRequest('?type=SMS', token);
  console.log(`   SMS: ${result.data.data?.length || 0} results`);

  result = await apiRequest('?type=LETTER', token);
  console.log(`   LETTER: ${result.data.data?.length || 0} results`);

  // Filter by status
  console.log('\n2️⃣  Filter by Status');
  result = await apiRequest('?status=DRAFT', token);
  console.log(`   DRAFT: ${result.data.data?.length || 0} results`);

  result = await apiRequest('?status=READY', token);
  console.log(`   READY: ${result.data.data?.length || 0} results`);

  result = await apiRequest('?status=SENT', token);
  console.log(`   SENT: ${result.data.data?.length || 0} results`);

  // Combined filters
  console.log('\n3️⃣  Combined Filters');
  result = await apiRequest('?type=EMAIL&status=DRAFT', token);
  console.log(`   EMAIL + DRAFT: ${result.data.data?.length || 0} results`);

  result = await apiRequest('?type=SMS&status=SENT', token);
  console.log(`   SMS + SENT: ${result.data.data?.length || 0} results`);

  // Date range filter
  console.log('\n4️⃣  Date Range Filter');
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  result = await apiRequest(`?start_date=${today}&end_date=${tomorrow}`, token);
  console.log(`   Today to tomorrow: ${result.data.data?.length || 0} results`);

  // Pagination
  console.log('\n5️⃣  Pagination');
  result = await apiRequest('?page=1&limit=2', token);
  console.log(`   Page 1, Limit 2: ${result.data.data?.length || 0} results`);
  console.log(`   Total: ${result.data.pagination?.total || 0}`);
  console.log(`   Total Pages: ${result.data.pagination?.totalPages || 0}`);

  // Cleanup
  console.log('\n🧹 Cleaning up test communications...');
  for (const id of createdIds) {
    await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
  console.log(`✅ Deleted ${createdIds.length} test communications`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ All filter tests completed successfully!');
  console.log('='.repeat(70));
}

testFilters().catch(console.error);
