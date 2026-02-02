/**
 * Verification script for Features #309, #310, #311
 * Shows all workflow templates in the database
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTemplates() {
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION: Features #309, #310, #311 - Workflow Templates');
  console.log('='.repeat(80) + '\n');

  const templates = await prisma.workflow.findMany({
    where: { isTemplate: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Total Workflow Templates in Database: ${templates.length}\n`);

  const targetTemplates = [
    'Post-Closing Thank You',
    'Birthday Greetings',
    'Document Expiration Reminders'
  ];

  templates.forEach(template => {
    const isTarget = targetTemplates.includes(template.name);
    const prefix = isTarget ? '🎯 TARGET TEMPLATE:' : '  Other template:';
    const status = template.isActive ? '✅ ACTIVE' : '❌ INACTIVE';

    console.log(`${prefix} ${template.name}`);
    console.log(`  ${status} | isTemplate: ${template.isTemplate}`);
    console.log(`  ID: ${template.id}`);
    console.log(`  Trigger: ${template.triggerType}`);
    console.log(`  Actions: ${JSON.parse(template.actions).length} actions defined`);

    if (isTarget) {
      console.log(`  ✅ FEATURE REQUIREMENT MET`);
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(80));

  targetTemplates.forEach(name => {
    const template = templates.find(t => t.name === name);
    if (template && template.isActive && template.isTemplate) {
      console.log(`✅ ${name}: VERIFIED`);
    } else {
      console.log(`❌ ${name}: NOT FOUND OR INACTIVE`);
    }
  });

  console.log('\n' + '='.repeat(80) + '\n');

  await prisma.$disconnect();
}

verifyTemplates().catch(console.error);
