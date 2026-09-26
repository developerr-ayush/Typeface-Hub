import 'server-only';

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/**
 * Send an email with Resend (https://resend.com) when RESEND_API_KEY and
 * EMAIL_FROM are set. Otherwise the message is written to the server log,
 * which is enough for local use.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }) {
  if (!emailConfigured()) {
    console.info(`[email] Not sent (set RESEND_API_KEY and EMAIL_FROM to send email).\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
    return { delivered: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
    signal: AbortSignal.timeout(10_000),
  }).catch((e: Error) => {
    console.error('[email] send failed:', e.message);
    return null;
  });
  if (!res?.ok) {
    console.error('[email] send failed with status', res?.status, await res?.text().catch(() => ''));
    return { delivered: false };
  }
  return { delivered: true };
}
