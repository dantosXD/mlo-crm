const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./assistant.db');

db.get('SELECT * FROM features WHERE id = 49', (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(JSON.stringify(row, null, 2));
  }
  db.close();
});
