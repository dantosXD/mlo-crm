const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Check for test users
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'test' } },
          { email: 'admin@mlo.com' }
        ]
      },
      select: { id: true, email: true, role: true, isActive: true }
    });

    console.log('Test users found:', testUsers.length);
    testUsers.forEach(u => console.log(`  - ${u.email} (${u.role})`));

    // If no test users, create one
    if (testUsers.length === 0) {
      console.log('\nCreating test user: test@example.com');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('test123', 10);
      const newUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          firstName: 'Test',
          lastName: 'User'
        }
      });
      console.log('Created:', newUser.email);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
