const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db');
const packages = db.prepare('SELECT id, name, description FROM document_packages').all();
console.log('Packages in DB:', JSON.stringify(packages, null, 2));
db.close();
