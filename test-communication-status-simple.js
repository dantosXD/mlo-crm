#!/usr/bin/env node

const fetch = require('node-fetch');

async function test() {
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' }),
  });
  const { token } = await loginRes.json();

  // Get clients
  const clientsRes = await fetch('http://localhost:3000/api/clients?limit=1', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const clientsData = await clientsRes.json();

  console.log('Clients status:', clientsRes.status);
  console.log('Has clients:', clientsData.data?.length > 0);
  if (clientsData.data?.length > 0) {
    console.log('First client ID:', clientsData.data[0].id);
  }
}

test().catch(console.error);
