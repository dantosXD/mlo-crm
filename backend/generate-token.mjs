import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateToken() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!admin) {
    console.log('No admin user found');
    process.exit(1);
  }

  const token = jwt.sign(
    { userId: admin.id, role: admin.role },
    'dev-secret-key-change-in-production-min-32-chars',
    { expiresIn: '24h' }
  );

  console.log('\nGenerated Admin Token:');
  console.log(token);
  console.log('\nUser:', admin.email);

  await prisma.$disconnect();
}

generateToken().catch(console.error);
