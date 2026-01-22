import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getFeature() {
  const feature = await prisma.feature.findUnique({
    where: { id: 50 }
  });
  console.log(JSON.stringify(feature, null, 2));
  await prisma.$disconnect();
}

getFeature().catch(console.error);
