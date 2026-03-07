const express = require('express');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

const router = express.Router();

// POST /api/v1/square/test — validate Square credentials
router.post('/square/test', async (req, res) => {
  const { appId, locationId, accessToken } = req.body || {};

  if (!appId || !locationId) {
    return res.status(400).json({ ok: false, message: 'Application ID and Location ID are required.' });
  }

  // Format validation
  const validFormats = ['sq0idp-', 'sandbox-sq0idp-'];
  const formatOk = validFormats.some(prefix => appId.startsWith(prefix));
  if (!formatOk) {
    return res.status(400).json({ ok: false, message: 'Invalid Application ID format — should start with sq0idp- (live) or sandbox-sq0idp- (sandbox).' });
  }

  // If access token provided, verify against Square Locations API
  if (accessToken) {
    try {
      const squareBase = appId.startsWith('sandbox-') ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
      const sqRes = await fetch(`${squareBase}/v2/locations/${locationId}`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Square-Version': '2024-01-18', 'Content-Type': 'application/json' },
      });
      const data = await sqRes.json();
      if (!sqRes.ok) {
        const errMsg = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || `HTTP ${sqRes.status}`;
        return res.status(400).json({ ok: false, message: `Square API error: ${errMsg}` });
      }
      const loc = data.location;
      return res.json({ ok: true, message: `Connected — Location: ${loc?.name || locationId} (${loc?.status || 'ACTIVE'})` });
    } catch (err) {
      return res.status(502).json({ ok: false, message: `Could not reach Square API: ${err.message}` });
    }
  }

  // No access token — format is valid, that's all we can check from server
  return res.json({ ok: true, message: 'Credentials format valid. Add a Square Access Token to run a live API test.' });
});

// POST /api/v1/sms/test — send test SMS via Twilio
router.post('/sms/test', async (req, res) => {
  const { smsSettings, to } = req.body || {};
  const { accountSid, authToken, fromNumber } = smsSettings || {};

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(400).json({ ok: false, message: 'Account SID, Auth Token and From Number are required.' });
  }
  if (!to) {
    return res.status(400).json({ ok: false, message: 'Test phone number (to) is required.' });
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      From: fromNumber,
      To: to,
      Body: 'Test SMS from your food truck app — Twilio is connected!',
    });
    const twRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await twRes.json();
    if (!twRes.ok) {
      const errMsg = data?.message || data?.code || `HTTP ${twRes.status}`;
      return res.status(400).json({ ok: false, message: `Twilio error: ${errMsg}` });
    }
    return res.json({ ok: true, message: `SMS sent — SID: ${data.sid}` });
  } catch (err) {
    return res.status(502).json({ ok: false, message: `Could not reach Twilio: ${err.message}` });
  }
});

// POST /api/v1/email/test — send test email via SMTP
router.post('/email/test', async (req, res) => {
  const { emailSettings } = req.body || {};
  const { smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail, fromName, adminEmail } = emailSettings || {};

  if (!smtpHost || !smtpUser) {
    return res.status(400).json({ ok: false, message: 'SMTP host and user are required.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort) || 465,
      secure: (parseInt(smtpPort) || 465) === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    });
    await transporter.verify();
    const to = adminEmail || fromEmail || smtpUser;
    await transporter.sendMail({
      from: `"${fromName || 'Food Truck App'}" <${fromEmail || smtpUser}>`,
      to,
      subject: 'Test Email — SMTP Connected',
      text: 'This is a test email from your food truck admin panel. SMTP is configured correctly!',
      html: '<p>This is a test email from your food truck admin panel. <strong>SMTP is configured correctly!</strong></p>',
    });
    return res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err) {
    return res.status(400).json({ ok: false, message: `SMTP error: ${err.message}` });
  }
});

module.exports = router;
