const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./assistant.db');
db.all('SELECT * FROM features WHERE id = 50', (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
