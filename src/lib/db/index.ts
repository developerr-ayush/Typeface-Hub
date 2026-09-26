import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;
const globalForDb = globalThis as unknown as { db?: DB };

function connect(): DB {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set it.');
  const sql = postgres(url, {
    max: process.env.VERCEL ? 5 : 10,
    prepare: false, // required for Neon / PgBouncer pooled connections
    idle_timeout: 20,
  });
  return drizzle(sql, { schema });
}

// Connect on first use (not at import), so builds work without a database.
// One pool per server instance, reused across hot reloads in dev.
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    globalForDb.db ??= connect();
    const value = Reflect.get(globalForDb.db, prop);
    return typeof value === 'function' ? value.bind(globalForDb.db) : value;
  },
});

export { schema };
export type { DB };
