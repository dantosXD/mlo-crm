const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'assistant.db'));
const feature = db.prepare('SELECT * FROM features WHERE id = 92').get();
console.log(JSON.stringify(feature, null, 2));
db.close();
