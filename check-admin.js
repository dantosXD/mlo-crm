const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
    select: { email: true, firstName: true, lastName: true }
  });
  console.log(JSON.stringify(user, null, 2));
  await prisma.$disconnect();
}

checkAdmin();
