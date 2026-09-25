// Applies pending SQL migrations from ./drizzle. Runs before `next build`
// so every Vercel deploy brings the database schema up to date.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

try { process.loadEnvFile?.('.env'); } catch {}
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.warn('[migrate] DATABASE_URL is not set, skipping migrations.');
  process.exit(0);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
await sql.end();
console.log('[migrate] database is up to date');
