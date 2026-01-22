const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true }
    });
    console.log('Admin user:', JSON.stringify(admin, null, 2));

    if (admin) {
      const userWithPassword = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { passwordHash: true }
      });
      console.log('Has password hash:', !!userWithPassword.passwordHash);
      console.log('Password hash length:', userWithPassword.passwordHash?.length || 0);
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    await prisma.$disconnect();
  }
})();
