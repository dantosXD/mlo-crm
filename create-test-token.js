const jwt = require('jsonwebtoken');

// Create a test token for admin user
const payload = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  role: 'ADMIN'
};

const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key-change-in-production', {
  expiresIn: '1h'
});

console.log('Test token:');
console.log(token);
