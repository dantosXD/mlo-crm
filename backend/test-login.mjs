import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function testLogin() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
    select: { id: true, email: true, name: true, passwordHash: true, role: true }
  });

  if (!user) {
    console.log('Admin user NOT found');
  } else {
    console.log('Admin user found:', { email: user.email, name: user.name, role: user.role });

    // Test password
    const isValid = await bcrypt.compare('password123', user.passwordHash);
    console.log('Password "password123" valid:', isValid);

    // Also test with a fresh hash
    const freshHash = await bcrypt.hash('password123', 10);
    const freshValid = await bcrypt.compare('password123', freshHash);
    console.log('Fresh hash test:', freshValid);
  }

  await prisma.$disconnect();
}

testLogin();
