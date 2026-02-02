const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new Database(dbPath);

async function testLogin() {
  try {
    const email = 'mlo@example.com';
    const password = 'password123';

    console.log(`Testing login for: ${email}`);
    console.log(`Password: ${password}\n`);

    // Get user from database
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    console.log('✅ User found:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.is_active}`);
    console.log(`  Password Hash: ${user.password_hash.substring(0, 20)}...\n`);

    // Test password verification
    console.log('Testing password verification...');
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (isValid) {
      console.log('✅ Password is correct!');
    } else {
      console.log('❌ Password verification failed!');

      // Let's try hashing the password and see what we get
      const newHash = await bcrypt.hash(password, 12);
      console.log(`\nNew hash would be: ${newHash.substring(0, 20)}...`);

      // Try the old hash from create-test-user-simple.js
      const oldHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU9bK8fk.5lq';
      const oldValid = await bcrypt.compare(password, oldHash);
      console.log(`Old hash valid: ${oldValid}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.close();
  }
}

testLogin();
