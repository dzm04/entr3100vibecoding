import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';

const runtime = globalThis as typeof globalThis & {
  greenRouteLocal?: PGlite;
  greenRoutePool?: Pool;
};

export async function query<Row extends Record<string, unknown>>(sql: string, params: unknown[]) {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = runtime.greenRoutePool ??= new Pool({ connectionString: url, max: 5 });
    return (await pool.query<Row>(sql, params)).rows;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production');
  const db = runtime.greenRouteLocal ??= new PGlite('.data/postgres');
  return (await db.query<Row>(sql, params)).rows;
}
