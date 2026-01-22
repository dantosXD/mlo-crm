const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.db');

db.all('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tables in database:');
    rows.forEach(row => {
      console.log(`  - ${row.name}`);
    });
  }
  db.close();
});
