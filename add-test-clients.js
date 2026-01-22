const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('backend/prisma/dev.db');

try {
  // Count current clients
  const count = db.prepare('SELECT COUNT(*) as count FROM clients').get();
  console.log(`Current clients: ${count.count}`);

  // Add 12 clients with status 'Active' and tag 'pagination-test'
  const tag = 'pagination-test';
  const status = 'ACTIVE';
  const userId = '7bb31287-5e33-4255-95fe-d26c3194985a'; // admin user

  for (let i = count.count + 1; i <= count.count + 12; i++) {
    const id = crypto.randomUUID();
    const name = `Pagination Test Client ${i}`;
    const email = `pagination${i}@test.com`;
    const phone = `555-10${i.toString().padStart(2, '0')}`;

    // Simple encryption (base64 for testing - not secure)
    const nameEncrypted = Buffer.from(name).toString('base64');
    const emailEncrypted = Buffer.from(email).toString('base64');
    const phoneEncrypted = Buffer.from(phone).toString('base64');

    // Hash for search
    const nameHash = crypto.createHash('sha256').update(name.toLowerCase()).digest('hex');
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
    const phoneHash = crypto.createHash('sha256').update(phone).digest('hex');

    const insert = db.prepare(`
      INSERT INTO clients (id, name_encrypted, email_encrypted, phone_encrypted,
                           name_hash, email_hash, phone_hash, status, tags,
                           created_by_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    insert.run(id, nameEncrypted, emailEncrypted, phoneEncrypted,
               nameHash, emailHash, phoneHash, status, JSON.stringify([tag]), userId);

    console.log(`Created: ${name}`);
  }

  const newCount = db.prepare('SELECT COUNT(*) as count FROM clients').get();
  console.log(`\nTotal clients now: ${newCount.count}`);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
