const db = require('./backend/database/db');
const feature = db.prepare('SELECT * FROM features WHERE id = 69').get();
console.log(JSON.stringify(feature, null, 2));
