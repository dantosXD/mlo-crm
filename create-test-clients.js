fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: 'mlo@example.com', password: 'password123'})
})
.then(r => r.json())
.then(d => {
  const token = d.accessToken;

  // Create client with tags
  return fetch('http://localhost:3000/api/clients', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Tagged Client',
      email: 'tagged@example.com',
      phone: '555-1111',
      status: 'LEAD',
      tags: JSON.stringify(['test-tag', 'priority', 'vip'])
    })
  });
})
.then(r => r.json())
.then(d => {
  console.log('Created tagged client:', d.id);
  return d.id;
})
.catch(e => console.error('Error:', e));
