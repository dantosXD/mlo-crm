const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const feature = await prisma.feature.findUnique({
      where: { id: 82 }
    });

    if (feature) {
      console.log('Feature #82 Details:');
      console.log('=====================');
      console.log('ID:', feature.id);
      console.log('Priority:', feature.priority);
      console.log('Category:', feature.category);
      console.log('Name:', feature.name);
      console.log('Description:', feature.description);
      console.log('Steps:', feature.steps);
      console.log('Passes:', feature.passes);
      console.log('In Progress:', feature.inProgress);
      console.log('Dependencies:', feature.dependencies || 'none');
    } else {
      console.log('Feature #82 not found');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
