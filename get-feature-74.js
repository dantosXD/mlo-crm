const Database = require('better-sqlite3');
const db = new Database('features.db', { readonly: true });
const stmt = db.prepare('SELECT * FROM features WHERE id = 74');
const feature = stmt.get();
if (feature) {
  // Parse JSON fields
  feature.steps = JSON.parse(feature.steps);
  feature.dependencies = feature.dependencies ? JSON.parse(feature.dependencies) : [];
  console.log(JSON.stringify(feature, null, 2));
} else {
  console.log('Feature #74 not found');
}
db.close();
