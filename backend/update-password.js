const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updatePasswords() {
  try {
    const users = [
      { email: 'mlo@example.com', password: 'password123' },
      { email: 'admin@example.com', password: 'password123' },
    ];

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      await prisma.user.update({
        where: { email: user.email },
        data: { passwordHash },
      });

      console.log(`✅ Updated password for ${user.email}`);
    }

    console.log('\nTest credentials:');
    console.log('  MLO: mlo@example.com / password123');
    console.log('  Admin: admin@example.com / password123');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePasswords();
