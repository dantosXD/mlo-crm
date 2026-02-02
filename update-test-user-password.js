// Set a known password for the mlo@example.com test user
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new Database(dbPath);

try {
  // Pre-hashed password for "password123" using bcrypt
  const passwordHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU9bK8fk.5lq';

  const update = db.prepare(`
    UPDATE users
    SET password_hash = ?
    WHERE email = 'mlo@example.com'
  `);

  const result = update.run(passwordHash);

  console.log('✅ Password updated for mlo@example.com');
  console.log('Email: mlo@example.com');
  console.log('Password: password123');

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
