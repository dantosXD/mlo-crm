const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dev.db');
const db = new Database(dbPath);

// Create workflow_versions table
const createTableSQL = `
  CREATE TABLE IF NOT EXISTS workflow_versions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT,
    conditions TEXT,
    actions TEXT NOT NULL,
    created_by_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES users(id)
  );
`;

// Create indexes
const createIndexesSQL = [
  'CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions(workflow_id);',
  'CREATE INDEX IF NOT EXISTS idx_workflow_versions_version ON workflow_versions(version);',
];

try {
  // Create table
  db.exec(createTableSQL);
  console.log('✓ Created workflow_versions table');

  // Create indexes
  createIndexesSQL.forEach((sql) => {
    db.exec(sql);
  });
  console.log('✓ Created indexes for workflow_versions');

  console.log('\n✓ Workflow versioning table created successfully!');
} catch (error) {
  console.error('✗ Error creating table:', error);
  process.exit(1);
} finally {
  db.close();
}
