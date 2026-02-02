#!/usr/bin/env node

/**
 * Quick script to check for users and create a test user if needed
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'dev.db');
const db = new Database(dbPath);

// Check for users
const users = db.prepare('SELECT id, email, role FROM users LIMIT 5').all();

console.log('\n=== Existing Users ===');
if (users.length === 0) {
  console.log('No users found. Creating test user...');

  const password = 'test123';
  const hashedPassword = bcrypt.hashSync(password, 12);

  const insert = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const userId = 'test-user-' + Date.now();
  const result = insert.run(
    userId,
    'test@mlo.com',
    hashedPassword,
    'Test MLO',
    'ADMIN',
    1
  );

  console.log('✅ Created test user:');
  console.log('   Email: test@mlo.com');
  console.log('   Password: test123');
  console.log('   Role: ADMIN');
  console.log('   ID:', userId);
} else {
  console.log(`Found ${users.length} user(s):`);
  users.forEach(user => {
    console.log(`   - ${user.email} (${user.role})`);
  });
}

db.close();
