const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new Database(dbPath);

try {
  // Check if column already exists
  const pragma = db.prepare("PRAGMA table_info(users)").all();
  const hasPreferences = pragma.some(col => col.name === 'preferences');

  if (!hasPreferences) {
    console.log('Adding preferences column to users table...');
    db.exec('ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT "{}"');
    console.log('✓ Column added successfully');
  } else {
    console.log('✓ Column preferences already exists');
  }

  // Verify
  const check = db.prepare("PRAGMA table_info(users)").all();
  console.log('\nCurrent users table structure:');
  check.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
