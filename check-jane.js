const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mlo_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function checkJane() {
  const result = await pool.query(
    "SELECT id, email, role, name FROM users WHERE name ILIKE '%Jane%' OR role = 'MANAGER'"
  );
  console.log('Manager users:');
  result.rows.forEach(user => {
    console.log(`  Email: ${user.email}, Role: ${user.role}, Name: ${user.name}`);
  });
  await pool.end();
}

checkJane().catch(console.error);
