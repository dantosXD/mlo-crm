const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db');
const users = db.prepare('SELECT id, email, role, name FROM users').all();
console.log(JSON.stringify(users, null, 2));
db.close();
