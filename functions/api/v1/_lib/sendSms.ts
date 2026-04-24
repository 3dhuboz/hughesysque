/**
 * Shared SMS helper for Cloudflare Pages Functions.
 * Supports ClickSend, MessageBird, and Twilio. Provider selection is
 * implicit — we try whichever has credentials, in priority order:
 *   1. ClickSend (env vars or admin settings) — Steve's preferred provider
 *   2. MessageBird (env var only)
 *   3. Twilio (env vars or admin settings)
 * Uses btoa() instead of Buffer — no nodejs_compat required for SMS.
 *
 * Phone number normalisation for AU numbers: ClickSend and Twilio prefer
 * E.164 (+61...), MessageBird wants the same digits without the plus.
 * normaliseAuPhone produces "+614xxxxxxxx" and providers strip/keep the +
 * as needed.
 */

function normaliseAuPhone(raw: string): string {
  let p = (raw || '').replace(/[\s\-()]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('0')) return '+61' + p.slice(1);
  if (p.startsWith('61')) return '+' + p;
  return p; // assume already valid international
}

export async function sendSms(
  env: any,
  settings: any,
  to: string,
  body: string
): Promise<{ provider: string }> {
  // 1. ClickSend — username + API key. Sender id (from) optional;
  //    when omitted ClickSend assigns a shared shortcode.
  const csUser = settings?.clicksendUsername || env.CLICKSEND_USERNAME;
  const csKey = settings?.clicksendApiKey || env.CLICKSEND_API_KEY;
  if (csUser && csKey) {
    const sender = settings?.clicksendFrom || settings?.fromNumber || env.CLICKSEND_FROM || 'HughesysQ';
    const recipient = normaliseAuPhone(to);
    const auth = btoa(`${csUser}:${csKey}`);
    const r = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ source: 'hugheseysque', to: recipient, from: sender, body }] }),
    });
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(data?.response_msg || data?.data?.messages?.[0]?.status || `ClickSend error ${r.status}`);
    }
    // ClickSend returns 200 on accepted requests but the per-message status
    // may still be a failure (e.g. INVALID_RECIPIENT). Surface that.
    const msg = data?.data?.messages?.[0];
    if (msg && msg.status && msg.status !== 'SUCCESS') {
      throw new Error(`ClickSend rejected: ${msg.status}${msg.error_text ? ' - ' + msg.error_text : ''}`);
    }
    return { provider: 'clicksend' };
  }

  // 2. MessageBird — env var only.
  if (env.MESSAGEBIRD_API_KEY) {
    const originator = env.MESSAGEBIRD_ORIGINATOR || 'HughesysQue';
    let recipient = normaliseAuPhone(to);
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

  // 3. Twilio — admin settings or env vars.
  const sid = settings?.accountSid || settings?.twilioSid || env.TWILIO_ACCOUNT_SID;
  const token = settings?.authToken || settings?.twilioToken || env.TWILIO_AUTH_TOKEN;
  const from = settings?.fromNumber || settings?.twilioFrom || env.TWILIO_PHONE_NUMBER;

  if (sid && token && from) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = btoa(`${sid}:${token}`);
    const params = new URLSearchParams();
    params.append('To', normaliseAuPhone(to));
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

  throw new Error('No SMS provider configured. Add ClickSend creds (CLICKSEND_USERNAME + CLICKSEND_API_KEY env vars, or clicksendUsername + clicksendApiKey in admin SMS settings), or fall back to MessageBird/Twilio.');
}
