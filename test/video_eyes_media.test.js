'use strict';
// Prüft Video-Abteilung, Augen (echte Pixelmessung) und Medien-Import.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-vem-'));
process.env.AURA_VIDEO_DEPT_FILE = path.join(tmp, 'video_department.json');
process.env.AURA_EYES_FILE = path.join(tmp, 'eyes.json');
process.env.AURA_MEDIA_IMPORT_FILE = path.join(tmp, 'media_import.json');

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const vd = require('../backend/src/lib/video_department');
const eyes = require('../backend/src/lib/eyes');
const mi = require('../backend/src/lib/media_import');

// Testbild bauen: echtes PNG, 4x4, links dunkel, rechts hell — damit die Messung etwas zu messen hat.
function png(width, height, pixelFn) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      const o = y * (1 + width * 3) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const chunks = [];
  const crcTable = (() => { const c = []; for (let n = 0; n < 256; n++) { let k = n; for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1; c[n] = k >>> 0; } return c; })();
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

(async () => {
  // ------------------------------------------------------------ Video-Abteilung
  await t('Video-Abteilung: nimmt Video-Aufträge an und lehnt Fremdaufträge ab', () => {
    const ok = vd.ticket({ task: 'Reel schneiden und Untertitel setzen', target_format: '1080x1920' });
    assert.ok(ok.ok, JSON.stringify(ok));
    const nein = vd.ticket({ task: 'Song mischen und Master erzeugen' });
    assert.strictEqual(nein.ok, false);
    assert.strictEqual(nein.refused, true);
    assert.ok(/Tonstudio/.test(nein.hand_to), 'Zuständiges Haus fehlt: ' + nein.hand_to);
  });

  await t('Video-Abteilung: vager Auftrag ohne Videoziel wird abgelehnt', () => {
    const r = vd.accepts({ task: 'mach irgendwas' });
    assert.strictEqual(r.accepted, false);
    assert.ok(/Video-Ziel/.test(r.reason));
  });

  await t('Video-Abteilung: Kette läuft nur in der Reihenfolge, Stationen dürfen nicht springen', () => {
    const id = vd.ticket({ task: 'Video für Kanal schneiden' }).ticket.id;
    const falsch = vd.deliver(id, 'farbe', {});
    assert.strictEqual(falsch.ok, false);
    assert.ok(/steht bei/.test(falsch.error));
  });

  await t('Video-Abteilung: ohne bestätigte Prüfkriterien wird nicht weitergereicht', () => {
    const id = vd.ticket({ task: 'Video schneiden' }).ticket.id;
    const no = vd.deliver(id, 'eingang', {});
    assert.strictEqual(no.ok, false);
    assert.ok(no.missing.length > 0, 'fehlende Kriterien nicht benannt');
    const yes = vd.deliver(id, 'eingang', { self_check: true, note: 'Materialliste vollständig' });
    assert.ok(yes.ok, JSON.stringify(yes));
    assert.strictEqual(yes.next_station, 'schnitt');
  });

  await t('Video-Abteilung: Abnahme verlangt Messwerte und lehnt ohne Ton ab', () => {
    const id = vd.ticket({ task: 'Video exportieren', target_format: '1080x1920' }).ticket.id;
    const ohneTon = vd.qa(id, { width: 1080, height: 1920, frames: 300, has_audio: false, duration: 12 });
    assert.strictEqual(ohneTon.verdict, 'NICHT ABGENOMMEN');
    assert.ok(ohneTon.failed.some((f) => /Ton/.test(f)));
    const ohneMessung = vd.qa(id, {});
    assert.strictEqual(ohneMessung.verdict, 'NICHT ABGENOMMEN');
    assert.ok(ohneMessung.checks.some((c) => /nicht gemessen/.test(c.measured)));
    const gut = vd.qa(id, { width: 1080, height: 1920, frames: 300, has_audio: true, duration: 12, loudness_lufs: -14 });
    assert.strictEqual(gut.verdict, 'ABGENOMMEN');
  });

  await t('Video-Abteilung: falsche Auflösung fällt auf', () => {
    const id = vd.ticket({ task: 'Video rendern', target_format: '1920x1080' }).ticket.id;
    const r = vd.qa(id, { width: 1080, height: 1920, frames: 10, has_audio: true });
    assert.strictEqual(r.verdict, 'NICHT ABGENOMMEN');
    assert.ok(r.failed.some((f) => /Auflösung/.test(f)));
  });

  await t('Video-Abteilung: Übersicht zeigt Arbeitsplätze mit Warteschlange', () => {
    const b = vd.board();
    assert.strictEqual(b.stations.length, vd.ROLES.length);
    assert.ok(b.stations.every((s) => typeof s.queue === 'number'));
    const st = vd.status();
    assert.ok(st.refuses.length >= 4);
    assert.ok(/nur Video/.test(st.rule));
  });

  // ------------------------------------------------------------ Augen
  await t('Augen: PNG-Kopf wird gelesen', () => {
    const f = path.join(tmp, 'kopf.png');
    fs.writeFileSync(f, png(8, 8, () => [10, 20, 30]));
    const s = eyes.sniff(fs.readFileSync(f));
    assert.strictEqual(s.format, 'PNG');
    assert.strictEqual(s.width, 8);
    assert.strictEqual(s.height, 8);
    assert.strictEqual(s.decodable, true);
  });

  await t('Augen: dunkles Bild wird als zu dunkel erkannt (echte Pixel, nicht geraten)', () => {
    const f = path.join(tmp, 'dunkel.png');
    fs.writeFileSync(f, png(32, 32, (x) => (x < 16 ? [5, 5, 8] : [12, 10, 14])));
    const out = eyes.look({ file: f });
    assert.ok(out.ok, JSON.stringify(out));
    assert.ok(out.measured, 'keine Messung');
    assert.ok(out.measured.brightness_mean < 45, 'Helligkeit falsch: ' + out.measured.brightness_mean);
    assert.ok(out.findings.some((x) => /dunkel/.test(x.finding)));
  });

  await t('Augen: helles, kontrastreiches Bild bekommt keine falsche Warnung', () => {
    const f = path.join(tmp, 'hell.png');
    fs.writeFileSync(f, png(64, 64, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? [235, 230, 225] : [60, 70, 90])));
    const out = eyes.look({ file: f });
    assert.ok(out.measured.brightness_mean > 45);
    assert.ok(out.measured.brightness_sd > 12);
    assert.ok(!out.findings.some((x) => /sehr dunkel/.test(x.finding)));
  });

  await t('Augen: Flächenraster findet leere Bereiche', () => {
    const f = path.join(tmp, 'flaeche.png');
    fs.writeFileSync(f, png(48, 48, () => [120, 120, 120]));
    const out = eyes.look({ file: f });
    assert.ok(out.measured.grid.length === 9);
    assert.ok(out.findings.some((x) => /Fläche|Rasterfelder/.test(x.finding)), 'leere Fläche nicht erkannt');
  });

  await t('Augen: Farbstich wird benannt', () => {
    const a = eyes.analyse([[10, 10, 200], [20, 15, 210], [30, 20, 190]], 3, 1);
    assert.ok(a.color_cast.some((c) => /Blau|Kalt/.test(c)), 'Farbstich nicht erkannt: ' + JSON.stringify(a.color_cast));
  });

  await t('Augen: Bildinhalte werden NICHT erfunden, wenn kein Modell da ist', () => {
    const f = path.join(tmp, 'inhalte.png');
    fs.writeFileSync(f, png(16, 16, () => [90, 90, 90]));
    const out = eyes.look({ file: f });
    assert.strictEqual(out.can_describe_content, false);
    assert.ok(/nicht benennen/.test(out.honest));
  });

  await t('Augen: fehlende Datei und leere Abfrage werden ehrlich abgelehnt', () => {
    assert.strictEqual(eyes.look({ file: path.join(tmp, 'gibtsnicht.png') }).ok, false);
    assert.strictEqual(eyes.look({}).ok, false);
  });

  await t('Augen: Bildschirm-Ordner wird abgetastet, neue Bilder landen als Notiz', () => {
    const dir = path.join(tmp, 'screens');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'aufnahme-1.png'), png(24, 24, () => [200, 200, 200]));
    fs.writeFileSync(path.join(dir, 'ignore.txt'), 'kein Bild');
    const s = eyes.scan(dir);
    assert.ok(s.ok);
    assert.strictEqual(s.files, 1);
    assert.strictEqual(s.new_files.length, 1);
    const zweite = eyes.scan(dir);
    assert.strictEqual(zweite.new_files.length, 0, 'schon gesehene Bilder müssen erkannt bleiben');
    assert.strictEqual(eyes.scan(path.join(tmp, 'keinordner')).new_files.length, 0);
  });

  // ------------------------------------------------------------ Medien-Import
  await t('Medien-Import: Plattform wird am Link erkannt', () => {
    assert.strictEqual(mi.detect('https://www.youtube.com/watch?v=abc').id, 'youtube');
    assert.strictEqual(mi.detect('https://open.spotify.com/track/x').id, 'spotify');
    assert.strictEqual(mi.detect('https://www.tiktok.com/@a/video/1').id, 'tiktok');
    assert.strictEqual(mi.detect('https://irgendeineseite.example/x').id, 'generisch');
  });

  await t('Medien-Import: Entwurf benennt Rechte und erlaubte Wege', () => {
    const d = mi.draft({ link: 'https://www.youtube.com/watch?v=abc', title: 'Creedstreet Session', artist: 'Sabr47', tags: ['#rap'] });
    assert.ok(d.ok, JSON.stringify(d));
    assert.strictEqual(d.import.platform, 'youtube');
    assert.strictEqual(d.import.mode, 'EMBED');
    assert.ok(/Download NICHT/.test(d.import.rights));
    assert.ok(d.rules.some((r) => /Kein Download/.test(r)));
    assert.ok(/Freigabe/.test(d.import.needs));
  });

  await t('Medien-Import: unbekannte Seite bleibt RECHTE_UNKLAR statt still übernommen', () => {
    const d = mi.draft({ link: 'https://fremdeseite.example/video/1' });
    assert.strictEqual(d.import.mode, 'RECHTE_UNKLAR');
    assert.ok(/Rechte klären/.test(d.import.needs));
  });

  await t('Medien-Import: eigenes Material wird als EIGEN geführt', () => {
    const d = mi.draft({ link: 'https://example.de/eigenes.mp4', own: true });
    assert.strictEqual(d.import.mode, 'EIGEN');
  });

  await t('Medien-Import: ungültiger Link wird abgelehnt, Liste filtert', () => {
    assert.strictEqual(mi.draft({ link: 'keinlink' }).ok, false);
    const l = mi.list({ platform: 'youtube' });
    assert.ok(l.count >= 1);
    assert.ok(l.items.every((i) => i.platform === 'youtube'));
  });

  await t('Medien-Import: Vorschau überlebt fehlendes Netz ehrlich', async () => {
    const p = await mi.preview({ link: 'https://www.youtube.com/watch?v=abc', timeout_ms: 400 });
    assert.ok(p.ok);
    assert.ok(p.allowed_uses.includes('EMBED'));
    assert.ok(p.not_allowed.some((x) => /Herunterladen/.test(x)));
    if (!p.metadata.ok) assert.ok(/Netz|Schnittstelle|oEmbed/.test(p.metadata.reason), 'Grund fehlt: ' + p.metadata.reason);
  });

  await t('Medien-Import: Status benennt Regeln und Plattformen', () => {
    const st = mi.status();
    assert.ok(st.platforms >= 12);
    assert.ok(st.detected.some((p) => p.id === 'youtube' && p.oembed === true));
    assert.ok(st.rules.length >= 3);
  });

  console.log(`\nvideo_eyes_media: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
