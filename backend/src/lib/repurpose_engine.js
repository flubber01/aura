'use strict';
// AURA WF-18 — Repurposing-Engine (Phase 2, §31 B1): 1 Inhalt → 8 Formate.
//
// - Rein regelbasiert und deterministisch: KEIN LLM, es werden keine Fakten erfunden.
//   Alle Texte stammen aus dem eingegebenen Inhalt oder sind Platzhalter wie {PAGE_LINK}.
// - Jedes Format ist ein ENTWURF mit requires_approval=true (REGEL 1: Admin-Freigabe).
//   Diese Engine veröffentlicht NICHTS.
// - Synthetisches Engagement / gekauftes Wachstum wird im Text hart abgelehnt.
const crypto = require('crypto');
const growthStore = require('./growth_store');

const FORMATS = ['shorts', 'tiktok', 'quotes', 'blog', 'telegram', 'newsletter', 'youtube_description', 'music_snippet'];

// Harte Ablehnung: Texte, die gekauftes Wachstum oder Bot-Traffic bewerben.
const BANNED = /(follower[s]?\s*kaufen|likes?\s*kaufen|views?\s*kaufen|buy\s+(followers?|likes?|views?|comments?)|bot[- ]?traffic|fake\s+(views?|likes?|clicks?|comments?)|engagement[- ]?(pods?|farm))/i;

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
const sentences = (text) => clean(text, 20000)
  .split(/(?<=[.!?])\s+/)
  .map((s) => s.trim())
  .filter((s) => s.length >= 25 && s.length <= 220);

function validateInput(c) {
  const errs = [];
  if (!c || typeof c !== 'object') return ['content object required'];
  if (!c.title || String(c.title).trim().length < 3) errs.push('title required (min 3 chars)');
  if (!c.body || String(c.body).trim().length < 80) errs.push('body required (min 80 chars)');
  if (c.rights_ok !== true) errs.push('rights_ok must be true — nur eigene oder lizenzierte Inhalte (REGEL 1)');
  if (c.url !== undefined && c.url !== '' && !/^https:\/\/[^\s]+$/.test(String(c.url))) errs.push('url must be https');
  if (c.type !== undefined && !['article', 'video', 'track', 'note'].includes(c.type)) errs.push('type must be article|video|track|note');
  if (BANNED.test(String(c.title || '') + ' ' + String(c.body || ''))) errs.push('Inhalt enthält gekauftes Wachstum/Bot-Traffic — abgelehnt (§31 E: kein synthetisches Engagement)');
  return errs;
}

function keywords(title) {
  return clean(title, 200).split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 5)
    .slice(0, 3)
    .map((w) => '#' + w);
}

// Each builder returns { status, text|markdown, notes }.
const builders = {
  shorts(c, s) {
    if (!s.length) return { status: 'skipped', notes: 'zu wenig Sätze im Text' };
    const hook = clean(s[0], 90);
    const beats = s.slice(1, 5).map((x, i) => `Beat ${i + 1}: ${clean(x, 140)}`);
    return { status: 'draft', text: [`Hook: ${hook}`, ...beats, 'CTA: {PAGE_LINK}'].join('\n'), notes: 'Ziel ≤ 60 s · Schnitt-Vorschlag, kein Auto-Upload' };
  },
  tiktok(c) {
    const caption = clean(c.title, 100) + ' — {PAGE_LINK}';
    return { status: 'draft', text: [caption, keywords(c.title).join(' ')].filter(Boolean).join('\n'), notes: 'Caption ≤ 150 Zeichen empfohlen' };
  },
  quotes(c, s) {
    const picks = s.filter((x) => x.length >= 40 && x.length <= 140).slice(0, 3);
    if (!picks.length) return { status: 'skipped', notes: 'keine passenden Zitat-Sätze (40–140 Zeichen)' };
    return { status: 'draft', text: picks.map((q, i) => `Quote ${i + 1}: „${q}“`).join('\n'), notes: 'Quote-Karten · Quelle im Text belassen' };
  },
  blog(c) {
    const paras = clean(c.body, 20000).split(/\n{2,}|(?<=[.!?])\s{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
    const md = [`# ${clean(c.title, 120)}`, '', ...paras.slice(0, 12).flatMap((p) => [p, ''])];
    if (c.url) md.push(`Quelle: ${c.url}`, '');
    md.push('{PAGE_LINK_INTERN}');
    return { status: 'draft', markdown: md.join('\n'), notes: 'Entwurf für eine eigene Page · Crosslinks füllt der Traffic Mesh' };
  },
  telegram(c, s) {
    const body = [clean(c.title, 120), '', ...s.slice(0, 2).map((x) => clean(x, 200)), '', '{TELEGRAM_LINK}'].join('\n');
    return { status: 'draft', text: body.slice(0, 900), notes: 'Telegram-Post ≤ 900 Zeichen' };
  },
  newsletter(c, s) {
    const subject = clean(c.title, 60);
    const bullets = s.slice(0, 3).map((x) => '• ' + clean(x, 160));
    return { status: 'draft', text: [`Betreff: ${subject}`, `Vorschau: ${clean(s[0] || c.title, 90)}`, '', ...bullets, '', '{PAGE_LINK}'].join('\n'), notes: 'Newsletter-Block · Versand nur nach Freigabe' };
  },
  youtube_description(c, s) {
    const lines = [clean(c.title, 100), '', ...s.slice(0, 3).map((x) => clean(x, 200)), '', 'Mehr: {PAGE_LINK}', 'Telegram: {TELEGRAM_LINK}'];
    return { status: 'draft', text: lines.join('\n'), notes: 'Beschreibung für Video/Short · Links vom Mesh' };
  },
  music_snippet(c) {
    if (c.type !== 'track') return { status: 'skipped', notes: 'nur für type=track' };
    if (!c.audio_snippet_ref) return { status: 'skipped', notes: 'kein audio_snippet_ref (Snippet-Datei fehlt)' };
    return { status: 'draft', text: `Snippet: ${clean(c.audio_snippet_ref, 200)}\nTitel: ${clean(c.title, 100)}\nCTA: {PLATFORM_LINKS}`, notes: 'Teaser-Snippet · Rechte-Nachweis liegt bei WF-19' };
  },
};

function repurpose(content) {
  const errors = validateInput(content);
  if (errors.length) return { ok: false, errors };

  const s = sentences(content.body);
  const drafts = FORMATS.map((format) => {
    const out = builders[format](content, s);
    const text = out.text || out.markdown || '';
    const warnings = BANNED.test(text) ? ['abgelehnt: gekauftes Wachstum/Bot-Traffic im Text'] : [];
    if (warnings.length) return { format, status: 'rejected', notes: warnings[0], warnings, requires_approval: true };
    return { format, ...out, chars: text.length, requires_approval: true, warnings };
  });

  const record = {
    id: 'RP-' + crypto.randomBytes(4).toString('hex'),
    wf: 'WF-18',
    title: clean(content.title, 160),
    type: content.type || 'article',
    at: new Date().toISOString(),
    drafts,
    counts: {
      draft: drafts.filter((d) => d.status === 'draft').length,
      skipped: drafts.filter((d) => d.status === 'skipped').length,
      rejected: drafts.filter((d) => d.status === 'rejected').length,
    },
    state: 'awaiting_approval',
  };
  const db = growthStore.load();
  db.repurpose.unshift(record);
  db.repurpose = db.repurpose.slice(0, 200);
  growthStore.save(db);
  return { ok: true, record };
}

function list() {
  return { wf: 'WF-18', formats: FORMATS, items: growthStore.load().repurpose.slice(0, 50).map((r) => ({ id: r.id, title: r.title, at: r.at, counts: r.counts, state: r.state })) };
}

module.exports = { repurpose, list, FORMATS, BANNED, validateInput };
