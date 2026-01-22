const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('backend/prisma/dev.db');

try {
  // Get the test user's ID
  const testUser = db.prepare('SELECT id FROM users WHERE email = ?').get('test@example.com');
  if (!testUser) {
    console.log('Test user not found');
    process.exit(1);
  }

  console.log(`Test user ID: ${testUser.id}`);

  // Count current clients for this user
  const count = db.prepare('SELECT COUNT(*) as count FROM clients WHERE created_by_id = ?').get(testUser.id);
  console.log(`Current clients for test user: ${count.count}`);

  // Add 15 clients with status 'Active' and tag 'pagination-test'
  const tag = 'pagination-test';
  const status = 'ACTIVE';
  const userId = testUser.id;

  for (let i = count.count + 1; i <= count.count + 15; i++) {
    const id = crypto.randomUUID();
    const name = `Pagination Test Client ${i}`;
    const email = `pagination${i}@test.com`;
    const phone = `555-10${i.toString().padStart(2, '0')}`;

    // Simple encryption (base64 for testing)
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

  const newCount = db.prepare('SELECT COUNT(*) as count FROM clients WHERE created_by_id = ?').get(testUser.id);
  console.log(`\nTotal clients for test user now: ${newCount.count}`);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
