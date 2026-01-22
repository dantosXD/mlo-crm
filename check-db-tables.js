const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db', { readonly: true });

try {
  // First get all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database:');
  tables.forEach(t => console.log(`- ${t.name}`));

  // Then try users table with proper column selection
  const users = db.prepare('SELECT id, email, role, password_hash FROM users LIMIT 5').all();
  console.log('\nUsers in database:');
  users.forEach(u => console.log(`- Email: ${u.email}, Role: ${u.role}, hasPassword: ${!!u.password_hash}`));
} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
