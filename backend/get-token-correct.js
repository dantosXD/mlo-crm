import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    userId: '789a606c-b15d-4728-a94b-c4a93456e8b4',
    email: 'feature100@example.com',
    name: 'Feature 100 Test User',
    role: 'MLO'
  },
  'dev-secret-key-change-in-production-min-32-chars',
  { expiresIn: '24h' }
);

console.log(token);
