import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTemplates() {
  const templates = await prisma.workflow.findMany({
    where: { isTemplate: true },
    select: { id: true, name: true, isActive: true, triggerType: true }
  });

  console.log(`\n📋 Workflow Templates Found: ${templates.length}\n`);

  templates.forEach(t => {
    console.log(`✓ ${t.name}`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Trigger: ${t.triggerType}`);
    console.log(`  Active: ${t.isActive}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkTemplates().catch(console.error);
