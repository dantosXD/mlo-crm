const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getFeature(id) {
  const feature = await prisma.feature.findUnique({
    where: { id: parseInt(id) }
  });
  console.log(JSON.stringify(feature, null, 2));
  await prisma.$disconnect();
}

getFeature(process.argv[2]);
