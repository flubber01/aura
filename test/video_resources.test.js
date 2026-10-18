'use strict';
// Tests: Video-Werkstatt (Effektketten für ffmpeg) und Ressourcen-Katalog.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-'));
process.env.AURA_VIDEO_FILE = path.join(tmp, 'video_jobs.json');
process.env.AURA_VIDEO_DIR = path.join(tmp, 'video');
const vs = require('../backend/src/lib/video_studio');
const rs = require('../backend/src/lib/resources');

// ---------------------------------------------------------------- Video
test('Effekt-Katalog deckt Bild, Farbe, Ton und Übergänge ab', () => {
  const types = vs.effects().map((e) => e.type);
  for (const t of ['blur', 'sharpen', 'chroma_key', 'text', 'watermark', 'brightness', 'contrast', 'speed', 'fade', 'loudnorm', 'vignette', 'grayscale']) {
    assert.ok(types.includes(t), 'fehlt: ' + t);
  }
  assert.ok(types.length >= 25, 'zu klein: ' + types.length);
});

test('Filterkette wird gebaut — Bild und Ton getrennt', () => {
  const c = vs.buildChain([
    { type: 'crop', w: 1080, h: 1080 },
    { type: 'chroma_key', color: '0x00ff00' },
    { type: 'contrast', value: 1.2 },
    { type: 'loudnorm' },
  ]);
  assert.strictEqual(c.warnings.length, 0);
  assert.strictEqual(c.parts.length, 4);
  // Bild-Effekte in die Bildkette
  assert.ok(c.chain.startsWith('crop=1080:1080'));
  assert.ok(c.chain.includes('chromakey=0x00ff00'));
  assert.ok(c.chain.includes('eq=contrast=1.2'));
  // Ton-Effekte NICHT in die Bildkette (loudnorm ist ein Audio-Filter)
  assert.ok(!c.chain.includes('loudnorm'), 'Audio-Filter darf nicht in -vf landen');
  assert.strictEqual(c.audio_chain, 'loudnorm=I=-14:TP=-1.5:LRA=11');
});

test('nur Ton-Effekte reichen für einen Video-Auftrag nicht', () => {
  const r = vs.createJob({ input: __filename, effects: [{ type: 'loudnorm' }] }, 'x');
  assert.strictEqual(r.code, 400);
  assert.match(r.error, /BILD-Effekt/);
});

test('Werte werden begrenzt, kaputte Eingaben nicht durchgereicht', () => {
  assert.match(vs.buildChain([{ type: 'brightness', value: 99 }]).chain, /brightness=1$/);
  assert.match(vs.buildChain([{ type: 'blur', strength: -5 }]).chain, /sigma=0.1/);
  assert.match(vs.buildChain([{ type: 'speed', factor: 0 }]).chain, /setpts=1\.0000/);
  const c = vs.buildChain([{ type: 'blur' }, { type: 'unsinn' }]);
  assert.strictEqual(c.warnings.length, 1);
  assert.match(c.warnings[0], /unbekannter Effekt/);
});

test('Text-Anführungszeichen können die Kette nicht aufbrechen', () => {
  const c = vs.buildChain([{ type: 'text', text: "böse':x='1" }]);
  assert.ok(!/text='[^']*'[^:]*:[^']*'/.test(c.chain.replace(/^drawtext=/, '')), 'Kette enthält ungeschützte Anführungszeichen');
  assert.strictEqual(c.parts.length, 1);
});

test('ohne ffmpeg wird ehrlich abgesagt und der Installationsbefehl mitgegeben', () => {
  const st = vs.ffmpegStatus();
  if (st.available) return;                        // auf einer Maschine mit ffmpeg übersprungen
  const job = vs.createJob({ input: __filename, effects: [{ type: 'blur' }] }, 'Sabr47');
  assert.strictEqual(job.ok, true);
  return vs.run(job.job.id, 'Sabr47').then((r) => {
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 'BLOCKED_NO_FFMPEG');
    assert.match(r.install, /apt-get install/);
    assert.ok(r.chain.includes('gblur'), 'Kette muss trotzdem fertig sein');
  });
});

test('Vorschau zeigt den exakten Befehl mit -vf und -af, ohne etwas auszuführen', () => {
  const p = vs.preview({ input: 'clip.mp4', effects: [{ type: 'blur', strength: 6 }, { type: 'grayscale' }, { type: 'volume', db: -3 }] });
  assert.strictEqual(p.warnings.length, 0);
  assert.match(p.preview_command, /-vf "gblur=sigma=6,hue=s=0"/);
  assert.match(p.preview_command, /-af "volume=-3dB"/);
  assert.ok(!fs.existsSync(path.join(process.env.AURA_VIDEO_DIR, 'clip.mp4')));
});

test('fehlende Filter werden erkannt statt blind zu rendern', () => {
  const probe = vs.probeFilters();
  if (!probe.available) return;                       // ohne ffmpeg nicht prüfbar
  const eff = vs.effects();
  assert.ok(eff.every((e) => e.available === true || e.available === false));
  const ohneText = eff.filter((e) => e.available === false).map((e) => e.type);
  // wenn ein Filter fehlt, muss der Grund genannt werden
  for (const t of ohneText) {
    const cap = vs.effectCapability(t);
    assert.ok(cap.reason && cap.reason.length > 10, 'kein Grund bei ' + t);
    assert.ok(cap.needs.length > 0);
  }
});

test('Auftrag ohne Datei oder ohne Effekt wird abgelehnt', () => {
  assert.strictEqual(vs.createJob({ effects: [{ type: 'blur' }] }, 'x').code, 400);
  assert.strictEqual(vs.createJob({ input: __filename, effects: [] }, 'x').code, 400);
  assert.strictEqual(vs.createJob({ input: '/gibt/es/nicht.mp4', effects: [{ type: 'blur' }] }, 'x').code, 400);
});

test('Video-Zustand heilt die Speicherdatei', () => {
  if (fs.existsSync(process.env.AURA_VIDEO_FILE)) fs.unlinkSync(process.env.AURA_VIDEO_FILE);
  const st = vs.status();
  assert.strictEqual(st.area, 'VIDEO');
  assert.ok(fs.existsSync(process.env.AURA_VIDEO_FILE));
});

// ---------------------------------------------------------------- Ressourcen
test('Katalog enthält die gefragten Sammlungen', () => {
  const ids = rs.all().map((i) => i.id);
  for (const id of ['free-for-dev', 'awesome', 'awesome-selfhosted', 'awesome-music', 'public-apis', 'build-your-own-x']) {
    assert.ok(ids.includes(id), 'fehlt: ' + id);
  }
});

test('Katalog deckt Audio, Video, Bild, Text, Betrieb und Doku ab', () => {
  const st = rs.status();
  for (const c of ['AUDIO', 'VIDEO', 'IMAGE', 'TEXT', 'DEV', 'SELFHOST', 'DOCS', 'LIST']) {
    assert.ok(st.by_category[c] > 0, 'Kategorie leer: ' + c);
  }
  assert.ok(st.total >= 40, 'Katalog zu klein: ' + st.total);
});

test('jeder Eintrag hat Zweck und Lizenzhinweis', () => {
  for (const i of rs.all()) {
    assert.ok(i.id && i.name && i.url && i.cat, 'unvollständig: ' + JSON.stringify(i));
    assert.match(i.url, /^https:\/\//, 'kein https: ' + i.url);
    assert.ok(i.license || i.cat === 'LIST', 'kein Lizenzhinweis: ' + i.id);
    assert.ok(i.purpose && i.purpose.length > 10, 'kein Zweck: ' + i.id);
  }
});

test('Suche und Kategorie-Filter arbeiten', () => {
  assert.ok(rs.list({ q: 'daw' }).items.length >= 2);
  assert.ok(rs.list({ cat: 'AUDIO' }).items.every((i) => i.cat === 'AUDIO'));
  assert.strictEqual(rs.list({ q: 'gibtsnichtxyz' }).items.length, 0);
});

test('Einträge für Engagement-Verkauf und Bot-Tarnung werden abgelehnt', () => {
  for (const bad of ['followerfabrik.de', 'best smm panel', 'cheap likes kaufen', 'antidetect browser', 'account-generator']) {
    const r = rs.assess(bad);
    assert.strictEqual(r.allowed, false, bad + ' müsste abgelehnt werden');
    assert.strictEqual(r.code, 403);
  }
  for (const good of ['ffmpeg.org', 'free-for.dev', 'tonejs.github.io']) {
    assert.strictEqual(rs.assess(good).allowed, true, good + ' darf nicht abgelehnt werden');
  }
});

test('der Katalog lädt nichts herunter und installiert nichts', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'lib', 'resources.js'), 'utf8');
  assert.ok(!/execFile|spawn|child_process/.test(src), 'Katalog darf nichts ausführen');
  assert.ok(!/require\(['"]https?/.test(src), 'Katalog darf nichts nachladen');
  assert.match(rs.list().note, /installiert/i);
});
