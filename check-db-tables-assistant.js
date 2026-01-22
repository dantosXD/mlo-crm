const Database = require('better-sqlite3');

async function checkTables() {
  try {
    const db = new Database('assistant.db', { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in assistant.db:');
    console.log(JSON.stringify(tables, null, 2));
    db.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTables();
