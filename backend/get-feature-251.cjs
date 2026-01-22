const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const feature = await prisma.feature.findUnique({ where: { id: 251 } });
    console.log(JSON.stringify(feature, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
