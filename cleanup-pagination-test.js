const Database = require('better-sqlite3');

const db = new Database('backend/prisma/dev.db');

try {
  // Delete clients with tag 'pagination-test'
  const clients = db.prepare('SELECT id, name_encrypted FROM clients WHERE tags LIKE ?').all('%"pagination-test"%');

  console.log(`Found ${clients.length} clients with 'pagination-test' tag`);

  const deleteStmt = db.prepare('DELETE FROM clients WHERE id = ?');
  const deleteMany = db.transaction((clients) => {
    for (const client of clients) {
      deleteStmt.run(client.id);
      // Decode the name to show what we deleted
      const name = Buffer.from(client.name_encrypted, 'base64').toString('utf-8');
      console.log(`Deleted: ${name}`);
    }
  });

  deleteMany(clients);

  const remaining = db.prepare('SELECT COUNT(*) as count FROM clients').get();
  console.log(`\nRemaining clients: ${remaining.count}`);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
