import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function createAdmin() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN'
    }
  });
  console.log('Admin user:', JSON.stringify({ email: admin.email, name: admin.name, role: admin.role }, null, 2));
  await prisma.$disconnect();
}

createAdmin();
