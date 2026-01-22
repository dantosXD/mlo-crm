const sqlite3 = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'backend', 'prisma', 'dev.db');
const db = new sqlite3(dbPath);

// Check if user exists
const existingUser = db.prepare('SELECT * FROM User WHERE email = ?').get('test@example.com');

if (existingUser) {
  console.log('User test@example.com already exists');
  console.log('ID:', existingUser.id);
} else {
  // Hash password
  const passwordHash = bcrypt.hashSync('test123', 10);

  // Insert user
  const insert = db.prepare(`
    INSERT INTO User (id, email, passwordHash, role, isActive, firstName, lastName, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const userId = 'user-' + Date.now();
  const result = insert.run(userId, 'test@example.com', passwordHash, 'ADMIN', 1, 'Test', 'User');

  console.log('Created user:');
  console.log('  Email: test@example.com');
  console.log('  Password: test123');
  console.log('  ID:', userId);
}

db.close();
