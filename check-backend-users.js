const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db', { readonly: true });

try {
  const users = db.prepare('SELECT id, email, role FROM User LIMIT 5').all();
  console.log('Users in database:');
  users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`));
} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
