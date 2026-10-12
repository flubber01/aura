'use strict';
// Agentic Mail Schnittstelle — approval-gated outbox. Sandbox never sends
// (no egress); approved items are handed to a provider adapter run elsewhere.
const crypto = require('crypto');
const store = require('./store');
const outbox = [];

function compose(body) {
  const to = String(body.to || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw Object.assign(new Error('valid recipient required'), { code: 400 });
  const item = { id: crypto.randomUUID(), to, subject: String(body.subject || '(no subject)').slice(0, 200), body: String(body.body || '').slice(0, 5000), state: 'awaiting_approval', at: new Date().toISOString() };
  outbox.push(item);
  store.audit({ area: 'MAIL', event: 'composed', id: item.id, to });
  return item;
}
function approve(id) {
  const m = outbox.find((x) => x.id === id);
  if (!m) throw Object.assign(new Error('unknown mail'), { code: 404 });
  if (m.state !== 'awaiting_approval') return m;
  m.state = 'approved_pending_egress'; // real send happens via provider adapter outside sandbox
  m.approved_at = new Date().toISOString();
  store.audit({ area: 'MAIL', event: 'approved', id });
  return m;
}
function providerKit() {
  return {
    providers: [
      { id: 'gmail', name: 'Gmail API (OAuth2)', setup: 'Google Cloud console → enable Gmail API → OAuth consent → token in secret manager; adapter sends approved items only.' },
      { id: 'imap', name: 'Own IMAP/SMTP account', setup: 'app-password in secret manager; TLS only; rate limits; never shared credentials.' },
      { id: 'telegram', name: 'Telegram transport', setup: 'reuse the BotFather bot (see /api/telegram/kit) as a mail relay to your own chat.' },
    ],
    rules: ['human approval on every send', 'recipient allowlist recommended', 'no bulk/cold outreach (anti-spam + policy)', 'unsubscribes honored'],
  };
}
module.exports = {
  meta: { area: '57', id: 'mail_adapter', name: 'Agentic mail Schnittstelle', state: 'live' },
  compose, approve, providerKit,
  list: () => outbox.slice(-50).reverse(),
  status: () => ({ outbox: outbox.length, awaiting: outbox.filter((m) => m.state === 'awaiting_approval').length, sends_from_sandbox: false }),
  actions: {
    compose: (p) => compose(p),
    approve: (p) => approve(String(p.id)),
    list: () => module.exports.list(),
    status: () => module.exports.status(),
    kit: () => providerKit(),
  },
};
