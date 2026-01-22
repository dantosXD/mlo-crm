const db = require('better-sqlite3')('features.db');
const feature = db.prepare('SELECT * FROM features WHERE id = 250').get();
console.log(JSON.stringify(feature, null, 2));
