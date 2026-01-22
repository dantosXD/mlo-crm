const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.db');

db.all('SELECT id, text, due_date, created_at FROM tasks ORDER BY created_at DESC LIMIT 5', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Recent tasks:');
    rows.forEach(row => {
      console.log(`  - ${row.text}`);
      console.log(`    Due: ${row.due_date || 'NULL'}`);
      console.log(`    Created: ${row.created_at}`);
      console.log('');
    });
  }
  db.close();
});
