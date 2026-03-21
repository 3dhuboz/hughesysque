/**
 * Shared SMS helper for Cloudflare Pages Functions.
 * Supports MessageBird (env var) and Twilio (admin settings or env vars).
 * Uses btoa() instead of Buffer — no nodejs_compat required for SMS.
 */
export async function sendSms(
  env: any,
  settings: any,
  to: string,
  body: string
): Promise<{ provider: string }> {
  if (env.MESSAGEBIRD_API_KEY) {
    const originator = env.MESSAGEBIRD_ORIGINATOR || 'HughesysQue';
    let recipient = to.replace(/\s+/g, '');
    if (recipient.startsWith('0')) recipient = '61' + recipient.slice(1);
    if (recipient.startsWith('+')) recipient = recipient.slice(1);
    const r = await fetch('https://rest.messagebird.com/messages', {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${env.MESSAGEBIRD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ originator, recipients: [recipient], body }),
    });
    if (!r.ok) {
      const err: any = await r.json().catch(() => ({ errors: [{ description: r.statusText }] }));
      throw new Error(err.errors?.[0]?.description || `MessageBird error ${r.status}`);
    }
    return { provider: 'messagebird' };
  }

  const sid = settings?.accountSid || settings?.twilioSid || env.TWILIO_ACCOUNT_SID;
  const token = settings?.authToken || settings?.twilioToken || env.TWILIO_AUTH_TOKEN;
  const from = settings?.fromNumber || settings?.twilioFrom || env.TWILIO_PHONE_NUMBER;

  if (sid && token && from) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = btoa(`${sid}:${token}`);
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', from);
    params.append('Body', body);
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data: any = await r.json();
    if (!r.ok) throw new Error(data.message || data.error_message || `Twilio error ${r.status}`);
    return { provider: 'twilio' };
  }

  throw new Error('No SMS provider configured. Set MESSAGEBIRD_API_KEY env var or Twilio credentials in admin settings.');
}
