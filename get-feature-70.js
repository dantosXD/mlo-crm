const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const feature = await prisma.feature.findUnique({ where: { id: 70 } });
  console.log(JSON.stringify(feature, null, 2));
  await prisma.$disconnect();
})();
