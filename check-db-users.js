const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new Database(dbPath);

try {
  const users = db.prepare('SELECT email, role, is_active, name FROM users').all();
  console.log('Users in database:');
  console.log('------------------');
  users.forEach(user => {
    console.log(`Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.is_active}`);
    console.log('');
  });
} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
