import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { createSession, hashPassword, verifyPassword } from './auth';
import { db, schema } from './db';
import { sendEmail } from './email';
import { badRequest, HttpError } from './http';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * Start a password reset. Always behaves the same whether or not the email has
 * an account, so it can't be used to find out who is registered.
 */
export async function requestPasswordReset(email: string, origin: string) {
  const user = await db.query.users.findFirst({ where: eq(sql`lower(${schema.users.email})`, email.trim().toLowerCase()) });
  if (!user) return { link: null };
  const token = randomBytes(32).toString('base64url');
  await db.insert(schema.passwordResets).values({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });
  const link = `${origin}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your Typeface Hub password',
    text: `Hi ${user.name},\n\nSomeone asked to reset the password for your Typeface Hub account. To choose a new password, open this link within the next hour:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password won't change.\n`,
  });
  // Only for automated tests: return the link instead of relying on email.
  return { link: process.env.EXPOSE_RESET_LINKS === 'true' ? link : null };
}

export async function resetPassword(token: string, password: string) {
  const row = await db.query.passwordResets.findFirst({
    where: and(eq(schema.passwordResets.tokenHash, hashToken(token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())),
  });
  if (!row) throw badRequest('This reset link is invalid or has expired. Ask for a new one.');
  const [user] = await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(password), sessionVersion: sql`${schema.users.sessionVersion} + 1` })
    .where(eq(schema.users.id, row.userId))
    .returning();
  // One use only; also void any other outstanding links for this account.
  await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(and(eq(schema.passwordResets.userId, row.userId), isNull(schema.passwordResets.usedAt)));
  await createSession(user.id, user.sessionVersion);
  return user;
}

/** Change the password of a signed-in user; other devices are signed out, this one stays signed in. */
export async function changePassword(userId: string, current: string, next: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, 'Your current password is incorrect.');
  if (current === next) throw badRequest('Choose a password different from your current one.');
  const [updated] = await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(next), sessionVersion: sql`${schema.users.sessionVersion} + 1` })
    .where(eq(schema.users.id, userId))
    .returning();
  await createSession(updated.id, updated.sessionVersion);
}
