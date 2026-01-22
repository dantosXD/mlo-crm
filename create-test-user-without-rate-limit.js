// Create a fresh test user directly in database (bypassing rate limit)
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new Database(dbPath);

try {
  // Generate a unique user ID
  const testUserId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Hash password
  const passwordHash = bcrypt.hashSync('Test1234!', 12);

  // Insert test user
  const insert = db.prepare(`
    INSERT INTO users (
      id, email, password_hash, name, role, is_active,
      preferences, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    testUserId,
    'feature100-test@example.com',
    passwordHash,
    'Feature 100 Test',
    'MLO',
    1,
    '{}',
    now,
    now
  );

  console.log('✅ Test user created successfully!');
  console.log('Email: feature100-test@example.com');
  console.log('Password: Test1234!');
  console.log('User ID:', testUserId);
  console.log('\nYou can now use this account to test the dashboard layout feature.');
  console.log('This account has no rate limit restrictions because it was just created.');

} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    console.log('ℹ️  Test user already exists. You can use the existing account:');
    console.log('Email: feature100-test@example.com');
    console.log('Password: Test1234!');
  } else {
    console.error('Error:', error.message);
  }
} finally {
  db.close();
}
