'use strict';
// AURA — Ultra-Scout: prüft einmal am Tag öffentliche GitHub-Repos (nur Metadaten, nur lesen)
// und legt Vorschläge an. Nichts wird installiert, nichts wird ausgeführt.
// Der Mensch entscheidet: freigeben (nur zur weiteren Prüfung) oder ablehnen.
// Echte Tests in einer Sandbox sind ein eigener, später gebauter Schritt (Isolation nötig).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_ULTRA_FILE || path.join(__dirname, '..', '..', 'data', 'ultra_proposals.json');
const MAX_KEEP = 200;
const DAY_MS = 24 * 3600 * 1000;
const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0'];
const MIN_STARS = Number(process.env.AURA_ULTRA_MIN_STARS || 50);
const AGENT_RE = /agent|system|bot|auto/i;

// Suchen, die zu AURA passen. Nur öffentliche Topics.
const QUERIES = [
  'topic:ai-agent',
  'topic:workflow-automation',
  'topic:youtube-automation',
  'topic:music-production',
  'topic:wordpress-plugin',
  'topic:mcp-server',
];
// Schlagwörter, die für AURA relevant sind (Gewicht je Treffer).
const KEYWORDS = ['agent', 'workflow', 'pipeline', 'youtube', 'medium', 'wordpress', 'newsletter', 'rss', 'music', 'daw', 'plugin', 'mcp', 'skill', 'automation', 'approval', 'monitor'];
// Sofort ausschließen (Umgehung, Missbrauch, Mining, gekaufte Reichweite, Credential-Sammlung).
const BLOCK = /captcha.?bypass|bypass|crack|keygen|warez|miner|mining|faucet|botnet|follower|smm|views?\s+kaufen|fake\s+views|exploit|credential.?(dump|steal)/i;

function load() {
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(d.proposals) ? d : { proposals: [] }; }
  catch { return { proposals: [] }; }
}
function save(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(d, null, 2) + '\n');
  fs.renameSync(FILE + '.tmp', FILE);
}

// Reine Prüfung auf Basis der Metadaten. Kein Download, kein Ausführen.
function assess(repo) {
  const checks = {};
  const text = [repo.full_name, repo.description || '', ...(repo.topics || [])].join(' ');
  checks.archiviert = repo.archived ? 'ja' : 'nein';
  checks.fork = repo.fork ? 'ja' : 'nein';
  const lic = repo.license && repo.license.spdx_id;
  checks.lizenz = lic || 'keine';
  checks.sperrwoerter = BLOCK.test(text) ? 'treffer' : 'ok';
  const pushed = Date.parse(repo.pushed_at || '') || 0;
  checks.aktualitaet = pushed && Date.now() - pushed < 180 * DAY_MS ? 'ok' : 'alt';
  checks.sterne = repo.stargazers_count || 0;

  const reasons = [];
  if (repo.archived) reasons.push('archiviert');
  if (repo.fork) reasons.push('Fork');
  if (!ALLOWED_LICENSES.includes(lic)) reasons.push('Lizenz nicht freigegeben (' + (lic || 'keine') + ')');
  if (checks.sperrwoerter === 'treffer') reasons.push('Sperrwort im Text');
  if (checks.sterne < MIN_STARS) reasons.push('zu wenige Sterne (' + checks.sterne + ' < ' + MIN_STARS + ')');
  if (checks.aktualitaet !== 'ok') reasons.push('länger nicht aktualisiert');

  const matched = KEYWORDS.filter((k) => text.toLowerCase().includes(k));
  const score = matched.length * 2 + Math.min(5, Math.log10(Math.max(1, checks.sterne)));
  return { ok: reasons.length === 0, reasons, checks, matched, score: Math.round(score * 10) / 10 };
}

async function fetchRepos(query, fetchImpl) {
  const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(query + ' archived:false') + '&sort=updated&order=desc&per_page=20';
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'aura-ultra-scout' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const res = await fetchImpl(url, { headers });
  if (!res.ok) throw new Error('GitHub ' + res.status + ' bei „' + query + '“');
  const body = await res.json();
  return Array.isArray(body.items) ? body.items : [];
}

// Einmal-Lauf. fetchImpl ist für Tests austauschbar.
async function runScout({ fetchImpl = globalThis.fetch, queries = QUERIES } = {}) {
  const d = load();
  const known = new Set(d.proposals.map((p) => p.full_name));
  const found = new Map();
  const errors = [];
  for (const q of queries) {
    try {
      for (const r of await fetchRepos(q, fetchImpl)) if (!found.has(r.full_name)) found.set(r.full_name, r);
    } catch (e) { errors.push(e.message); }
  }
  let added = 0, rejected = 0;
  for (const repo of found.values()) {
    if (known.has(repo.full_name)) continue;
    const a = assess(repo);
    if (!a.ok) { rejected++; continue; }
    d.proposals.unshift({
      id: 'UP-' + crypto.randomBytes(3).toString('hex'),
      full_name: repo.full_name,
      url: repo.html_url,
      description: String(repo.description || '').slice(0, 300),
      license: repo.license ? repo.license.spdx_id : null,
      stars: repo.stargazers_count || 0,
      pushed_at: repo.pushed_at || null,
      matched: a.matched, score: a.score, checks: a.checks,
      status: 'vorgeschlagen',
      decision: null,
      created_at: new Date().toISOString(),
      note: 'Nur Metadaten geprüft. Nichts installiert, nichts ausgeführt.',
    });
    known.add(repo.full_name);
    added++;
  }
  d.proposals = d.proposals.slice(0, MAX_KEEP);
  d.last_run = { at: new Date().toISOString(), scanned: found.size, added, filtered_out: rejected, errors };
  save(d);
  return d.last_run;
}

// Entscheidung des Menschen. Freigabe heißt nur „zur weiteren Prüfung“, nie Einbau.
function decide(id, { decision, by }) {
  const who = String(by || '').trim();
  if (who.length < 2 || who.length > 40) return { ok: false, status: 400, error: 'by: Name der Person angeben' };
  if (AGENT_RE.test(who)) return { ok: false, status: 403, error: 'Entscheidung nur durch einen Menschen' };
  if (!['approve', 'reject'].includes(decision)) return { ok: false, status: 400, error: 'decision: approve | reject' };
  const d = load();
  const p = d.proposals.find((x) => x.id === id);
  if (!p) return { ok: false, status: 404, error: 'Vorschlag nicht gefunden' };
  if (p.status !== 'vorgeschlagen') return { ok: false, status: 409, error: 'bereits entschieden: ' + p.status };
  p.status = decision === 'approve' ? 'freigegeben_zur_pruefung' : 'abgelehnt';
  p.decision = { by: who, at: new Date().toISOString() };
  save(d);
  return { ok: true, status: 200, proposal: p };
}

function list() { const d = load(); return { proposals: d.proposals, last_run: d.last_run || null }; }

let timer = null;
// Täglicher Lauf. Erster Lauf nach delayMs, damit der Start nicht blockiert.
function startDaily({ delayMs = 10 * 60 * 1000 } = {}) {
  if (process.env.AURA_ULTRA_SCOUT === '0' || timer) return false;
  const tick = () => runScout().catch(() => {});
  const first = setTimeout(tick, delayMs); if (first.unref) first.unref();
  timer = setInterval(tick, DAY_MS); if (timer.unref) timer.unref();
  return true;
}

module.exports = {
  FILE, QUERIES, KEYWORDS, ALLOWED_LICENSES, assess, runScout, decide, list, startDaily,
  meta: { area: 'ULTRA', id: 'ultra_scout', name: 'Ultra-Scout (täglich, nur Metadaten, nur Vorschläge)', state: 'live' },
};
