import { PrismaClient } from '@prisma/client';

async function checkDB() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany();
  console.log('Users in database:');
  users.forEach(user => {
    console.log(`- ${user.email} (${user.name}) - Role: ${user.role}, Active: ${user.isActive}`);
  });
  await prisma.$disconnect();
}

checkDB();
