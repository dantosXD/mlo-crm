const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const Database = require('better-sqlite3');
const db = new Database('features.db');
const f = db.prepare('SELECT * FROM features WHERE id = ?').get(243);
console.log(JSON.stringify(f));
db.close();
