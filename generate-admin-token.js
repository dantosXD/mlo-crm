import jwt from './backend/node_modules/jsonwebtoken/index.js';
import { PrismaClient } from './backend/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();
const JWT_SECRET = 'dev-secret-key-change-in-production-min-32-chars';

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' }
  });

  if (!admin) {
    console.log('Admin user not found!');
    process.exit(1);
  }

  const token = jwt.sign(
    {
      userId: admin.id,
      email: admin.email,
      role: admin.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log('Admin JWT Token:');
  console.log(token);
  console.log('\nUser info:');
  console.log(`  ID: ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role: ${admin.role}`);

  await prisma.$disconnect();
}

main().catch(console.error);
