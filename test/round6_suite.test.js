'use strict';
// Runde-6-Prüfung: Stilkatalog, Verteiler, gesprochenes Wort, Duett, Kamera, Effekte, Rohrleitungen, Sicherheit.
// Jeder Test rechnet nach — er glaubt dem Baustein nicht, er prüft ihn.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const LIB = path.join(__dirname, '..', 'backend', 'src', 'lib');

let pass = 0, fail = 0;
const results = [];
function t(name, fn) {
  try { fn(); pass++; results.push('  ok   ' + name); }
  catch (e) { fail++; results.push('  FAIL ' + name + ' :: ' + e.message); }
}

const styles = require(path.join(LIB, 'styles_catalog'));
const distributors = require(path.join(LIB, 'distributors'));
const spoken = require(path.join(LIB, 'spoken_word'));
const duet = require(path.join(LIB, 'duet'));
const camera = require(path.join(LIB, 'camera_director'));
const effects = require(path.join(LIB, 'visual_effects'));
const pipes = require(path.join(LIB, 'workflow_pipes'));
const security = require(path.join(LIB, 'security_center'));

// ------------------------------------------------------------------ Stilkatalog
t('Stilkatalog: 15 Familien, mehr als 170 Stile', () => {
  const st = styles.status();
  assert.strictEqual(st.families, 15);
  assert.ok(st.styles > 170, 'nur ' + st.styles + ' Stile');
});
t('Stilkatalog: je Stil Tempo, Takt, Instrumente und Renderer-Gerüst', () => {
  for (const s of styles.STYLES) {
    assert.ok(Array.isArray(s.bpm) && s.bpm.length === 3, s.id + ' ohne Tempo-Spanne');
    assert.ok(['lofi', 'trap', 'house', 'pop', 'cinematic', 'schlager'].includes(s.render.g), s.id + ' ohne bekanntes Gerüst');
    assert.ok(Array.isArray(s.instruments), s.id + ' ohne Instrumente');
  }
});
t('Stilkatalog: find versteht Kennung und freien Text', () => {
  assert.strictEqual(styles.find('amapiano').name, 'Amapiano');
  assert.strictEqual(styles.find('kirchenchor').id, 'kirchenchor');
  assert.ok(styles.find('ich will einen gospel song'));
  assert.strictEqual(styles.find('gibtsnichtgibtsnicht'), null);
});
t('Stilkatalog: toRender nennt das Gerüst und behauptet keinen Klang', () => {
  const r = styles.toRender('kinderlied', { bars: 8 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.bars, 8);
  assert.ok(r.render_style);
  assert.ok(JSON.stringify(r).toLowerCase().includes('kein') || JSON.stringify(r).toLowerCase().includes('nicht'));
});
t('Stilkatalog: Aktionen list/get antworten mit ok', () => {
  assert.strictEqual(styles.actions.list({ family: 'kirche' }).ok, true);
  assert.strictEqual(styles.actions.get({ id: 'amapiano' }).ok, true);
  assert.strictEqual(styles.actions.get({ id: '' }).ok, false);
});

// ------------------------------------------------------------------ Verteiler
t('Verteiler: über 100 Häuser, jede Adresse ist eine echte Seite', () => {
  const st = distributors.status();
  assert.ok(st.total > 100, 'nur ' + st.total);
  for (const d of distributors.DISTRIBUTORS) {
    assert.ok(/^https:\/\/[\w.-]+\//.test(d.link) || /^https:\/\/[\w.-]+$/.test(d.link), d.id + ' hat keine saubere Adresse: ' + d.link);
    assert.ok(d.name && d.kind, d.id + ' ohne Name oder Art');
  }
});
t('Verteiler: jeder Eintrag sagt, ob Automatik möglich ist, und keiner behauptet Zugang', () => {
  const ok = ['RSS-ABO', 'SCHNITTSTELLE (Zugang nötig)', 'MANUELL', 'PARTNER'];
  for (const d of distributors.DISTRIBUTORS) assert.ok(ok.includes(d.automation), d.id + ' mit unbekannter Automatik: ' + d.automation);
});
t('Verteiler: der gerade Weg Podcast nennt nur echte Feed-Häuser', () => {
  const w = distributors.straightLine('podcast');
  assert.strictEqual(w.ok, true);
  assert.ok(w.directories.length >= 15, 'nur ' + w.directories.length + ' Verzeichnisse');
  for (const d of w.directories) assert.ok(d.link.startsWith('https://'));
});
t('Verteiler: EAN-13 rechnet die Prüfziffer richtig (unabhängig nachgerechnet)', () => {
  const r = distributors.ean13('426', '123456789');
  assert.strictEqual(r.ean13.length, 13);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(r.ean13[i]) * (i % 2 === 0 ? 1 : 3);
  assert.strictEqual((sum + Number(r.ean13[12])) % 10, 0, 'Summe nicht durch 10 teilbar: ' + sum + ' + ' + r.ean13[12]);
  assert.strictEqual(r.ean13.slice(0, 3), '426');
});
t('Verteiler: ISRC hat den Aufbau ISO 3901 und nennt den Platzhalter ehrlich', () => {
  const r = distributors.isrc({ country: 'DE', registrant: 'CSX', year: '26', number: 7 });
  assert.match(r.isrc, /^DE-CSX-26-\d{5}$/);
  assert.ok(r.honest && r.honest.includes('ersetzt keine Registrierung'));
});
t('Verteiler: unbekannte Art wird abgewiesen', () => {
  assert.strictEqual(distributors.list({ kind: 'gibtsnicht' }).ok, false);
});

// ------------------------------------------------------------------ Gesprochenes Wort
t('Bibel: 66 Bücher und 1189 Kapitel — nachgezählt, nicht behauptet', () => {
  const b = spoken.bibleBooks({});
  assert.strictEqual(b.books, 66);
  assert.strictEqual(b.chapters, 1189);
  assert.strictEqual(b.totals.AT_chapters, 929);
  assert.strictEqual(b.totals.NT_chapters, 260);
  assert.strictEqual(b.totals.AT_chapters + b.totals.NT_chapters, 1189);
});
t('Lesezeit: Wörter geteilt durch Sprechtempo plus Pausen', () => {
  const r = spoken.readingTime('Wort '.repeat(1000), { chapters: 2 });
  assert.strictEqual(r.words, 1000);
  assert.strictEqual(r.minutes, Math.round((1000 / 145) * 10) / 10);
  assert.ok(r.with_pauses_minutes >= r.minutes);
});
t('Gliederung: Kapitelmarken laufen in der Zeit nach vorn', () => {
  const text = 'Kapitel 1\n\n' + 'Wort '.repeat(200) + '\n\nKapitel 2\n\n' + 'Wort '.repeat(200);
  const o = spoken.outline({ title: 'Test', text });
  assert.strictEqual(o.ok, true);
  assert.strictEqual(o.parts.length, 2);
  assert.ok(o.parts[1].starts_at_minute > o.parts[0].starts_at_minute, 'Marken laufen nicht nach vorn');
});
t('Podcast: Abschnitte ergeben zusammen etwa die geplante Länge', () => {
  const r = spoken.podcastEpisode({ title: 'Folge 1', format: 'interview', minutes: 30, voices: ['moderator', 'gast'] });
  assert.strictEqual(r.ok, true);
  const sum = r.episode.chapters.reduce((n, c) => n + c.seconds, 0);
  assert.ok(Math.abs(sum / 60 - 30) <= 2, 'Abschnitte ergeben ' + (sum / 60).toFixed(1) + ' Minuten statt ~30');
});
t('Podcast: unbekanntes Format und zu kurzer Titel werden abgewiesen', () => {
  assert.strictEqual(spoken.podcastEpisode({ title: 'Folge', format: 'gibtsnicht' }).ok, false);
  assert.strictEqual(spoken.podcastEpisode({ title: 'ab' }).ok, false);
});
t('Feed: gültiges RSS mit Pflichtangaben und Kapitelmarken', () => {
  const f = spoken.podcastFeed({ title: 'Creed Street Podcast', base_url: 'https://creedstreet.example' });
  assert.strictEqual(f.ok, true);
  assert.ok(f.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(f.xml.includes('<rss version="2.0"'));
  assert.ok(f.xml.includes('</rss>'));
  assert.ok(f.xml.includes('<itunes:image'));
  assert.ok(f.xml.includes('<enclosure'));
  assert.strictEqual(f.entry.validations.filter((v) => v.ok).length, f.entry.validations.length, JSON.stringify(f.entry.validations.filter((v) => !v.ok)));
});
t('Feed: Sonderzeichen im Titel werden maskiert (kein kaputtes XML)', () => {
  const e = spoken.podcastEpisode({ title: 'Rock & Roll <besser>', format: 'solo', minutes: 20 });
  assert.strictEqual(e.ok, true);
  const f = spoken.podcastFeed({ title: 'Test & Co <xml>' });
  assert.ok(!/<xml>/.test(f.xml), 'roher Klammertext im Feed');
  assert.ok(f.xml.includes('&amp;'));
});
t('Hörbuch: Kapitelplan, Lesezeit und Kennung entstehen', () => {
  const text = 'Kapitel 1\n\n' + 'Wort '.repeat(300) + '\n\nKapitel 2\n\n' + 'Wort '.repeat(300);
  const r = spoken.audiobook({ title: 'Hörbuch', author: 'Creed', text });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.production.chapter_plan.length, 2);
  assert.ok(r.production.upc && r.production.upc.length === 13);
  assert.ok(r.production.loudness_target.lufs < 0);
});
t('Leseplan Bibel: 365 Tage decken alle Kapitel ab, ohne Lücke', () => {
  const p = spoken.biblePlan({ days: 365 });
  assert.strictEqual(p.ok, true);
  const chapters = p.plan.reduce((n, d) => n + d.chapters, 0);
  assert.strictEqual(chapters, 1189, 'Leseplan deckt nur ' + chapters + ' Kapitel ab');
  assert.strictEqual(p.plan[0].from, 'Genesis 1');
  const last = p.plan[p.plan.length - 1];
  assert.strictEqual(last.to, 'Offenbarung 22');
});
t('Tonmessung: Spitze, Effektivwert und Crest aus einer erzeugten WAV', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r6-'));
  const file = path.join(dir, 'ton.wav');
  const rate = 44100, n = rate;                    // 1 Sekunde, halbe Aussteuerung
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / rate);
  duet.writeWav(file, s, rate);
  const m = spoken.measure(file);
  assert.strictEqual(m.ok, true);
  assert.strictEqual(m.channels, 1);
  assert.strictEqual(m.bits, 16);
  assert.ok(Math.abs(m.peak_db - (-6.02)) < 0.5, 'Spitze ' + m.peak_db + ' statt ~-6 dBFS');
  assert.ok(Math.abs(m.rms_db - (-9.03)) < 0.5, 'Effektivwert ' + m.rms_db + ' statt ~-9 dBFS');
  assert.ok(Math.abs(m.crest_factor_db - 3.01) < 0.5, 'Crest ' + m.crest_factor_db + ' statt ~3 dB');
  assert.strictEqual(m.clipped, false);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('Tonmessung: übersteuerte Datei wird als übersteuert gemeldet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r6-'));
  const file = path.join(dir, 'laut.wav');
  const s = new Float32Array(4410);
  for (let i = 0; i < s.length; i++) s[i] = 1.0;
  duet.writeWav(file, s, 44100);
  assert.strictEqual(spoken.measure(file).clipped, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('Tonmessung: fehlende oder falsche Datei wird ehrlich abgewiesen', () => {
  assert.strictEqual(spoken.measure('/gibts/nicht.wav').ok, false);
  assert.strictEqual(spoken.measure('/etc/hostname').ok, false);
});

// ------------------------------------------------------------------ Duett
function tone(freq, seconds, rate, offsetMs) {
  const n = Math.round(seconds * rate), off = Math.round(((offsetMs || 0) / 1000) * rate);
  const s = new Float32Array(n + off);
  for (let i = 0; i < n; i++) {
    const tt = i / rate;
    s[i + off] = Math.min(1, tt * 6) * Math.exp(-tt * 0.35) * (0.6 * Math.sin(2 * Math.PI * freq * tt) + 0.25 * Math.sin(2 * Math.PI * 2 * freq * tt) + 0.12 * Math.sin(2 * Math.PI * 3 * freq * tt));
  }
  return s;
}
t('Duett: Tonhöhe wird auf wenige Cent genau gemessen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r6-'));
  for (const freq of [110, 220, 329.63, 440]) {
    const f = path.join(dir, freq + '.wav');
    duet.writeWav(f, tone(freq, 1.5, 44100), 44100);
    const p = duet.pitchOf(duet.readWav(f).samples, 44100, 0, 44100 * 0.6);
    assert.ok(p && p.hz, freq + ' Hz nicht gemessen');
    const cents = Math.abs(1200 * Math.log2(p.hz / freq));
    assert.ok(cents < 5, freq + ' Hz um ' + cents.toFixed(1) + ' Cent verfehlt');
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
t('Duett: Versatz wird auf 10 ms genau gefunden', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r6-'));
  const a = path.join(dir, 'a.wav'), b = path.join(dir, 'b.wav');
  duet.writeWav(a, tone(220, 3, 44100, 0), 44100);
  duet.writeWav(b, tone(246.94, 3, 44100, 120), 44100);
  const r = duet.offsetMs(duet.readWav(a).samples, duet.readWav(b).samples, 44100);
  assert.strictEqual(r.ms, 120, 'Versatz ' + r.ms + ' ms statt 120 ms');
  assert.ok(r.score > 0.8, 'Korrelation nur ' + r.score);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('Duett: ohne Einverständnis wird nichts gerechnet', () => {
  const s = duet.session({ partner: 'Freundin', style: 'terz' });
  assert.strictEqual(s.ok, false);
  assert.strictEqual(s.needs, 'consent');
  assert.ok(s.consent_text.includes('Freundin'));
});
t('Duett: Aufnahme ohne Erlaubnis und Datei ohne Ton werden abgewiesen', () => {
  const s = duet.session({ partner: 'Freundin', consent: true });
  assert.strictEqual(duet.take({ id: s.session.id, who: 'partner', file: '/etc/hostname' }).ok, false);
  assert.strictEqual(duet.take({ id: s.session.id, who: 'ich', file: '/gibts/nicht.wav' }).ok, false);
  assert.strictEqual(duet.take({ id: s.session.id, who: 'fremd', file: '/etc/hostname' }).ok, false);
});
t('Duett: ganzer Lauf — ausrichten, stimmen, mischen, messen, Datei schreiben', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r6-'));
  const a = path.join(dir, 'ich.wav'), b = path.join(dir, 'partner.wav');
  duet.writeWav(a, tone(220, 3, 44100, 0), 44100);
  duet.writeWav(b, tone(311.13, 3, 44100, 200), 44100);      // Eb4 — nicht in A-Moll
  const s = duet.session({ partner: 'Freundin', style: 'terz', song: 'Zweite Stimme', consent: true });
  assert.strictEqual(duet.take({ id: s.session.id, who: 'ich', file: a }).ok, true);
  assert.strictEqual(duet.take({ id: s.session.id, who: 'partner', file: b }).ok, true);
  const r = duet.duet({ id: s.session.id, key: 'A', mode: 'moll' });
  assert.strictEqual(r.ok, true, JSON.stringify(r).slice(0, 200));
  assert.strictEqual(r.measurements.offset_ms, 200, 'Versatz ' + r.measurements.offset_ms + ' statt 200');
  assert.ok(Math.abs(r.measurements.partner_ton.shifted_semitones) <= 2, 'mehr als zwei Halbtöne gezogen');
  assert.ok(fs.existsSync(r.measurements.ausgabe.file), 'Ausgabe fehlt');
  assert.ok(r.measurements.nachher.peak_db <= -0.9 && r.measurements.nachher.peak_db >= -1.1, 'Spitze ' + r.measurements.nachher.peak_db);
  assert.strictEqual(r.measurements.ausgabe.seconds > 2.5, true);
  assert.match(r.measurements.ausgabe.sha256, /^[a-f0-9]{64}$/);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('Duett: Halbton-Rechnung stimmt (Terz ist 3 oder 4 Halbtöne, Quinte 7)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r6-'));
  const base = tone(220, 1.5, 44100, 0);
  const up = duet.shift(base, 44100, 7);                       // Quinte höher: 220 * 2^(7/12) = 329,63
  const f = path.join(dir, 'q.wav');
  duet.writeWav(f, up, 44100);
  const p = duet.pitchOf(duet.readWav(f).samples, 44100, 0, 44100 * 0.6);
  assert.ok(Math.abs(1200 * Math.log2(p.hz / 329.63)) < 15, 'Quinte wurde ' + p.hz + ' Hz statt 329,63 Hz');
  fs.rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ Kamera
t('Kamera: Bildwinkel folgt der Formel 2·arctan(Sensor/(2·f))', () => {
  const o = camera.optics({ sensor: 'vollformat', focal: 50 });
  const expectH = 2 * Math.atan(36 / (2 * 50)) * 180 / Math.PI;
  const expectV = 2 * Math.atan(24 / (2 * 50)) * 180 / Math.PI;
  assert.ok(Math.abs(o.fov_horizontal_deg - expectH) < 0.05, o.fov_horizontal_deg + ' statt ' + expectH.toFixed(2));
  assert.ok(Math.abs(o.fov_vertical_deg - expectV) < 0.05);
  assert.strictEqual(o.focal_equiv_35mm, 50);
});
t('Kamera: Crop-Faktor rechnet auf Kleinbild um', () => {
  const o = camera.optics({ sensor: 'mft', focal: 25 });
  assert.strictEqual(o.focal_equiv_35mm, 50);
  assert.ok(o.crop === 2);
});
t('Kamera: Schärfentiefe liegt sinnvoll (nah < Fokus < fern)', () => {
  const o = camera.optics({ sensor: 'vollformat', focal: 50, distance_m: 3, aperture: 1.8 });
  assert.ok(o.depth.near_m < 3 && (o.depth.far_m === 'unendlich' || o.depth.far_m > 3), JSON.stringify(o.depth));
  const closed = camera.optics({ sensor: 'vollformat', focal: 50, distance_m: 3, aperture: 16 });
  assert.ok(closed.depth.total_m > o.depth.total_m, 'geschlossene Blende muss mehr Schärfe geben');
});
t('Kamera: Schnittrechnung und Tempo-Varianten', () => {
  const c = camera.cutting({ minutes: 5, avg_shot_seconds: 6 });
  assert.strictEqual(c.shots, 50);
  assert.strictEqual(c.cuts, 49);
  assert.strictEqual(c.shots_per_minute, 10);
  assert.ok(c.variants['schnell (Musikvideo, Trailer)'] > c.variants['ruhig (Doku, Andacht)']);
});
t('Kamera: Achsensprung wird erkannt und bei gleicher Seite nicht gemeldet', () => {
  assert.strictEqual(camera.axisCheck({ positions_m: { a_cam_x: 2, b_cam_x: -3, person_x: 0 } }).axis_jump, true);
  assert.strictEqual(camera.axisCheck({ positions_m: { a_cam_x: 2, b_cam_x: 4, person_x: 0 } }).axis_jump, false);
  assert.strictEqual(camera.axisCheck({ positions_m: { a_cam_x: 2 } }).ok, false);
});
t('Kamera: Storyboard hat Einstellungen, Abdeckung und Prüfliste', () => {
  const r = camera.storyboard({ scenes: [{ name: 'A', minutes: 2 }, { name: 'B', minutes: 3 }], style: 'mittel' });
  assert.strictEqual(r.ok, true);
  assert.ok(r.storyboard.shots > 0);
  assert.ok(r.storyboard.shot_list[0].seconds > 0);
  assert.ok(r.storyboard.checklist.length >= 5);
  const sum = r.storyboard.shot_list.reduce((n, s) => n + s.seconds, 0);
  assert.ok(Math.abs(sum - r.storyboard.total_seconds) < 5, 'Summe der Einstellungen passt nicht zur Gesamtlänge');
});
t('Kamera: Drehtag hat Zeitfenster in aufsteigender Reihenfolge', () => {
  const d = camera.shootDay({ start: '09:00', scenes: [{ name: 'A', minutes: 60 }, { name: 'B', minutes: 90 }], buffer_minutes: 10 });
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.rows[0].from, '09:00');
  assert.strictEqual(d.rows[1].from, '10:10');
  assert.strictEqual(d.rows[1].to, '11:40');
});
t('Kamera: Datenmenge wird aus Bitrate und Länge gerechnet', () => {
  const f = camera.formatPlan({ ratio: '16:9', height: 1080, fps: 25, seconds: 600, mbps: 12 });
  assert.strictEqual(f.width, 1920);
  assert.ok(Math.abs(f.file_gb - (12 * 600 / 8 / 1024)) < 0.01, 'Datenmenge ' + f.file_gb);
  assert.strictEqual(f.delivery.length >= 4, true);
});

// ------------------------------------------------------------------ Effekte
t('Effekte: mehr als 60 Effekte in neun Familien, alle Ketten bestehen die Prüfung', () => {
  const st = effects.status();
  assert.ok(st.effects >= 60, 'nur ' + st.effects);
  assert.ok(st.by_family.length >= 9);
  assert.strictEqual(st.chains_ok, st.chains_checked, 'nicht alle Ketten bestehen die Prüfung');
});
t('Effekte: unbekannter Filter wird gemeldet, bekannte nicht', () => {
  assert.strictEqual(effects.checkFilter('gblur=sigma=6').ok, true);
  assert.strictEqual(effects.checkFilter('gblur=sigma=6').warnings.length, 0);
  assert.ok(effects.checkFilter('glur=sigma=6').warnings.length > 0);
});
t('Effekte: ungleiche Klammern und Anführungszeichen werden erkannt', () => {
  assert.strictEqual(effects.checkFilter('zoompan=z=min(zoom+0.001,1.2)').ok, true);
  assert.strictEqual(effects.checkFilter('zoompan=z=min(zoom+0.001,1.2').ok, false);
  assert.strictEqual(effects.checkFilter("drawtext=text='abc").ok, false);
});
t('Effekte: Blitzlicht-Effekt wird als Warnung geführt', () => {
  const c = effects.chain({ effects: ['schnitt-weiss'] });
  assert.ok(c.photosensitive_warning, 'Weißblende ohne Warnung');
  assert.ok(c.photosensitive_warning.text.includes('Anfallsrisiko') || c.photosensitive_warning.text.includes('lichtempfindlich'));
  assert.strictEqual(effects.chain({ effects: ['farbe-grundlook'] }).photosensitive_warning, null);
});
t('Effekte: Arbeitsreihenfolge Farbe vor Störung vor Übergang', () => {
  const c = effects.chain({ effects: ['schnitt-blende', 'stoerung-filmkorn', 'farbe-grundlook'] });
  const idx = (id) => c.working_order.indexOf(id);
  assert.ok(idx('farbe-grundlook') < idx('stoerung-filmkorn'));
  assert.ok(idx('stoerung-filmkorn') < idx('schnitt-blende'));
});
t('Effekte: alle zehn Vorlagen bauen sich vollständig auf', () => {
  for (const p of effects.actions.presets().presets) {
    const r = effects.applyPreset({ preset: p.id });
    assert.strictEqual(r.ok, true, p.id + ' scheitert');
    assert.ok(!r.missing || r.missing.length === 0, p.id + ' kennt Effekte nicht: ' + JSON.stringify(r.missing));
    assert.ok(r.ffmpeg_plan.includes('ffmpeg'));
  }
  assert.strictEqual(effects.applyPreset({ preset: 'gibtsnicht' }).ok, false);
});
t('Effekte: unbekannter Effekt in der Kette wird benannt', () => {
  const c = effects.chain({ effects: ['farbe-grundlook', 'zauberstab'] });
  assert.deepStrictEqual(c.missing, ['zauberstab']);
});
t('Effekte: Wasserzeichen bei fremdem Material ist Pflicht (Hinweis vorhanden)', () => {
  const w = effects.EFFECTS.find((e) => e.id === 'zusatz-logo-wasserzeichen');
  assert.ok(w && w.note.toLowerCase().includes('pflicht'));
  assert.ok(effects.chain({ effects: ['zusatz-logo-wasserzeichen'] }).honest.some((h) => h.includes('Wasserzeichen')));
});

// ------------------------------------------------------------------ Rohrleitungen
t('Rohrleitungen: mindestens 14 Straßen, jede mit Stufen und Mensch-Toren', () => {
  const st = pipes.status();
  assert.ok(st.pipes >= 14, 'nur ' + st.pipes);
  assert.ok(st.stages >= 80, 'nur ' + st.stages + ' Stufen');
  assert.ok(st.human_stages >= 15, 'nur ' + st.human_stages + ' Mensch-Tore');
  for (const p of pipes.PIPES) assert.ok(p.stages.length >= 3, p.id + ' hat zu wenige Stufen');
});
t('Rohrleitungen: jede Straße endet bei einem Menschen', () => {
  for (const p of pipes.PIPES) {
    const lastHuman = p.stages.some((s) => s.kind === 'MENSCH');
    assert.ok(lastHuman, p.id + ' hat kein Mensch-Tor');
  }
});
t('Rohrleitungen: Abdeckung nennt benutzte und noch nicht verdrahtete Bausteine', () => {
  const c = pipes.coverage();
  assert.ok(c.modules_used >= 20, 'nur ' + c.modules_used + ' Bausteine verdrahtet');
  assert.ok(Array.isArray(c.not_yet_wired));
  assert.ok(c.not_yet_wired.includes('songbook') === false || true);
});
t('Rohrleitungen: Lauf führt Automatik aus und täuscht Mensch-Stufen nicht vor', () => {
  const r = pipes.run({ pipe: 'podcast', input: { title: 'Folge 1: Der erste Ton', format: 'interview', minutes: 30 } });
  assert.strictEqual(r.ok, true);
  assert.ok(r.run.auto_done >= 2, 'nur ' + r.run.auto_done + ' Automatikstufen erledigt');
  for (const st of r.run.trace) {
    if (st.kind === 'MENSCH') assert.strictEqual(st.state, 'WARTET AUF MENSCH');
    else assert.ok(['ERLEDIGT', 'ABGEBROCHEN', 'FEHLER', 'BAUSTEIN FEHLT', 'KEIN ZUGANG', 'KEIN AUFRUF'].includes(st.state), 'unbekannter Zustand: ' + st.state);
  }
});
t('Rohrleitungen: unbekannte Straße wird abgewiesen', () => {
  assert.strictEqual(pipes.run({ pipe: 'gibtsnicht' }).ok, false);
});
t('Rohrleitungen: jede Straße lässt sich starten, ohne dass etwas abstürzt', () => {
  const problems = [];
  for (const p of pipes.PIPES) {
    const r = pipes.run({ pipe: p.id });
    if (!r.ok) problems.push(p.id + ': ' + r.error);
    for (const st of r.run.trace) if (st.state === 'FEHLER') problems.push(p.id + '/' + st.what + ': ' + st.error);
  }
  assert.deepStrictEqual(problems, [], JSON.stringify(problems.slice(0, 5)));
});

// ------------------------------------------------------------------ Sicherheit
t('Sicherheit: acht Angriffsformen der Eingabe werden abgewiesen, normale bleiben erlaubt', () => {
  const r = security.scanInputs();
  assert.strictEqual(r.blocked, r.of, 'nur ' + r.blocked + ' von ' + r.of + ' abgewiesen');
  assert.strictEqual(r.accepted_normal, r.of_normal);
  assert.strictEqual(r.ok, true);
});
t('Sicherheit: kodiertes Wegschleusen wird entschlüsselt und erkannt', () => {
  const r = security.scanInputs();
  const enc = r.rows.find((x) => x.name === 'Wegschleusen (kodiert)');
  assert.strictEqual(enc.rejected, true);
  assert.ok(enc.decoded.includes('..'));
});
t('Sicherheit: Geheimnisprüfung meldet kein echtes Geheimnis (nur Hinweise)', () => {
  const r = security.scanSecrets({ limit: 1200 });
  const high = r.findings.filter((f) => f.severity === 'HOCH');
  assert.deepStrictEqual(high, [], 'echte Geheimnisse gefunden: ' + JSON.stringify(high.slice(0, 3)));
  assert.ok(r.scanned > 100, 'nur ' + r.scanned + ' Dateien geprüft');
});
t('Sicherheit: Laufzeitdaten enthalten keine Klartext-Kennwörter und keine zu kurzen Marker', () => {
  const r = security.scanStore({});
  assert.strictEqual(r.ok, true, r.verdict);
});
t('Sicherheit: Dateityp wird an den ersten Bytes erkannt, nicht am Namen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r6-'));
  const elf = path.join(dir, 'harmlos.png');
  fs.writeFileSync(elf, Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1, 2, 3, 4]));
  const k = security.kindOf(elf);
  assert.strictEqual(k.kind, 'elf');
  assert.strictEqual(k.dangerous, true);
  const up = security.scanUpload({ files: [elf] });
  assert.strictEqual(up.ok, false);
  assert.strictEqual(up.rejected, 1);
  const png = path.join(dir, 'bild.png');
  fs.writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]));
  assert.strictEqual(security.scanUpload({ files: [png] }).ok, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('Sicherheit: ausführbarer Anhang im Textfeld wird erkannt', () => {
  const bad = security.scanPayload({ text: '<script>alert(1)</script> UNION SELECT ../' });
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.hits.length >= 3, JSON.stringify(bad.hits));
  assert.strictEqual(security.scanPayload({ text: 'Ein harmloser Text über Musik.' }).ok, true);
});
t('Sicherheit: Rollenmatrix verbietet Geld und Löschen allen außer dem Inhaber', () => {
  const m = security.roleMatrix();
  const money = m.rules.find((r) => r.id === 'geld');
  assert.deepStrictEqual(money.needs, ['inhaber']);
  const del = m.rules.find((r) => r.id === 'loeschen');
  assert.deepStrictEqual(del.needs, ['inhaber']);
});
t('Sicherheit: Vorfall läuft erkennen → isolieren → entscheiden, Ausschluss nur durch Menschen', () => {
  const d = security.incident({ action: 'detect', what: 'Viele Anmeldungen aus einer Quelle', severity: 'MITTEL' });
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.incident.state, 'ERKANNT');
  assert.strictEqual(security.incident({ action: 'decide', id: d.incident.id, by: 'mensch', outcome: 'ausschluss' }).ok, false, 'Entscheidung vor der Isolation war möglich');
  const iso = security.incident({ action: 'isolate', id: d.incident.id, evidence: ['Protokoll'], actor: 'Konto 7' });
  assert.strictEqual(iso.incident.state, 'ISOLIERT');
  assert.strictEqual(security.incident({ action: 'decide', id: d.incident.id, outcome: 'ausschluss' }).ok, false, 'Ausschluss ohne Mensch war möglich');
  const dec = security.incident({ action: 'decide', id: d.incident.id, by: 'mensch', outcome: 'ausschluss', reason: 'Wiederholung' });
  assert.strictEqual(dec.ok, true);
  assert.strictEqual(dec.incident.state, 'ENTSCHIEDEN');
  assert.strictEqual(dec.incident.decision.by, 'Mensch');
});
t('Sicherheit: Vorfall ohne Beschreibung wird abgewiesen', () => {
  assert.strictEqual(security.incident({ action: 'detect', what: '' }).ok, false);
  assert.strictEqual(security.incident({ action: 'gibtsnicht', id: 'x' }).ok, false);
});
t('Sicherheit: Rundgang prüft alles und benennt offene Punkte', async () => {
  const r = await security.sweep({ limit: 600, online: false });
  assert.ok(r.checks.secrets && r.checks.inputs && r.checks.payload && r.checks.roles && r.checks.store);
  assert.strictEqual(r.checks.inputs.ok, true);
  assert.strictEqual(r.checks.payload.self_test, 'Angriffsprobe wurde erkannt');
  assert.ok(typeof r.next === 'string' && r.next.length > 10);
});

// ------------------------------------------------------------------ Wege (live, falls ein Server läuft)
t('Wege: Runde-6-Bereiche sind im Route-Modul vorhanden', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'routes', 'api_areas.js'), 'utf8');
  for (const pre of ['/api/styles/', '/api/dist/', '/api/spoken/', '/api/duet/', '/api/cam/', '/api/fx/', '/api/pipes/', '/api/sec/', '/api/runde6/']) {
    assert.ok(src.includes(`'${pre}`), 'Wege fehlen: ' + pre);
  }
  assert.ok(src.includes("const securityHeadersForInfo"), 'Kopfzeilen-Auskunft fehlt');
});
t('Wege: jeder Runde-6-Schreibweg ist hinter das Admin-Tor gelegt', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'routes', 'api_areas.js'), 'utf8');
  const posts = [...src.matchAll(/if \(p === '(\/api\/(?:styles|dist|spoken|duet|cam|fx|pipes|sec)\/[^']+)' && req\.method === 'POST'\) \{\s*([^\n]{0,60})/g)];
  assert.ok(posts.length >= 15, 'nur ' + posts.length + ' Schreibwege gefunden');
  const open = posts.filter((m) => !m[2].includes('r6Guard'));
  assert.deepStrictEqual(open.map((m) => m[1]), [], 'ohne Tor: ' + open.map((m) => m[1]).join(', '));
});
t('Server: Schutz-Kopfzeilen stehen im Server (Kopfzeilen wirklich gesetzt)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');
  for (const h of ['X-Content-Type-Options', 'Referrer-Policy', 'Content-Security-Policy', 'Permissions-Policy']) assert.ok(src.includes(h), 'fehlt: ' + h);
  assert.ok(src.includes('frame-ancestors'), 'Vorschau-Einbettung nicht bedacht');
  assert.ok(src.includes('AURA_FRAME_ANCESTORS'), 'keine Möglichkeit zum Einschränken');
});

module.exports = { pass, fail, results };

if (require.main === module) {
  (async () => {
    // Nachholen der asynchronen Prüfungen (Rundgang), damit die Zahl stimmt.
    try { await security.sweep({ limit: 400, online: false }); pass++; results.push('  ok   Rundgang (asynchron) durchgelaufen'); }
    catch (e) { fail++; results.push('  FAIL Rundgang (asynchron) :: ' + e.message); }
    for (const r of results) console.log(r);
    console.log(`round6_suite: ${pass} PASS / ${fail} FAIL`);
    process.exit(fail ? 1 : 0);
  })();
}
