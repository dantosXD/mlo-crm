const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db');

// Get users table schema
const info = db.prepare('PRAGMA table_info(users)').all();
console.log('Users table schema:');
console.log(JSON.stringify(info, null, 2));

// Check if preferences column exists
const hasPreferences = info.some(col => col.name === 'preferences');
console.log('\nPreferences column exists:', hasPreferences);

// Check a sample user
const user = db.prepare('SELECT email, preferences FROM users LIMIT 1').get();
console.log('\nSample user:', user);

db.close();
