// Generate a valid JWT token for the test user
const jwt = require('backend/node_modules/jsonwebtoken');
require('dotenv').config({ path: 'backend/.env' });

const payload = {
  userId: '8c5b0705-9864-4262-bfb3-b27af0448a69',
  role: 'MLO',
  email: 'feature100-test@example.com'
};

const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

console.log('Generated valid JWT token:');
console.log(token);
console.log('\nCopy this token and use it to set localStorage.accessToken');
