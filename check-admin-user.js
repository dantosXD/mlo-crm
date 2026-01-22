const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.sqlite');

db.get('SELECT email, password FROM users WHERE email = ?', ['admin@example.com'], (err, row) => {
  if (err) console.error('Error:', err);
  else if (row) {
    console.log('User found:', row.email);
    console.log('Password hash:', row.password);
  } else {
    console.log('No admin user found');
  }
  db.close();
});
