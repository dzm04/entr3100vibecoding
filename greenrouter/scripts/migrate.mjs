import { readdir } from 'node:fs/promises';
import { mkdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const local = !process.env.DATABASE_URL;
if (local) await mkdir('.data', { recursive: true });
const db = local ? new PGlite('.data/postgres') : new pg.Client({ connectionString: process.env.DATABASE_URL });
if (!local) await db.connect();
try {
  const directory = new URL('../db/migrations/', import.meta.url);
  const seed = await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8');
  const execute = (sql) => local ? db.exec(sql) : db.query(sql);
  // Record the schema change in the same transaction as the migration.
  await execute('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY)');
  for (const file of (await readdir(directory)).sort()) {
    const version = /^(\d+)_.*\.sql$/.exec(file)?.[1];
    if (!version) continue;
    const applied = await db.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
    if (applied.rows.length) continue;
    const migration = await readFile(new URL(file, directory), 'utf8');
    await execute(migration.replace(/COMMIT;\s*$/, `INSERT INTO schema_migrations VALUES ('${version}'); COMMIT;`));
  }
  await execute(seed);
  const { rows } = await db.query('SELECT id, display_name FROM models ORDER BY capability_rank');
  console.table(rows);
} finally {
  if (local) await db.close();
  else await db.end();
}
