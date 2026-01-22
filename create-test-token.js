const jwt = require('./backend/node_modules/jsonwebtoken');

// Create a test token for admin user
const payload = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  role: 'ADMIN'
};

const JWT_SECRET = 'dev-secret-key-change-in-production-min-32-chars'; // From .env file

const token = jwt.sign(payload, JWT_SECRET, {
  expiresIn: '1h'
});

console.log('Test token:');
console.log(token);

// Also test curl commands
console.log('\nTest commands:');
console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:3000/api/clients?sortBy=name&sortOrder=asc"`);
