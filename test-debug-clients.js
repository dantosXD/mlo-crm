fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: 'mlo@example.com', password: 'password123'})
})
.then(r => r.json())
.then(d => {
  console.log('Token received');
  return fetch('http://localhost:3000/api/clients', {
    headers: {'Authorization': 'Bearer ' + d.accessToken}
  });
})
.then(r => r.json())
.then(d => {
  console.log('Clients total:', d.total);
  console.log('First client ID:', d.clients?.[0]?.id || 'none');
  console.log('Full response:', JSON.stringify(d).substring(0, 300));
})
.catch(e => console.error('Error:', e));
