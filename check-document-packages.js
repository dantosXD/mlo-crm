const Database = require('better-sqlite3');
const db = new Database('backend/prisma/dev.db');
const packages = db.prepare('SELECT * FROM document_packages').all();
console.log('Document Packages:', JSON.stringify(packages, null, 2));
db.close();
