import { sendEmail } from '../_lib/sendEmail';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = env.EMAIL_API_SECRET;
  if (secret && request.headers.get('x-api-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  try {
    const { settings, to } = await request.json();
    const recipient = to || settings?.adminEmail || settings?.fromEmail;
    if (!recipient) return json({ error: 'No recipient address. Set an Admin Email or From Email first.' }, 400);

    const result = await sendEmail(
      env, settings, recipient,
      'Test Email from Hughesys Que',
      'This is a test email to verify your email settings.',
      '<b>This is a test email</b> to verify your email settings. ✅'
    );
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('Email test error:', error);
    return json({ error: error.message }, 500);
  }
};
