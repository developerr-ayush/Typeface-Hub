import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function connectionString() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set it.');
  return url;
}

// Reuse one pool per server instance (and across hot reloads in dev).
const sql =
  globalForDb.sql ??
  postgres(connectionString(), {
    max: process.env.VERCEL ? 5 : 10,
    prepare: false, // required for Neon / PgBouncer pooled connections
    idle_timeout: 20,
  });
if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
export type DB = typeof db;
