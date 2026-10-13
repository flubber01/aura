'use strict';
// AURA — Notfall-Benachrichtigung an den Menschen (Telegram, SMS, Anruf).
// Wird nur für Eskalationen genutzt (Kill-Switch, Integritätsverlust).
// Kein Kanal ist Pflicht. Ohne Konfiguration passiert nichts und es wird nichts vorgetäuscht.
//
//   Telegram: TELEGRAM_BOT_TOKEN + EMERGENCY_TELEGRAM_CHAT (Chat-ID)
//   SMS:      TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM + EMERGENCY_PHONE (E.164, z. B. +4917…)
//   Anruf:    wie SMS, plus EMERGENCY_PHONE_CALL (falls anders als EMERGENCY_PHONE)
//
// Geheimnisse nur über Umgebungsvariablen, nie in Dateien oder Antworten.
// Der Versand ist nicht im Sandbox-Netz getestet (nur Fake-Server in Tests).
const https = require('https');

const TIMEOUT_MS = 10000;

function cfg() {
  const e = process.env;
  return {
    tgToken: (e.TELEGRAM_BOT_TOKEN || '').trim(),
    tgChat: (e.EMERGENCY_TELEGRAM_CHAT || '').trim(),
    twSid: (e.TWILIO_ACCOUNT_SID || '').trim(),
    twToken: (e.TWILIO_AUTH_TOKEN || '').trim(),
    twFrom: (e.TWILIO_FROM || '').trim(),
    phoneSms: (e.EMERGENCY_PHONE || '').trim(),
    phoneCall: (e.EMERGENCY_PHONE_CALL || e.EMERGENCY_PHONE || '').trim(),
  };
}

const isE164 = (s) => /^\+[1-9][0-9]{6,14}$/.test(s);

function postForm(url, headers, form) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:') return reject(new Error('nur https'));
    const data = typeof form === 'string' ? form : new URLSearchParams(form).toString();
    const req = https.request(u, {
      method: 'POST',
      headers: { 'content-type': typeof form === 'string' ? 'application/json' : 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let b = ''; res.setEncoding('utf8');
      res.on('data', (c) => { b += c; if (b.length > 20000) req.destroy(new Error('response too large')); });
      res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300) ? resolve(res.statusCode) : reject(new Error('HTTP ' + res.statusCode)));
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function msgText(e) {
  return `AURA NOTFALL (${e.kind}): ${e.reason || 'kritisches Ereignis'}. Bitte bestätigen: Frist ${e.deadline}. ID ${e.id}`.slice(0, 300);
}

// Liefert { ok, channels:[{channel, ok, error?}] }. Wirft nie.
async function notifyEmergency(e) {
  const c = cfg();
  const channels = [];
  const text = msgText(e);

  if (c.tgToken && c.tgChat) {
    try {
      await postForm(`https://api.telegram.org/bot${c.tgToken}/sendMessage`, {}, JSON.stringify({ chat_id: c.tgChat, text }));
      channels.push({ channel: 'telegram', ok: true });
    } catch (err) { channels.push({ channel: 'telegram', ok: false, error: err.message }); }
  }

  const twilioOk = c.twSid && c.twToken && isE164(c.twFrom);
  const auth = twilioOk ? { authorization: 'Basic ' + Buffer.from(c.twSid + ':' + c.twToken).toString('base64') } : null;
  const base = twilioOk ? `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.twSid)}` : null;

  if (auth && isE164(c.phoneSms)) {
    try {
      await postForm(`${base}/Messages.json`, auth, { From: c.twFrom, To: c.phoneSms, Body: text });
      channels.push({ channel: 'sms', ok: true });
    } catch (err) { channels.push({ channel: 'sms', ok: false, error: err.message }); }
  }

  if (auth && isE164(c.phoneCall)) {
    const twiml = `<Response><Say language="de-DE">Achtung. AURA Notfall. ${text.replace(/[<>&]/g, ' ')}</Say></Response>`;
    try {
      await postForm(`${base}/Calls.json`, auth, { From: c.twFrom, To: c.phoneCall, Twiml: twiml });
      channels.push({ channel: 'call', ok: true });
    } catch (err) { channels.push({ channel: 'call', ok: false, error: err.message }); }
  }

  return { ok: channels.some((x) => x.ok), channels };
}

// Status ohne Geheimnisse: welche Kanäle sind eingerichtet.
function status() {
  const c = cfg();
  return {
    telegram: Boolean(c.tgToken && c.tgChat),
    sms: Boolean(c.twSid && c.twToken && isE164(c.twFrom) && isE164(c.phoneSms)),
    call: Boolean(c.twSid && c.twToken && isE164(c.twFrom) && isE164(c.phoneCall)),
    note: 'Kein Kanal eingerichtet = keine Benachrichtigung. Geheimnisse nur über Umgebungsvariablen.',
  };
}

module.exports = { notifyEmergency, status, msgText, meta: { area: 'NTF', id: 'notify', name: 'Notfall-Benachrichtigung (Telegram/SMS/Anruf)', state: 'live' } };
