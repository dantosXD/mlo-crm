// Test login
const API_URL = 'http://localhost:3000';

async function testLogin() {
  // Try registering first
  console.log('Attempting to register test user...');
  const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@mlo.com',
      password: 'test123',
      name: 'Test User',
    }),
  });

  if (registerResponse.ok) {
    console.log('✅ User registered successfully');
  } else {
    console.log('⚠️  Registration failed (user may already exist)');
  }

  // Now try login
  console.log('\nAttempting to login...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@mlo.com',
      password: 'test123',
    }),
  });

  if (!loginResponse.ok) {
    console.log('❌ Login failed');
    const error = await loginResponse.json();
    console.log('Error:', error);
    return;
  }

  const loginData = await loginResponse.json();
  console.log('✅ Login successful!');
  console.log('User:', loginData.user);
  console.log('Token:', loginData.accessToken ? 'Received' : 'Missing');
}

testLogin().catch(console.error);
