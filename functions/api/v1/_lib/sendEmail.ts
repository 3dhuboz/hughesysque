/**
 * Shared email helper for Cloudflare Pages Functions.
 * Uses Resend API — pure fetch, zero Node.js packages, CF Workers native.
 */

import { fetchWithTimeout } from './fetchWithTimeout';

export async function sendEmail(
  env: any,
  settings: any,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<{ messageId: string; provider: string }> {
  const fromEmail = settings?.fromEmail || env.RESEND_FROM_EMAIL || 'noreply@hugheseysque.au';
  const fromName = settings?.fromName || env.RESEND_FROM_NAME || 'Hughesys Que';

  if (!env.RESEND_API_KEY) {
    throw new Error('No email provider configured. Set RESEND_API_KEY in Cloudflare Pages environment variables.');
  }

  // Diagnostic — purely so the CF logs make it obvious whether sender
  // identity is coming from the admin settings row or the deploy env.
  // Resend API key itself is env-only; from-name/from-email may be either.
  const fromSource = (settings?.fromEmail || settings?.fromName) ? 'settings' : 'env';
  console.info(`[email] resend api key (source: env), from (source: ${fromSource})`);

  const r = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Resend error ${r.status}: ${err.slice(0, 200)}`);
  }

  const data: any = await r.json().catch(() => ({}));
  return { messageId: data.id || '', provider: 'resend' };
}
