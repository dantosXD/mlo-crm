const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

(async () => {
  try {
    // Check for test user
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@mlo.com' },
      select: { id: true, email: true, role: true, isActive: true }
    });

    if (testUser) {
      console.log('Test user exists:', testUser.email);
    } else {
      console.log('Creating test user: test@mlo.com');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const newUser = await prisma.user.create({
        data: {
          email: 'test@mlo.com',
          passwordHash: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          firstName: 'Test',
          lastName: 'User'
        }
      });
      console.log('Created test user:', newUser.email);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
