const Database = require('better-sqlite3');
const db = new Database('features.db', { readonly: true });

const feature = db.prepare('SELECT id, name, description, category, steps FROM features WHERE id = 51').get();

if (feature) {
  console.log('Feature #51:');
  console.log('ID:', feature.id);
  console.log('Name:', feature.name);
  console.log('Category:', feature.category);
  console.log('Description:', feature.description);
  console.log('Steps:', feature.steps);
} else {
  console.log('Feature #51 not found');
}

db.close();
