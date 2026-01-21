const Database = require('./node_modules/better-sqlite3');
const db = new Database('./features.db', { readonly: true });

const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(244);

if (feature) {
  console.log('Feature #244:');
  console.log('Category:', feature.category);
  console.log('Name:', feature.name);
  console.log('Description:', feature.description);
  console.log('Steps:', feature.steps);
  console.log('Passes:', feature.passes);
  console.log('In Progress:', feature.in_progress);
  console.log('Dependencies:', feature.dependencies);
} else {
  console.log('Feature #244 not found');
}

db.close();
