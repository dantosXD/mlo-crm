import Database from 'better-sqlite3';
import { Client as PgClient } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

type Row = Record<string, unknown>;

const TABLES_TO_MIGRATE = [
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

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getSqlitePath(): string {
  if (process.env.SQLITE_DATABASE_PATH) {
    return process.env.SQLITE_DATABASE_PATH;
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  const backendRoot = path.resolve(path.dirname(currentFilePath), '..');
  return path.join(backendRoot, 'prisma', 'dev.db');
}

function getRows(db: Database.Database, table: string): Row[] {
  return db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as Row[];
}

async function truncateTables(pg: PgClient) {
  const tables = TABLES_TO_MIGRATE.map((table) => quoteIdentifier(table)).join(', ');
  await pg.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

async function insertRows(pg: PgClient, table: string, rows: Row[]) {
  if (rows.length === 0) {
    return;
  }

  const columns = Object.keys(rows[0]);
  const columnList = columns.map(quoteIdentifier).join(', ');

  for (const row of rows) {
    const values = columns.map((column) => {
      const value = row[column];
      if (Buffer.isBuffer(value)) {
        return value.toString();
      }
      return value;
    });

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await pg.query(
      `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES (${placeholders})`,
      values
    );
  }
}

async function validateCounts(sqlite: Database.Database, pg: PgClient) {
  console.log('\nCount Validation');
  for (const table of TABLES_TO_MIGRATE) {
    const sqliteCount = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get() as { count: number };
    const pgCountResult = await pg.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`);
    const pgCount = pgCountResult.rows[0]?.count ?? 0;
    const ok = sqliteCount.count === pgCount;
    console.log(`${ok ? 'OK' : 'FAIL'} ${table}: sqlite=${sqliteCount.count}, postgres=${pgCount}`);
    if (!ok) {
      throw new Error(`Row count mismatch for ${table}`);
    }
  }
}

async function validateDomains(pg: PgClient) {
  console.log('\nKey Domain Validation');

  const checks = [
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
  ];

  for (const check of checks) {
    const result = await pg.query(check.sql);
    const invalidCount = result.rows[0]?.invalid_count ?? 0;
    const ok = invalidCount === 0;
    console.log(`${ok ? 'OK' : 'FAIL'} ${check.name}: invalid=${invalidCount}`);
    if (!ok) {
      throw new Error(`Domain validation failed for ${check.name}`);
    }
  }
}

async function main() {
  const sqlitePath = getSqlitePath();
  const postgresUrl = process.env.DATABASE_URL;

  if (!postgresUrl) {
    throw new Error('DATABASE_URL is required (PostgreSQL target)');
  }

  console.log(`SQLite source: ${sqlitePath}`);
  console.log('PostgreSQL target: [from DATABASE_URL]');

  const sqlite = new Database(sqlitePath, { readonly: true });
  const pg = new PgClient({ connectionString: postgresUrl });
  await pg.connect();

  try {
    await pg.query('BEGIN');
    await truncateTables(pg);

    for (const table of TABLES_TO_MIGRATE) {
      const rows = getRows(sqlite, table);
      await insertRows(pg, table, rows);
      console.log(`Copied ${rows.length} rows into ${table}`);
    }

    await validateCounts(sqlite, pg);
    await validateDomains(pg);
    await pg.query('COMMIT');
    console.log('\nMigration completed successfully.');
  } catch (error) {
    await pg.query('ROLLBACK');
    console.error('\nMigration failed and was rolled back.');
    throw error;
  } finally {
    sqlite.close();
    await pg.end();
  }
}

void main();
