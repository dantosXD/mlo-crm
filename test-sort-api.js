// Test script to verify sort parameters are sent to API correctly
// Using native fetch in Node 18+


async function testSortAPI() {
  // First, login to get a token
  const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'password123'
    })
  });

  const loginData = await loginResponse.json();
  console.log('Login response:', JSON.stringify(loginData, null, 2));

  if (!loginData.accessToken) {
    console.error('Failed to get access token');
    return;
  }

  const token = loginData.accessToken;

  // Test 1: Default sort (no parameters)
  console.log('\n=== Test 1: Default sort (no parameters) ===');
  const response1 = await fetch('http://localhost:3000/api/clients', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clients1 = await response1.json();
  console.log('Clients count:', clients1.length);
  console.log('First 3 client names:', clients1.slice(0, 3).map(c => c.name));

  // Test 2: Sort by name ascending
  console.log('\n=== Test 2: Sort by name ascending ===');
  const response2 = await fetch('http://localhost:3000/api/clients?sortBy=name&sortOrder=asc', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clients2 = await response2.json();
  console.log('Clients count:', clients2.length);
  console.log('First 3 client names:', clients2.slice(0, 3).map(c => c.name));

  // Verify ascending order
  const isAscending = clients2.every((client, i) => {
    if (i === 0) return true;
    return client.name.toLowerCase() >= clients2[i - 1].name.toLowerCase();
  });
  console.log('Is sorted ascending by name:', isAscending);

  // Test 3: Sort by name descending
  console.log('\n=== Test 3: Sort by name descending ===');
  const response3 = await fetch('http://localhost:3000/api/clients?sortBy=name&sortOrder=desc', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clients3 = await response3.json();
  console.log('Clients count:', clients3.length);
  console.log('First 3 client names:', clients3.slice(0, 3).map(c => c.name));

  // Verify descending order
  const isDescending = clients3.every((client, i) => {
    if (i === 0) return true;
    return client.name.toLowerCase() <= clients3[i - 1].name.toLowerCase();
  });
  console.log('Is sorted descending by name:', isDescending);

  // Test 4: Sort by email ascending
  console.log('\n=== Test 4: Sort by email ascending ===');
  const response4 = await fetch('http://localhost:3000/api/clients?sortBy=email&sortOrder=asc', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clients4 = await response4.json();
  console.log('Clients count:', clients4.length);
  console.log('First 3 client emails:', clients4.slice(0, 3).map(c => c.email));

  // Verify ascending order by email
  const isEmailAscending = clients4.every((client, i) => {
    if (i === 0) return true;
    return client.email.toLowerCase() >= clients4[i - 1].email.toLowerCase();
  });
  console.log('Is sorted ascending by email:', isEmailAscending);

  // Test 5: Sort by status
  console.log('\n=== Test 5: Sort by status ascending ===');
  const response5 = await fetch('http://localhost:3000/api/clients?sortBy=status&sortOrder=asc', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clients5 = await response5.json();
  console.log('Clients count:', clients5.length);
  console.log('First 5 client statuses:', clients5.slice(0, 5).map(c => `${c.name}: ${c.status}`));

  console.log('\n✅ All API sort tests completed!');
}

testSortAPI().catch(console.error);
