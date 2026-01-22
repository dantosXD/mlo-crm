const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const feature = await prisma.feature.findUnique({
      where: { id: 74 }
    });
    console.log(JSON.stringify(feature, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
