import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function resetPasswords() {
  const prisma = new PrismaClient();

  const adminPassword = await bcrypt.hash('password123', 12);

  await prisma.user.update({
    where: { email: 'admin@example.com' },
    data: { passwordHash: adminPassword }
  });

  console.log('Reset admin password to: password123');

  await prisma.$disconnect();
}

resetPasswords();
