import fetch from 'node-fetch';

const createUser = async () => {
  const response = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testuser@example.com',
      password: 'Test123456!',
      name: 'Test User'
    })
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
};

createUser();
