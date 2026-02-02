const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@mlo.com' },
    update: {},
    create: {
      email: 'admin@mlo.com',
      passwordHash: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('User created/updated:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
