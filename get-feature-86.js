const Database = require('better-sqlite3');
const db = new Database('assistant.db');

// Get the table structure first
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

// If features table exists, get feature 86
if (tables.find(t => t.name === 'features')) {
  const feature = db.prepare('SELECT * FROM features WHERE id = 86').get();
  console.log('\nFeature 86:');
  console.log(JSON.stringify(feature, null, 2));
}

db.close();
