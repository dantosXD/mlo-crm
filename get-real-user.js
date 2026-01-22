const { PrismaClient } = require('./backend/node_modules/.prisma/client');
const jwt = require('./backend/node_modules/jsonwebtoken');

const prisma = new PrismaClient();

async function getRealUserToken() {
  // Get a real user from database
  const user = await prisma.user.findFirst({
    where: { email: 'admin@example.com' }
  });

  if (!user) {
    console.log('No admin user found');
    return;
  }

  console.log('Found user:', user.id, user.email, user.role);

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const JWT_SECRET = 'dev-secret-key-change-in-production-min-32-chars';

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h'
  });

  console.log('\nReal user token:');
  console.log(token);

  console.log('\nTest commands:');
  console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:3000/api/clients?sortBy=name&sortOrder=asc"`);
  console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:3000/api/clients?sortBy=name&sortOrder=desc"`);
  console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:3000/api/clients?sortBy=email&sortOrder=asc"`);
  console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:3000/api/clients"`);

  await prisma.$disconnect();
}

getRealUserToken().catch(console.error);
