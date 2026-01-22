const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./assistant.db');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Tables:', JSON.stringify(rows, null, 2));
  }
  db.close();
});
