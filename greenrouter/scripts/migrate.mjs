import { mkdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const local = !process.env.DATABASE_URL;
if (local) await mkdir('.data', { recursive: true });
const db = local ? new PGlite('.data/postgres') : new pg.Client({ connectionString: process.env.DATABASE_URL });
if (!local) await db.connect();
try {
  const migration = await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8');
  const execute = (sql) => local ? db.exec(sql) : db.query(sql);
  // Record the schema change in the same transaction as the migration.
  await execute('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY)');
  const applied = await db.query("SELECT version FROM schema_migrations WHERE version = '001'");
  if (applied.rows.length === 0) {
    await execute(migration.replace(/COMMIT;\s*$/, "INSERT INTO schema_migrations VALUES ('001'); COMMIT;"));
  }
  await execute(seed);
  const { rows } = await db.query('SELECT id, display_name FROM models ORDER BY capability_rank');
  console.table(rows);
} finally {
  if (local) await db.close();
  else await db.end();
}
