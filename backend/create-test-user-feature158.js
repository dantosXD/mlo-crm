const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createTestUser() {
  const passwordHash = await bcrypt.hash('Test1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'feature158@test.com' },
    update: {},
    create: {
      email: 'feature158@test.com',
      name: 'Feature 158 Test',
      passwordHash,
      role: 'MLO',
      isActive: true
    }
  });

  console.log('✅ Test user created/updated:');
  console.log('Email: feature158@test.com');
  console.log('Password: Test1234!');
  console.log('Role:', user.role);

  await prisma.$disconnect();
}

createTestUser().catch(console.error);
