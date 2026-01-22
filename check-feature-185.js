const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./assistant.db');

db.get('SELECT id, name, passes, in_progress FROM features WHERE id = 185', (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else if (row) {
    console.log('Feature 185 found:', JSON.stringify(row, null, 2));
  } else {
    console.log('Feature 185 does not exist in the database');
  }
  db.close();
});
