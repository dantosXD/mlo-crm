import http from 'http';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3YmIzMTI4Ny01ZTMzLTQyNTUtOTVmZS1kMjZjMzE5NDk4NWEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzcwMDUzOTIyLCJleHAiOjE3NzAxNDAzMjJ9.sZ6ws3BXqN2rCAyRlRiNe7IJRW0wh5Af_oa8Cv7i1SU';

http.get({
  hostname: 'localhost',
  port: 3000,
  path: '/api/workflows?is_template=true',
  headers: {
    'Authorization': `Bearer ${TOKEN}`
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
});
