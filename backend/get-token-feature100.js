import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    userId: 'feature-100-test-user',
    email: 'feature100@example.com',
    name: 'Feature 100 Test User',
    role: 'MLO'
  },
  'your-256-bit-secret',
  { expiresIn: '24h' }
);

console.log('Token:', token);
console.log('\nUser ID:', 'feature-100-test-user');
console.log('Email:', 'feature100@example.com');
