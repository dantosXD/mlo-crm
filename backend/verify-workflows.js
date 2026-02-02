// Quick verification script - no auth needed
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workflows = await prisma.workflow.findMany({
    where: { isTemplate: true },
    select: {
      id: true,
      name: true,
      triggerType: true,
      isActive: true,
      description: true,
    },
  });

  console.log('✅ FEATURE #303, #304, #305 VERIFICATION');
  console.log('='.repeat(60));
  console.log(`\nFound ${workflows.length} workflow templates:\n`);

  const expected = [
    { id: 'new-lead-welcome-workflow', name: 'New Lead Welcome Sequence', feature: 303 },
    { id: 'document-collection-workflow', name: 'Document Collection Reminder', feature: 304 },
    { id: 'status-update-workflow', name: 'Client Status Update Notification', feature: 305 },
  ];

  let allFound = true;

  expected.forEach((exp) => {
    const found = workflows.find((w) => w.id === exp.id);
    if (found) {
      console.log(`✅ Feature #${exp.feature}: ${exp.name}`);
      console.log(`   - ID: ${found.id}`);
      console.log(`   - Trigger: ${found.triggerType}`);
      console.log(`   - Active: ${found.isActive}`);
      console.log(`   - Description: ${found.description}\n`);
    } else {
      console.log(`❌ Feature #${exp.feature}: ${exp.name} NOT FOUND`);
      allFound = false;
    }
  });

  // Check communication templates
  const commTemplates = await prisma.communicationTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
    },
  });

  console.log(`\nFound ${commTemplates.length} communication templates:\n`);
  commTemplates.forEach((t) => {
    console.log(`📧 ${t.name}`);
    console.log(`   Type: ${t.type}, Category: ${t.category}`);
  });

  console.log('\n' + '='.repeat(60));

  if (allFound && workflows.length === 3) {
    console.log('\n✅ ALL FEATURES VERIFIED - Templates created successfully!\n');
    process.exit(0);
  } else {
    console.log('\n❌ VERIFICATION FAILED - Missing templates\n');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
