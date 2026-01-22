const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./features.db');

db.get('SELECT * FROM features WHERE id = 49', (err, row) => {
  if (err) {
    console.error(err);
  } else {
    console.log(JSON.stringify(row, null, 2));
  }
  db.close();
});
