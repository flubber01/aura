'use strict';
// Prüft Lizenzquellen, Tonstudio-Plug-ins und die Sprachfunktion mit echten Läufen.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-aud-'));
process.env.AURA_PLUGINS_AUDIO_FILE = path.join(tmp, 'audio_plugins.json');
process.env.AURA_SPEECH_FILE = path.join(tmp, 'speech.json');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const rf = require('../backend/src/lib/royalty_free');
const fx = require('../backend/src/lib/daw_plugins');
const sp = require('../backend/src/lib/speech');

// ---------------------------------------------------------------- Lizenzen
t('Lizenzquellen: jede Quelle hat Lizenz, Status und Zweck', () => {
  const l = rf.list({});
  assert.ok(l.count >= 35, 'zu wenige Quellen: ' + l.count);
  for (const s of l.items) { assert.ok(s.license, s.id + ' ohne Lizenz'); assert.ok(s.status, s.id + ' ohne Status'); assert.ok(s.terms, s.id + ' ohne Lizenzbedingungen'); }
});

t('Lizenzquellen: gemeinfreie Klassik und offene Instrumente sind drin', () => {
  const ids = rf.list({}).items.map((s) => s.id);
  for (const want of ['musopen', 'imslp', 'salamander-piano', 'generaluser-gs', 'vsco2', 'lmms', 'surge-xt', 'demucs', 'whisper']) assert.ok(ids.includes(want), want + ' fehlt');
});

t('Lizenzprüfung: CC0 erlaubt kommerziell ohne Namensnennung', () => {
  const a = rf.assess({ license: 'CC0' });
  assert.strictEqual(a.allowed, true);
  assert.strictEqual(a.obligations.length, 0);
});

t('Lizenzprüfung: CC-BY verlangt Namensnennung, CC-BY-NC sperrt Kommerz', () => {
  const by = rf.assess({ license: 'CC-BY' });
  assert.ok(by.obligations.some((o) => /Namensnennung/.test(o)));
  const nc = rf.assess({ license: 'CC-BY-NC' });
  assert.strictEqual(nc.allowed, false);
  assert.ok(nc.obligations.some((o) => /NICHT/.test(o)));
});

t('Lizenzprüfung: CC-BY-SA nennt die Weitergabe-Bedingung, unbekannte Lizenz wird nicht durchgewinkt', () => {
  assert.ok(rf.assess({ license: 'CC-BY-SA' }).obligations.some((o) => /gleicher Lizenz/.test(o)));
  const u = rf.assess({ license: 'irgendwas-erfundenes' });
  assert.strictEqual(u.allowed, false);
  assert.ok(/nachlesen/.test(u.reason));
});

t('Lizenzquellen: gesperrte Muster werden erkannt (Downloadbörsen, Reichweitenkauf)', () => {
  assert.match(rf.assess({ url: 'https://mp3skull.example/x' }).reason, /gesperrt/);
  assert.match(rf.assess({ url: 'https://followerfabrik.de/paket' }).reason, /gesperrt/);
  const st = rf.status();
  assert.ok(st.refused_patterns >= 3);
  assert.ok(st.rules.some((r) => /Kein Download/.test(r)));
});

// ---------------------------------------------------------------- Plug-ins
t('Plug-ins: Katalog ist vollständig beschrieben', () => {
  const st = fx.status();
  assert.ok(st.builtin >= 14, 'zu wenige Effekte: ' + st.builtin);
  for (const p of fx.PLUGINS) { assert.ok(p.ffmpeg, p.id + ' ohne Rechenweg'); assert.ok(p.cat, p.id + ' ohne Kategorie'); assert.ok(p.params, p.id + ' ohne Parameter'); }
});

t('Plug-ins: Kette wird korrekt sortiert — Mastering ans Ende', () => {
  const v = fx.validate([['loudnorm', {}], ['highpass', { hz: 90 }], ['compressor', {}]]);
  assert.deepStrictEqual(v.steps.map((s) => s.id), ['highpass', 'compressor', 'loudnorm']);
  assert.ok(v.warnings.some((w) => /Ende der Kette/.test(w)));
});

t('Plug-ins: Werte außerhalb des Bereichs werden geklemmt und gemeldet', () => {
  const v = fx.validate([['highpass', { hz: 99999 }]]);
  assert.strictEqual(v.steps[0].params.hz, 800);
  assert.ok(v.warnings.some((w) => /geklemmt/.test(w)));
});

t('Plug-ins: unbekannte Parameter und unbekannte Effekte fliegen mit Begründung raus', () => {
  const v = fx.validate([['eq', { low: 100, zauber: 5 }], ['super-vst-xyz', {}]]);
  assert.ok(v.warnings.some((w) => /unbekannte Parameter/.test(w)));
  assert.strictEqual(v.rejected.length, 1);
  assert.match(v.rejected[0].why, /kein eingebautes Plug-in/);
});

t('Plug-ins: Filterkette ist ffmpeg-fähig und enthält keine Audio-Filter im Videopfad', () => {
  const b = fx.buildFilters([['highpass', { hz: 90 }], ['compressor', { threshold: -20 }], ['loudnorm', {}]]);
  assert.ok(b.ok);
  assert.ok(/highpass=f=90/.test(b.chain));
  assert.ok(/acompressor=/.test(b.chain));
  assert.ok(/loudnorm=I=-14/.test(b.chain));
  assert.ok(/-af/.test(b.hint), 'Hinweis auf Audio-Kette fehlt');
});

t('Plug-ins: gespeicherte Kette bleibt erhalten und ist wieder ladbar', () => {
  const s = fx.saveChain({ name: 'Rap-Vocal', chain: [['highpass', { hz: 110 }], ['compressor', { ratio: 5 }], ['loudnorm', {}]] });
  assert.ok(s.ok, JSON.stringify(s));
  const rows = fx.actions.chains().chains;
  assert.ok(rows.some((c) => c.name === 'Rap-Vocal'));
  assert.strictEqual(fx.saveChain({ name: '', chain: [] }).ok, false);
  assert.strictEqual(fx.saveChain({ name: 'leer', chain: [['gibtsnicht', {}]] }).ok, false);
});

t('Plug-ins: Voreinstellungen sind gültige Ketten', () => {
  assert.ok(fx.PRESETS.length >= 5);
  for (const p of fx.PRESETS) { const v = fx.validate(p.chain); assert.ok(v.steps.length === p.chain.length, p.id + ' verliert Schritte'); assert.strictEqual(v.rejected.length, 0, p.id + ' hat ungültige Effekte'); }
  assert.ok(fx.status().external_open_reference.some((x) => /Calf/.test(x)));
});

// ---------------------------------------------------------------- Sprache
t('Sprache: Motoren werden wirklich gesucht, nicht behauptet', () => {
  const e = sp.engines();
  assert.strictEqual(e.engines.length, sp.ENGINES.length);
  for (const r of e.engines) assert.strictEqual(typeof r.available, 'boolean');
  assert.ok(['LIVE', 'TEILWEISE LIVE', 'NOT-CONNECTED'].includes(e.mode));
});

t('Sprache: ohne Motor steht der Auftrag sichtbar auf WAITING_FOR_ENGINE', () => {
  const st = sp.status();
  const p = sp.createProject({ title: 'Ansage', text: 'AURA ist bereit. Der Ton steht.' });
  assert.ok(p.ok, JSON.stringify(p));
  if (st.mode === 'NOT-CONNECTED') assert.strictEqual(p.project.state, 'WAITING_FOR_ENGINE');
  else assert.strictEqual(p.project.state, 'READY_TO_RENDER');
  assert.ok(/Schätzung|geschätzt/.test(p.plan.honest));
});

t('Sprache: Text wird an Satzgrenzen in Sprechstücke zerlegt', () => {
  const text = ('Das ist der erste Satz. ' + 'Und hier folgt ein zweiter Satz mit etwas mehr Text. '.repeat(6)).trim();
  const p = sp.plan({ text, voice: 'podcast-duo-a', max_chars: 100 });
  assert.ok(p.ok);
  assert.ok(p.chunks.length >= 3, 'zu wenig Stücke: ' + p.chunks.length);
  for (const c of p.chunks) { assert.ok(c.est_seconds > 0); assert.ok(c.pause_after_s > 0); }
  assert.ok(p.total_seconds > 5);
  assert.strictEqual(sp.plan({ text: '' }).ok, false);
});

t('Sprache: Podcast-Schnittliste hat fortlaufende Zeitmarken', () => {
  const out = sp.podcastOutline([{ speaker: 'A', text: 'Willkommen zur Folge.' }, { speaker: 'B', text: 'Danke, schön hier zu sein. Heute geht es um Musik.' }, { speaker: 'A', text: 'Genau, fangen wir an.' }]);
  assert.ok(out.ok);
  assert.strictEqual(out.timeline.length, 3);
  for (let i = 1; i < out.timeline.length; i++) assert.ok(out.timeline[i].starts_at >= out.timeline[i - 1].starts_at + out.timeline[i - 1].seconds - 0.01);
  assert.strictEqual(out.chapter_marks.length, 3);
  assert.strictEqual(sp.podcastOutline([]).ok, false);
});

t('Sprache: KI-Stimmen werden nur mit Schlüssel und Freigabe geführt', () => {
  const st = sp.status();
  assert.ok(st.providers_with_key_needed >= 3);
  assert.ok(st.honesty.some((h) => /Schlüssel/.test(h)));
  for (const p of sp.PROVIDERS) assert.ok(p.key, p.id + ' ohne Schlüsselangabe');
});

console.log(`\naudio_suite: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
