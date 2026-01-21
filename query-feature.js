const fs = require('fs');
const { execSync } = require('child_process');

// Try to find a way to query the database
try {
  // Check if we have any database tools available
  const dbPath = './features.db';

  if (fs.existsSync(dbPath)) {
    console.log('Found features.db at:', dbPath);
    console.log('File size:', fs.statSync(dbPath).size, 'bytes');

    // Try to use child_process to run a database query if possible
    console.log('\nAttempting to query feature #242...');
    console.log('Please run one of these commands manually:');
    console.log('1. sqlite3 features.db "SELECT * FROM features WHERE id = 242"');
    console.log('2. python -c "import sqlite3; conn = sqlite3.connect(\'features.db\'); print(conn.execute(\'SELECT id, category, name, description FROM features WHERE id = 242\').fetchone())"');
  } else {
    console.log('features.db not found');
  }
} catch (error) {
  console.error('Error:', error.message);
}
