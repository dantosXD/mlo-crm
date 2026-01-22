const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId: 'test-user-id', email: 'test@example.com', role: 'MLO' },
  'your-256-bit-secret',
  { expiresIn: '24h' }
);
console.log(token);
