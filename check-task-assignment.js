const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mlo_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function checkTaskAssignment() {
  const result = await pool.query(`
    SELECT t.id, t.text, t.assigned_to_id, u.name as assigned_to_name, u.role as assigned_to_role
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to_id = u.id
    WHERE t.text LIKE '%TEST_TASK_ASSIGN_76%'
  `);

  if (result.rows.length > 0) {
    const task = result.rows[0];
    console.log('Task Assignment Verified:');
    console.log(`  Task ID: ${task.id}`);
    console.log(`  Task Text: ${task.text}`);
    console.log(`  Assigned To ID: ${task.assigned_to_id}`);
    console.log(`  Assigned To Name: ${task.assigned_to_name}`);
    console.log(`  Assigned To Role: ${task.assigned_to_role}`);
  } else {
    console.log('ERROR: Task not found in database!');
  }

  await pool.end();
}

checkTaskAssignment().catch(console.error);
