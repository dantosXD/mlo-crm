const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mlo_dashboard',
  user: 'mlo_user',
  password: 'mlo_password'
});

(async () => {
  try {
    const res = await pool.query('SELECT id, name FROM clients LIMIT 1');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
