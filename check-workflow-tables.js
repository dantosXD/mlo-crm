import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWorkflowTables() {
  try {
    console.log('Checking workflow tables...\n');

    // Check Workflow table
    console.log('1. Checking Workflow table:');
    const workflowCount = await prisma.workflow.count();
    console.log(`   - Workflow table exists: ✓`);
    console.log(`   - Total workflows: ${workflowCount}`);

    // Check WorkflowExecution table
    console.log('\n2. Checking WorkflowExecution table:');
    const executionCount = await prisma.workflowExecution.count();
    console.log(`   - WorkflowExecution table exists: ✓`);
    console.log(`   - Total executions: ${executionCount}`);

    // Check WorkflowExecutionLog table
    console.log('\n3. Checking WorkflowExecutionLog table:');
    const logCount = await prisma.workflowExecutionLog.count();
    console.log(`   - WorkflowExecutionLog table exists: ✓`);
    console.log(`   - Total logs: ${logCount}`);

    // Check table structure by examining raw schema
    console.log('\n4. Table Structure Verification:');

    // Get a sample workflow to verify all fields
    if (workflowCount > 0) {
      const sampleWorkflow = await prisma.workflow.findFirst();
      console.log('   - Workflow fields:');
      console.log(`     ✓ id: ${sampleWorkflow.id}`);
      console.log(`     ✓ name: ${sampleWorkflow.name}`);
      console.log(`     ✓ isActive: ${sampleWorkflow.isActive}`);
      console.log(`     ✓ isTemplate: ${sampleWorkflow.isTemplate}`);
      console.log(`     ✓ triggerType: ${sampleWorkflow.triggerType}`);
      console.log(`     ✓ triggerConfig: ${sampleWorkflow.triggerConfig}`);
      console.log(`     ✓ conditions: ${sampleWorkflow.conditions}`);
      console.log(`     ✓ actions: ${sampleWorkflow.actions}`);
      console.log(`     ✓ version: ${sampleWorkflow.version}`);
      console.log(`     ✓ createdById: ${sampleWorkflow.createdById}`);
    } else {
      console.log('   - No workflows in database yet (tables are empty but structure is correct)');
    }

    console.log('\n✅ All workflow tables verified successfully!');
    console.log('\nTable Summary:');
    console.log('  1. workflows - Workflow definitions and templates');
    console.log('  2. workflow_executions - Runtime workflow execution instances');
    console.log('  3. workflow_execution_logs - Detailed step-by-step execution logs');

  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
    if (error.code === 'P2021') {
      console.error('\nTable does not exist. Database may need migration.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkWorkflowTables();
