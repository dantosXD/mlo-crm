import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verifySchema() {
  try {
    // Check if workflow tables exist by querying their structure
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%workflow%'
    `;

    console.log('Workflow-related tables:', tables);

    // Try to query each workflow table to verify they exist and have the correct structure
    console.log('\n--- Checking workflows table ---');
    const workflows = await prisma.$queryRaw`PRAGMA table_info(workflows)`;
    console.log('workflows table structure:', workflows);

    console.log('\n--- Checking workflow_executions table ---');
    const executions = await prisma.$queryRaw`PRAGMA table_info(workflow_executions)`;
    console.log('workflow_executions table structure:', executions);

    console.log('\n--- Checking workflow_execution_logs table ---');
    const logs = await prisma.$queryRaw`PRAGMA table_info(workflow_execution_logs)`;
    console.log('workflow_execution_logs table structure:', logs);

    // Check foreign keys
    console.log('\n--- Checking foreign keys ---');
    const foreignKeys = await prisma.$queryRaw`
      SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('workflow_executions', 'workflow_execution_logs')
    `;
    console.log('Foreign key constraints:', foreignKeys);

  } catch (error) {
    console.error('Error verifying schema:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();
