const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new sqlite3(dbPath);

const users = db.prepare('SELECT id, email, role, isActive FROM User LIMIT 10').all();

console.log('Users in database:');
if (users.length === 0) {
  console.log('  No users found');
} else {
  users.forEach(u => {
    console.log(`  - ${u.email} (${u.role}) Active: ${u.isActive}`);
  });
}

db.close();
