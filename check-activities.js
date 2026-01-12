const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function checkActivities() {
  // Check activities with null clientId
  const orphanedActivities = await prisma.activity.findMany({
    where: { clientId: null },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('Activities with null clientId (from deleted clients):');
  orphanedActivities.forEach(a => {
    console.log('  -', a.type, ':', a.description, '| Created:', a.createdAt);
  });
  console.log('Total orphaned activities:', orphanedActivities.length);

  // Check total activities
  const totalActivities = await prisma.activity.count();
  console.log('\nTotal activities in database:', totalActivities);

  await prisma.$disconnect();
}

checkActivities().catch(console.error);
