const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findUnique({
    where: { id: 'c440f06f-83c1-4532-a947-c6455764ae7c' }
  });
  console.log('Client createdById:', client ? client.createdById : 'not found');

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
