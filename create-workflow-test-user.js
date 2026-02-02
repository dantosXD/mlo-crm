const bcrypt = require('./backend/node_modules/bcryptjs');
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'workflowtest@example.com' },
    update: {},
    create: {
      email: 'workflowtest@example.com',
      name: 'Workflow Test Manager',
      passwordHash: hashedPassword,
      role: 'MANAGER',
      isActive: true,
    }
  });

  console.log('User created/updated:', { id: user.id, email: user.email, role: user.role });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
