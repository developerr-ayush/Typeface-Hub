import 'server-only';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db, schema } from './db';

const COOKIE = 'th_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Values that must never be used as a real secret (old defaults and examples).
const KNOWN_WEAK = ['dev-only-insecure-secret-change-me', 'local-docker-secret-change-me-please-32chars', 'changeme', 'secret'];

let warned = false;
function secret() {
  const s = process.env.AUTH_SECRET;
  const weak = !s || s.length < 32 || KNOWN_WEAK.includes(s);
  if (weak) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set to a random value of at least 32 characters (for example: openssl rand -base64 32).');
    }
    if (!warned) {
      console.warn('[auth] AUTH_SECRET is missing or weak; using an insecure development secret.');
      warned = true;
    }
    return new TextEncoder().encode(s && s.length >= 16 ? s : 'dev-only-insecure-secret-change-me');
  }
  return new TextEncoder().encode(s);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 11);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function createSession(userId: string, sessionVersion = 0) {
  const token = await new SignJWT({ sub: userId, sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !process.env.INSECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = { id: string; email: string; name: string };

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, payload.sub),
      columns: { id: true, email: true, name: true, sessionVersion: true },
    });
    // Sessions from before the last password change are no longer valid.
    if (!user || (Number(payload.sv) || 0) !== user.sessionVersion) return null;
    return { id: user.id, email: user.email, name: user.name };
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
