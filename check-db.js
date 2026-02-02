import { PrismaClient } from './backend/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      role: true,
      isActive: true,
    }
  });

  console.log('📊 Users in database:');
  console.log(JSON.stringify(users, null, 2));

  // Check password hash for admin user
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
    select: {
      email: true,
      passwordHash: true,
    }
  });

  if (admin) {
    console.log('\n🔑 Admin user password hash (first 50 chars):', admin.passwordHash.substring(0, 50));
  } else {
    console.log('\n❌ Admin user not found!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
