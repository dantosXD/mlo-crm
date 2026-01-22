const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db');
const users = db.prepare('SELECT id, email FROM users LIMIT 5').all();
console.log(JSON.stringify(users, null, 2));
