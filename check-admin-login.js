const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const admin = await prisma.user.findFirst({ where: { email: 'admin@mlo.com' } });
  console.log('Admin user:', admin ? { id: admin.id, email: admin.email, role: admin.role, isActive: admin.isActive } : 'NOT FOUND');
  await prisma.$disconnect();
})();
