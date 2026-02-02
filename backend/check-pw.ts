import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function checkPassword() {
  const prisma = new PrismaClient();
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' }
  });

  if (admin) {
    console.log('Admin user found');
    console.log('Has passwordHash:', !!admin.passwordHash);
    console.log('isActive:', admin.isActive);

    // Test password verification
    const isValid = await bcrypt.compare('password123', admin.passwordHash);
    console.log('Password verification for "password123":', isValid);

    // Try with direct comparison
    const directHash = await bcrypt.hash('password123', 12);
    console.log('New hash matches:', admin.passwordHash === directHash);
  } else {
    console.log('Admin user NOT found');
  }

  await prisma.$disconnect();
}

checkPassword();
