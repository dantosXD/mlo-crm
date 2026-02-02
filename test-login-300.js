/**
 * Helper script to create a test admin user
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';

async function makeRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function registerAdmin() {
  console.log('🔐 Registering admin user...');

  const response = await makeRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@mlocrm.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'ADMIN',
    }),
  });

  if (response.status === 201) {
    console.log('✅ Admin user registered successfully');
    console.log('   Email: admin@mlocrm.com');
    console.log('   Password: admin123');
    return true;
  } else if (response.status === 400 && response.data.message?.includes('already exists')) {
    console.log('ℹ️  Admin user already exists');
    console.log('   Email: admin@mlocrm.com');
    console.log('   Password: admin123');
    return true;
  } else {
    console.log('❌ Registration failed:', response.data);
    return false;
  }
}

registerAdmin().catch(console.error);
