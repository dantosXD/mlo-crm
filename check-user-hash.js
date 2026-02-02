const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new Database(dbPath);

try {
  const email = 'mlo@example.com';
  const user = db.prepare('SELECT email, password_hash FROM users WHERE email = ?').get(email);

  if (user) {
    console.log('User:', user.email);
    console.log('Hash length:', user.password_hash.length);
    console.log('Hash starts with:', user.password_hash.substring(0, 10));
    console.log('Full hash:', user.password_hash);
  } else {
    console.log('User not found');
  }
} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
