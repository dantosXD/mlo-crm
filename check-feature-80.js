const Database = require('better-sqlite3');

async function checkFeature80() {
  try {
    const db = new Database('features.db', { readonly: true });
    const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(80);
    console.log(JSON.stringify(feature, null, 2));
    db.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkFeature80();
