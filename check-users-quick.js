const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db', { readonly: true });

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));

  const userTable = tables.find(t => t.name.toLowerCase().includes('user'));
  console.log('\nUser table:', userTable?.name);

  if (!userTable) {
    console.log('No user table found');
    return;
  }

  const users = db.prepare(`SELECT id, email, role FROM ${userTable.name} LIMIT 5`).all();
  console.log('\nUsers in database:');
  users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`));
} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
