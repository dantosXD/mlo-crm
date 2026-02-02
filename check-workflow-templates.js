import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking workflow templates...\n');

  const templates = await prisma.workflow.findMany({
    where: {
      isTemplate: true,
    },
    include: {
      createdBy: {
        select: { name: true, email: true },
      },
    },
  });

  console.log(`Found ${templates.length} workflow templates:\n`);

  templates.forEach((template) => {
    console.log(`📋 ${template.name}`);
    console.log(`   ID: ${template.id}`);
    console.log(`   Trigger: ${template.triggerType}`);
    console.log(`   Active: ${template.isActive}`);
    console.log(`   Created by: ${template.createdBy.name} (${template.createdBy.email})`);
    console.log(`   Actions: ${JSON.parse(template.actions).length} actions`);
    console.log('');
  });

  // Check communication templates
  console.log('\nChecking communication templates...\n');

  const commTemplates = await prisma.communicationTemplate.findMany({
    where: {
      isActive: true,
    },
  });

  console.log(`Found ${commTemplates.length} communication templates:\n`);

  commTemplates.forEach((template) => {
    console.log(`📧 ${template.name}`);
    console.log(`   Type: ${template.type}`);
    console.log(`   Category: ${template.category}`);
    console.log(`   Subject: ${template.subject || 'N/A'}`);
    console.log(`   Active: ${template.isActive}`);
    console.log('');
  });
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
