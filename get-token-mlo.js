const http = require('http');

const data = JSON.stringify({
  email: 'mlo@example.com',
  password: 'password123'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log(response.accessToken || response.error || body);
  });
});

req.on('error', (e) => { console.error(e); });
req.write(data);
req.end();
