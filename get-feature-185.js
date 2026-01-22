const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./features.db');

db.get('SELECT * FROM features WHERE id = 185', (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else if (row) {
    console.log('Feature 185:');
    console.log('  ID:', row.id);
    console.log('  Name:', row.name);
    console.log('  Category:', row.category);
    console.log('  Description:', row.description);
    console.log('  Steps:', row.steps);
    console.log('  Passes:', row.passes);
    console.log('  In Progress:', row.in_progress);
    console.log('  Dependencies:', row.dependencies);
    console.log('  Priority:', row.priority);
  } else {
    console.log('Feature 185 not found');
  }
  db.close();
});
