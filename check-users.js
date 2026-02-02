const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db');

// Check if workflow tables exist
console.log('Checking workflow database schema...\n');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%workflow%'").all();
console.log('Workflow-related tables:');
console.table(tables);

// Check workflows table structure
if (tables.find(t => t.name === 'workflows')) {
  console.log('\n✅ workflows table exists');
  const columns = db.prepare('PRAGMA table_info(workflows)').all();
  console.log('workflows columns:');
  console.table(columns);

  // Check for required columns from feature 269
  const requiredColumns = ['id', 'name', 'description', 'is_active', 'is_template', 'trigger_type', 'trigger_config', 'conditions', 'actions', 'version', 'created_by_id'];
  const existingColumns = columns.map(c => c.name);
  const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

  if (missingColumns.length === 0) {
    console.log('\n✅ All required columns present in workflows table');
  } else {
    console.log('\n❌ Missing columns in workflows table:', missingColumns);
  }
} else {
  console.log('\n❌ workflows table does NOT exist');
}

// Check workflow_executions table structure
if (tables.find(t => t.name === 'workflow_executions')) {
  console.log('\n✅ workflow_executions table exists');
  const columns = db.prepare('PRAGMA table_info(workflow_executions)').all();
  console.log('workflow_executions columns:');
  console.table(columns);

  const requiredColumns = ['id', 'workflow_id', 'client_id', 'status', 'trigger_data', 'current_step', 'started_at', 'completed_at', 'error_message', 'logs'];
  const existingColumns = columns.map(c => c.name);
  const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

  if (missingColumns.length === 0) {
    console.log('\n✅ All required columns present in workflow_executions table');
  } else {
    console.log('\n❌ Missing columns in workflow_executions table:', missingColumns);
  }
} else {
  console.log('\n❌ workflow_executions table does NOT exist');
}

// Check workflow_execution_logs table structure
if (tables.find(t => t.name === 'workflow_execution_logs')) {
  console.log('\n✅ workflow_execution_logs table exists');
  const columns = db.prepare('PRAGMA table_info(workflow_execution_logs)').all();
  console.log('workflow_execution_logs columns:');
  console.table(columns);

  const requiredColumns = ['id', 'execution_id', 'step_index', 'action_type', 'status', 'input_data', 'output_data', 'error_message', 'executed_at'];
  const existingColumns = columns.map(c => c.name);
  const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

  if (missingColumns.length === 0) {
    console.log('\n✅ All required columns present in workflow_execution_logs table');
  } else {
    console.log('\n❌ Missing columns in workflow_execution_logs table:', missingColumns);
  }
} else {
  console.log('\n❌ workflow_execution_logs table does NOT exist');
}
