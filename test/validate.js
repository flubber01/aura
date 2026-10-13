#!/usr/bin/env node
'use strict';
// AURA validation sweep — hits every page + API on the running server,
// checks status codes and JSON validity, verifies data files, reports failures.
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.AURA_URL || 'http://127.0.0.1:8080';
const results = { pass: 0, fail: 0, items: [] };

function get(p, timeout = 20000) {
  return new Promise((resolve) => {
    const req = http.get(BASE + p, { timeout }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; if (d.length > 8e6) req.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, body: d, type: res.headers['content-type'] || '' }));
    });
    req.on('error', (e) => resolve({ status: 0, body: String(e.message), type: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout', type: '' }); });
  });
}

async function checkPage(p) {
  const r = await get(p);
  const ok = r.status === 200 && /<html/i.test(r.body) && r.body.length > 500;
  results.items.push({ kind: 'page', path: p, ok, detail: r.status + ' · ' + r.body.length + 'B' });
}

async function checkApi(p, validate) {
  const r = await get(p);
  let ok = r.status === 200;
  let detail = r.status + '';
  if (ok && /json/.test(r.type)) {
    try {
      const j = JSON.parse(r.body);
      if (validate) { const v = validate(j); if (v !== true) { ok = false; detail += ' · ' + v; } }
      detail += ' · JSON ok · ' + r.body.length + 'B';
    } catch (e) { ok = false; detail += ' · BAD JSON: ' + e.message; }
  } else if (ok) detail += ' · ' + r.type + ' · ' + r.body.length + 'B';
  results.items.push({ kind: 'api', path: p, ok, detail });
}

function post(p, body, timeout = 20000) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const u = new URL(BASE + p);
    const req = http.request({ hostname: u.hostname, port: u.port, path: p, method: 'POST', timeout,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } },
      (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, body: d, type: res.headers['content-type'] || '' })); });
    req.on('error', (e) => resolve({ status: 0, body: String(e.message), type: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout', type: '' }); });
    req.write(data); req.end();
  });
}

async function checkPost(p, body, validate) {
  const r = await post(p, body);
  let ok = r.status === 200 || r.status === 201;
  let detail = r.status + '';
  if (ok && /json/.test(r.type)) {
    try { const j = JSON.parse(r.body); if (validate) { const v = validate(j); if (v !== true) { ok = false; detail += ' · ' + v; } } detail += ' · JSON ok'; }
    catch (e) { ok = false; detail += ' · BAD JSON'; }
  }
  results.items.push({ kind: 'api', path: p + ' (POST)', ok, detail });
}

async function checkSSE(p) {
  // SSE streams forever — assert it OPENS with 200 + text/event-stream, then abort
  const r = await new Promise((resolve) => {
    const req = http.get(BASE + p, (res) => {
      resolve({ status: res.statusCode, type: res.headers['content-type'] || '' });
      req.destroy();
    });
    req.on('error', (e) => resolve({ status: 0, type: String(e.message) }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, type: 'timeout' }); });
  });
  const ok = r.status === 200 && /event-stream/.test(r.type);
  results.items.push({ kind: 'sse', path: p, ok, detail: r.status + ' · ' + r.type });
}

async function checkStatus(p, expected, label) {
  const r = await get(p);
  results.items.push({ kind: 'enforce', path: p + ' (' + label + ')', ok: r.status === expected, detail: 'status ' + r.status + ' (expected ' + expected + ')' });
}

async function checkRefusedPost(p, body, label) {
  const r = await post(p, body);
  results.items.push({ kind: 'enforce', path: p + ' (' + label + ')', ok: r.status === 403, detail: 'status ' + r.status + ' (expected 403)' });
}

async function main() {
  const pages = ['/hub', '/brain', '/master', '/console', '/skills', '/downloads',
    '/pipelines', '/yellowpages', '/deploy', '/cluster', '/hierarchy', '/ops', '/terminal',
    '/minibot', '/ignition', '/arcade', '/schedule', '/builder', '/research', '/seo',
    '/logs', '/config', '/containers', '/jarvis'];
  for (const p of pages) await checkPage(p);
  // root must redirect to the multi-screen hub (Gehirn 2.0 reachable from there)
  const rootRes = await get('/');
  results.items.push({ kind: 'page', path: '/ → /hub redirect', ok: rootRes.status === 302, detail: 'status ' + rootRes.status });

  const j = (fn) => fn;
  await checkApi('/api/health', j((d) => d.status === 'ok' || 'health.status missing'));
  await checkApi('/api/modules', j((d) => Array.isArray(d) || 'not array'));
  await checkApi('/api/modules/live');
  await checkApi('/api/integrations');
  await checkApi('/api/types');
  await checkApi('/api/skills');
  await checkApi('/api/departments', j((d) => (d.departments || []).length >= 10 || '<10 departments'));
  await checkApi('/api/roles', j((d) => (Array.isArray(d) ? d : d.roles || []).length >= 50 || '<50 roles'));
  await checkApi('/api/prompts?dept=research&role=researcher', j((d) => d.prompt && d.prompt.length > 20 || 'no prompt'));
  await checkApi('/api/workflows');
  await checkApi('/api/xrefs');
  await checkApi('/api/brain');
  await checkApi('/api/master');
  await checkApi('/api/downloads');
  await checkApi('/api/yellowpages', j((d) => (d.links || []).length >= 60 || '<60 links'));
  await checkApi('/api/teams', j((d) => Array.isArray(d) || 'not array'));
  await checkApi('/api/hierarchy');
  await checkApi('/api/ops');
  await checkApi('/api/vita');
  await checkSSE('/api/stream'); // SSE: headers only, never ends
  await checkApi('/api/telegram/kit');
  await checkApi('/api/mail');
  await checkPost('/api/ultra/chat', { msg: 'validation ping' });
  await checkApi('/api/ignition', j((d) => (d.catalog || []).length >= 20 || '<20 catalog entries'));
  await checkApi('/api/schedule');
  await checkApi('/api/schedule/recommend');
  await checkApi('/api/watcher', j((d) => Array.isArray(d.events) || 'no events[]'));
  await checkApi('/api/builder/workflows', j((d) => Array.isArray(d.presets) && Array.isArray(d.custom) || 'shape wrong'));
  await checkApi('/api/research?q=dashboard&per=3', j((d) => d.ok === true || 'research failed: ' + JSON.stringify(d.subQueryErrors)));
  await checkApi('/api/seo', j((d) => d.audited >= 10 || '<10 pages audited'));
  await checkApi('/api/backups', j((d) => d.count >= 5 || '<5 snapshots'));
  await checkApi('/api/traffic', j((d) => typeof d.totalRequests === 'number' || 'no counters'));
  await checkPost('/api/kill', { arm: false, reason: 'validation sweep' });
  await checkApi('/api/notebook-export');
  await checkApi('/sitemap.xml');
  await checkApi('/robots.txt');
  await checkApi('/api/logs', j((d) => Array.isArray(d.lines) || 'no lines[]'));
  await checkApi('/api/selfrepair', j((d) => (d.counters && typeof d.counters.checks === 'number') || 'no counters'));

  // ---- Area 67: containers — crash isolation drill + auto recovery ----
  await checkApi('/api/containers', j((d) => Array.isArray(d.containers) && d.containers.length >= 20 || 'container list missing'));
  await checkPost('/api/containers/drill', { area: '16', cooldown_ms: 4000 }, j((d) => d.ok === true || 'drill failed'));
  const duringQ = await get('/api/modules/16/action/status');
  results.items.push({ kind: 'enforce', path: 'quarantined module returns 429', ok: duringQ.status === 429, detail: 'status ' + duringQ.status });
  await new Promise((r) => setTimeout(r, 4500)); // wait out the drill cooldown
  const afterQ = await get('/api/modules/16/action/status');
  results.items.push({ kind: 'enforce', path: 'container auto-recovers after cooldown', ok: afterQ.status === 200, detail: 'status ' + afterQ.status });

  // ---- Area 68: config CRUD (set → verify → invalid rejected → reset) ----
  await checkApi('/api/config/schema', j((d) => (d.schema && d.schema.containers) ? true : 'no schema'));
  const cfgSet = await post('/api/config', { budget: { monthly_cap_eur: 25 } });
  results.items.push({ kind: 'api', path: '/api/config POST valid', ok: cfgSet.status === 200, detail: 'status ' + cfgSet.status });
  const cfgGet = await get('/api/config');
  const cfgOk = cfgGet.status === 200 && JSON.parse(cfgGet.body).config.budget.monthly_cap_eur === 25;
  results.items.push({ kind: 'api', path: '/api/config value applied', ok: cfgOk, detail: cfgOk ? 'cap=25' : 'cap not applied' });
  const cfgBad = await post('/api/config', { budget: { monthly_cap_eur: -5 }, bogus: {} });
  results.items.push({ kind: 'enforce', path: '/api/config rejects invalid', ok: cfgBad.status === 400, detail: 'status ' + cfgBad.status });
  await post('/api/config/reset', {});

  // ---- J.A.R.V.I.S. (real assistant over live data) ----
  await checkPost('/api/jarvis', { msg: 'status' }, j((d) => (d.reply && d.mode === 'LIVE') ? true : 'no reply'));
  await checkPost('/api/jarvis', { msg: 'learning' }, j((d) => /generation/i.test(d.reply || '') ? true : 'learning answer missing'));

  // ---- Area 69: recursive learning core — the once-only rule ----
  const simr = await post('/api/learning/simulate', {});
  const simj = simr.status === 200 ? JSON.parse(simr.body) : {};
  const sig = simj.recorded && simj.recorded.fingerprint;
  results.items.push({ kind: 'api', path: '/api/learning/simulate records+scores', ok: Boolean(sig && simj.outcome && simj.outcome.ok), detail: sig || 'no fingerprint' });
  const lc1 = await get('/api/learning');
  const lcj = JSON.parse(lc1.body);
  results.items.push({ kind: 'api', path: '/api/learning curve shape', ok: Boolean(lcj.rule && Array.isArray(lcj.known_failures)), detail: lcj.rule ? 'rule present' : 'missing' });
  results.items.push({ kind: 'enforce', path: 'learning rule: fingerprint tracked', ok: lcj.known_failures.some((f) => f.fingerprint === sig), detail: sig || 'missing' });

  // ---- 1-click repro report ----
  await checkApi('/api/repro', j((d) => (d.ok === true && d.checks && d.commit) ? true : 'repro incomplete'));

  // ---- enforcement: refused paths MUST stay refused ----
  await checkStatus('/api/modules/32/action/status', 403, 'restricted faucet');
  await checkStatus('/api/modules/33/action/status', 403, 'restricted mining');
  await checkStatus('/api/modules/36/action/status', 403, 'restricted captcha-bypass');
  await checkRefusedPost('/api/socialchain', { platform: 'test', gates: {} }, 'social chain without gates');
  await checkRefusedPost('/api/socialchain', { platform: 'test', gates: { human_approval: true } }, 'social chain missing no-synthetic gate');
  // ---- kill switch cycle: engage → 423 on actions → revive ----
  await post('/api/kill', { arm: true, reason: 'validation sweep: engage' });
  const gated = await get('/api/modules/24/action/status');
  results.items.push({ kind: 'enforce', path: 'kill-switch 423 while engaged', ok: gated.status === 423, detail: 'status ' + gated.status });
  const revive = await post('/api/kill', { arm: false, reason: 'validation sweep: revive' });
  results.items.push({ kind: 'enforce', path: 'kill-switch revive', ok: revive.status === 200, detail: 'status ' + revive.status });
  const after = await get('/api/modules/24/action/status');
  results.items.push({ kind: 'enforce', path: 'actions unblocked after revive', ok: after.status === 200, detail: 'status ' + after.status });

  // ---- Phase 2 growth: WF-18 · Traffic Mesh · WF-19 · Unified Analytics ----
  await checkPage('/growth');
  await checkApi('/api/growth/repurpose', (j) => Array.isArray(j.items) && Array.isArray(j.formats) && j.formats.length === 8 ? true : 'formats/items fehlen');
  await checkApi('/api/growth/mesh', (j) => (j.proposals && j.assets && Array.isArray(j.orphans)) ? true : 'mesh shape');
  await checkApi('/api/growth/releases', (j) => Array.isArray(j.releases) && j.stages.length === 9 ? true : 'releases/stages');
  await checkApi('/api/growth/analytics', (j) => (j.connectors && j.connectors.length === 5 && j.labels) ? true : 'connectors/labels');
  await checkPost('/api/growth/repurpose', {
    title: 'Phase 2 Validierung Inhalt',
    body: 'Dies ist ein eigener Testtext für die Validierung. Er hat genug Zeichen für die Mindestlänge. Der zweite Satz beschreibt einen neuen Track. Der dritte Satz kündigt die Veröffentlichung an.',
    rights_ok: true,
  }, (j) => (j.ok && j.record.drafts.length === 8 && j.record.drafts.every((d) => d.requires_approval === true)) ? true : 'expected 8 drafts, all approval-gated');
  const rpBad = await post('/api/growth/repurpose', { title: 'Kurz', body: 'zu kurz', rights_ok: false });
  results.items.push({ kind: 'enforce', path: 'WF-18 rejects invalid input (400)', ok: rpBad.status === 400, detail: 'status ' + rpBad.status });
  const rpBanned = await post('/api/growth/repurpose', { title: 'Kampagne Test', body: 'Wir wollen follower kaufen, damit der Kanal wächst und mehr Reichweite entsteht. Das ist der Plan für diesen Monat.', rights_ok: true });
  results.items.push({ kind: 'enforce', path: 'WF-18 rejects bought-growth text (400)', ok: rpBanned.status === 400, detail: 'status ' + rpBanned.status });
  const meshHttp = await post('/api/growth/mesh/asset', { id: 'val-page-1', type: 'page', url: 'http://example.invalid', owned: true });
  results.items.push({ kind: 'enforce', path: 'mesh rejects non-https / non-owned asset (400)', ok: meshHttp.status === 400, detail: 'status ' + meshHttp.status });
  const meshForeign = await post('/api/growth/mesh/asset', { id: 'val-yt-1', type: 'youtube_channel', url: 'https://www.youtube.com/@val', owned: false });
  results.items.push({ kind: 'enforce', path: 'mesh rejects owned=false (400)', ok: meshForeign.status === 400, detail: 'status ' + meshForeign.status });
  const rel = await post('/api/growth/releases', { track: { title: 'Validierung Track', genre: 'ambient', duration_s: 120 } });
  let relId = null; try { relId = JSON.parse(rel.body).release.id; } catch {}
  results.items.push({ kind: 'api', path: '/api/growth/releases (POST)', ok: rel.status === 201 && !!relId, detail: rel.status + ' · ' + (relId || 'no id') });
  if (relId) {
    const skip = await post('/api/growth/releases/' + relId + '/advance', { target: 'calendar_slot', release_date: '2099-01-01' });
    results.items.push({ kind: 'enforce', path: 'WF-19 refuses to skip a gate (409)', ok: skip.status === 409, detail: 'status ' + skip.status });
  }
  const impBad = await post('/api/growth/analytics/import', { platform: 'myspace', rows: [{ content_ref: 'x', date: '2026-10-10', views: 1 }] });
  results.items.push({ kind: 'enforce', path: 'analytics rejects unknown platform (400)', ok: impBad.status === 400, detail: 'status ' + impBad.status });
  const dash = await get('/api/growth/analytics');
  let honest = false; try { const j = JSON.parse(dash.body); honest = j.connectors.every((c) => ['LIVE', 'IMPORTED', 'CONFIGURED', 'NOT-CONNECTED'].includes(c.state)); } catch {}
  results.items.push({ kind: 'enforce', path: 'analytics only uses honest labels', ok: honest, detail: honest ? 'labels ok' : 'unknown label' });

  // ---- Agent Board (Kanban für Agenten): Seite, API, Gates, Freigabe nur durch Mensch ----
  await checkPage('/board');
  await checkApi('/api/board', (j) => (Array.isArray(j.columns) && j.columns.length === 6 && Array.isArray(j.roles) && j.roles.length > 0) ? true : 'board shape');
  const bBad = await post('/api/board/task', { title: 'x', goal: 'kurz', needs: ['research'] });
  results.items.push({ kind: 'enforce', path: 'board rejects invalid task (400)', ok: bBad.status === 400, detail: 'status ' + bBad.status });
  const bNew = await post('/api/board/task', { title: 'Validierung Board', goal: 'Automatischer Testlauf des Boards', needs: ['research'] });
  const bId = bNew.status === 201 ? JSON.parse(bNew.body).task.id : null;
  results.items.push({ kind: 'enforce', path: 'board creates task (201)', ok: bNew.status === 201 && !!bId, detail: 'status ' + bNew.status });
  if (bId) {
    const bAssign = await post('/api/board/' + bId + '/assign', {});
    const bAssignedTo = bAssign.status === 200 ? JSON.parse(bAssign.body).task.owner : null;
    results.items.push({ kind: 'enforce', path: 'board assigns by capability (200, owner set)', ok: bAssign.status === 200 && !!bAssignedTo, detail: 'status ' + bAssign.status });
    const bStart = await post('/api/board/' + bId + '/start', {});
    results.items.push({ kind: 'enforce', path: 'board start (200)', ok: bStart.status === 200, detail: 'status ' + bStart.status });
    const bEarly = await post('/api/board/' + bId + '/approve', { by: 'Validator' });
    results.items.push({ kind: 'enforce', path: 'board no approve before review (409)', ok: bEarly.status === 409, detail: 'status ' + bEarly.status });
    const bOther = await post('/api/board/' + bId + '/submit', { by: 'fremde-rolle', result: 'Ergebnis vom falschen Agenten, sollte abgelehnt werden.' });
    results.items.push({ kind: 'enforce', path: 'board submit by non-owner denied (403)', ok: bOther.status === 403, detail: 'status ' + bOther.status });
    const bSub = await post('/api/board/' + bId + '/submit', { by: bAssignedTo, result: 'Automatischer Testlauf: Ergebnis eingereicht.' });
    results.items.push({ kind: 'enforce', path: 'board submit by owner (200)', ok: bSub.status === 200, detail: 'status ' + bSub.status });
    const bAgentOk = await post('/api/board/' + bId + '/approve', { by: 'Bot-Agent' });
    results.items.push({ kind: 'enforce', path: 'board agent cannot approve (403)', ok: bAgentOk.status === 403, detail: 'status ' + bAgentOk.status });
    const bRoleOk = await post('/api/board/' + bId + '/approve', { by: bAssignedTo });
    results.items.push({ kind: 'enforce', path: 'board role id cannot approve (403)', ok: bRoleOk.status === 403, detail: 'status ' + bRoleOk.status });
    const bHuman = await post('/api/board/' + bId + '/approve', { by: 'Validator' });
    results.items.push({ kind: 'enforce', path: 'board human approves (200)', ok: bHuman.status === 200, detail: 'status ' + bHuman.status });
  }

  // ---- J.A.R.V.I.S.: Seite, Antwort mit Modus, LLM-Status ehrlich (ohne Ollama -> Engine) ----
  await checkPage('/jarvis');
  await checkApi('/api/jarvis/llm', (j) => typeof j.configured === 'boolean' && typeof j.reachable === 'boolean' ? true : 'llm status shape');
  const jv = await post('/api/jarvis', { msg: 'status' });
  let jvOk = jv.status === 200;
  try { const j = JSON.parse(jv.body); jvOk = jvOk && typeof j.reply === 'string' && typeof j.mode === 'string' && j.llm && typeof j.llm.used === 'boolean'; } catch { jvOk = false; }
  results.items.push({ kind: 'api', path: '/api/jarvis (POST status)', ok: jvOk, detail: 'status ' + jv.status + (jvOk ? ' · reply+mode+llm ok' : ' · shape') });


  // data files valid JSON
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'backend', 'data'))) {
    if (!f.endsWith('.json')) continue;
    try {
      JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'data', f), 'utf8'));
      results.items.push({ kind: 'data', path: f, ok: true, detail: 'valid JSON' });
    } catch (e) { results.items.push({ kind: 'data', path: f, ok: false, detail: e.message }); }
  }

  for (const it of results.items) {
    if (it.ok) results.pass++; else results.fail++;
    console.log((it.ok ? 'PASS' : 'FAIL') + ' [' + it.kind + '] ' + it.path + ' — ' + it.detail);
  }
  console.log('\n=== VALIDATION: ' + results.pass + ' pass / ' + results.fail + ' fail ===');
  process.exit(results.fail ? 1 : 0);
}
main();
