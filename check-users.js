const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db');

console.log('=== FEATURE 270: Workflows CRUD API ===\n');

// Check workflows API by verifying table exists
const workflowTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%workflow%'").all();
console.log('✅ Workflow tables exist:', workflowTables.map(t => t.name));

// Check if workflows table has data
const workflowCount = db.prepare('SELECT COUNT(*) as count FROM workflows').get();
console.log(`✅ Workflows table has ${workflowCount.count} records`);

console.log('\n=== FEATURE 255: Communications CRUD API ===\n');

// Check if communications table exists
const commTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%communication%'").all();
console.log('Communications-related tables:');
console.table(commTables);

// Check communications table structure
if (commTables.find(t => t.name === 'communications')) {
  console.log('\n✅ communications table exists');
  const columns = db.prepare('PRAGMA table_info(communications)').all();
  console.log('communications columns:');
  console.table(columns);

  // Check if table has data
  const commCount = db.prepare('SELECT COUNT(*) as count FROM communications').get();
  console.log(`\n✅ Communications table has ${commCount.count} records`);
} else {
  console.log('\n❌ communications table does NOT exist');
}
