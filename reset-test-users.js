const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new Database(dbPath);

try {
  // Delete all test users that will be recreated by seed
  const emails = [
    'admin@example.com',
    'mlo@example.com',
    'manager@example.com',
    'processor@example.com',
    'underwriter@example.com',
    'viewer@example.com'
  ];

  emails.forEach(email => {
    const result = db.prepare('DELETE FROM users WHERE email = ?').run(email);
    console.log(`Deleted ${email}: ${result.changes} row(s)`);
  });

  console.log('\n✅ Test users deleted. Now run: npx tsx backend/prisma/seed.ts');

} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
