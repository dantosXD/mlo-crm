const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./assistant.db');

db.get('SELECT * FROM features WHERE id = 71', (err, row) => {
  if (err) {
    console.error(err);
  } else {
    console.log(JSON.stringify(row, null, 2));
  }
  db.close();
});
