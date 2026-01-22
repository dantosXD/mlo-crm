const Database = require('better-sqlite3');
const path = require('path');

// Try features.db first
try {
  const db = new Database('./features.db', { readonly: true });
  const feature = db.prepare('SELECT * FROM features WHERE id = 69').get();
  console.log(JSON.stringify(feature, null, 2));
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
