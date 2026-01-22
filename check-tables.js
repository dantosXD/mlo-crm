const Database = require('better-sqlite3');
const db = new Database('assistant.db');
const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
const tables = stmt.all();
console.log(JSON.stringify(tables, null, 2));
db.close();
