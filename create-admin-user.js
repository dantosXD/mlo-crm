const bcrypt = require('./backend/node_modules/bcrypt');
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@mlo.com' },
    update: {},
    create: {
      email: 'admin@mlo.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    }
  });

  console.log('Admin user created/updated:', { id: user.id, email: user.email, role: user.role });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
