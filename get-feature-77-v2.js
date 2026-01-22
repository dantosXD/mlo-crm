const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./assistant.db');

db.get('SELECT * FROM features WHERE id = 77', (err, row) => {
  if (err) {
    console.error(err);
  } else if (row) {
    console.log(JSON.stringify(row, null, 2));
  } else {
    console.log('Feature #77 not found');
  }
  db.close();
});
