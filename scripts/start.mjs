// Container entrypoint: apply migrations, make sure AUTH_SECRET is strong,
// then start Next.js. If AUTH_SECRET isn't set (or is a known weak value),
// a random one is generated once and kept in the data volume.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WEAK = ['dev-only-insecure-secret-change-me', 'local-docker-secret-change-me-please-32chars', 'changeme', 'secret'];
const current = process.env.AUTH_SECRET ?? '';
if (current.length < 32 || WEAK.includes(current)) {
  const dir = join(process.cwd(), '.data');
  const file = join(dir, 'auth-secret');
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file)) {
    writeFileSync(file, randomBytes(32).toString('base64url'), { mode: 0o600 });
    console.log('[start] Generated a random AUTH_SECRET and saved it in the data volume.');
  }
  process.env.AUTH_SECRET = readFileSync(file, 'utf8').trim();
  if (current) console.warn('[start] The AUTH_SECRET you set is too weak; using the generated one instead.');
}

await import('./migrate.mjs');

const child = spawn(join(process.cwd(), 'node_modules/.bin/next'), ['start'], { stdio: 'inherit', env: process.env });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
