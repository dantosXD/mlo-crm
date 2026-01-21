const Database = require('./node_modules/better-sqlite3');
const db = new Database('./features.db');
const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(243);
