// Generate a test JWT token for bypassing login
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-min-32-chars';

// Test user payload (matches the database user)
const payload = {
  userId: '944d46a7-aae2-443a-8e7d-d857bc86666c', // test@example.com user ID
  role: 'MLO',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
};

const token = jwt.sign(payload, JWT_SECRET);

console.log('Generated JWT Token:');
console.log(token);
console.log('\nUse this token to set localStorage:');
console.log(`localStorage.setItem('accessToken', '${token}')`);
console.log(`localStorage.setItem('user', JSON.stringify(${JSON.stringify({ userId: payload.userId, role: payload.role, name: 'Test User', email: 'test@example.com' })}))`);
