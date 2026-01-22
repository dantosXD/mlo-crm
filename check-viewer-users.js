const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mlo_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function checkUsers() {
  const result = await pool.query(
    "SELECT id, email, role, first_name, last_name FROM users WHERE role = 'viewer' LIMIT 5"
  );
  console.log('Viewer role users:');
  result.rows.forEach(user => {
    console.log(`  Email: ${user.email}, Role: ${user.role}, Name: ${user.first_name} ${user.last_name}`);
  });
  await pool.end();
}

checkUsers().catch(console.error);
