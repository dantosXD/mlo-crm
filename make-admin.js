/**
 * Make testadmin@mlodash.com an ADMIN user
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new Database(dbPath);

// Update user role to ADMIN
const result = db.prepare('UPDATE users SET role = ? WHERE email = ?').run('ADMIN', 'testadmin@mlodash.com');

if (result.changes > 0) {
  console.log('✓ User updated to ADMIN role');
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get('testadmin@mlodash.com');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  Name:', user.name);
  console.log('  Role:', user.role);
} else {
  console.log('✗ User not found');
}

db.close();
