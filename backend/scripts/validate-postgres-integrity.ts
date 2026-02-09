import { Client as PgClient } from 'pg';

const TABLES = [
  'users',
  'clients',
  'workflows',
  'tasks',
  'reminders',
  'refresh_tokens',
  'notes',
  'documents',
  'events',
] as const;

const DOMAIN_CHECKS = [
  {
    name: 'tasks.client_id -> clients.id',
    sql: `SELECT COUNT(*)::int AS invalid_count
          FROM tasks t
          WHERE t.client_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = t.client_id)`,
  },
  {
    name: 'tasks.created_by_id -> users.id',
    sql: `SELECT COUNT(*)::int AS invalid_count
          FROM tasks t
          WHERE t.created_by_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.created_by_id)`,
  },
  {
    name: 'reminders.user_id -> users.id',
    sql: `SELECT COUNT(*)::int AS invalid_count
          FROM reminders r
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)`,
  },
  {
    name: 'workflows.created_by_id -> users.id',
    sql: `SELECT COUNT(*)::int AS invalid_count
          FROM workflows w
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = w.created_by_id)`,
  },
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new PgClient({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log('PostgreSQL integrity check starting...');

    for (const table of TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const count = result.rows[0]?.count ?? 0;
      console.log(`TABLE ${table}: ${count}`);
    }

    for (const check of DOMAIN_CHECKS) {
      const result = await client.query(check.sql);
      const invalidCount = result.rows[0]?.invalid_count ?? 0;
      console.log(`DOMAIN ${check.name}: invalid=${invalidCount}`);
      if (invalidCount > 0) {
        throw new Error(`Domain validation failed for ${check.name}`);
      }
    }

    console.log('PostgreSQL integrity check passed.');
  } finally {
    await client.end();
  }
}

void main();
