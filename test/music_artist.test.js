'use strict';
// Tests: Musik-Renderer (echtes WAV), Songbook (Song-Werkstatt), Artist-Konten (Multi-Login, getrennte Sicht).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-'));
process.env.AURA_AUDIO_DIR = path.join(tmp, 'audio');
process.env.AURA_SONGBOOK_FILE = path.join(tmp, 'songbook.json');
process.env.AURA_ARTISTS_FILE = path.join(tmp, 'artists.json');
process.env.AURA_CONTROL_FILE = path.join(tmp, 'control.json');

const mr = require('../backend/src/lib/music_render');
const sb = require('../backend/src/lib/songbook');
const aa = require('../backend/src/lib/artist_accounts');

// ---------------------------------------------------------------- Renderer: echtes Audio
test('Renderer erzeugt eine gültige WAV-Datei (RIFF/WAVE, 16 Bit)', () => {
  const r = mr.render({ style: 'lofi', bars: 2, title: 'Testsong' });
  assert.strictEqual(r.ok, true);
  assert.ok(fs.existsSync(r.file), 'Datei fehlt');
  const buf = fs.readFileSync(r.file);
  assert.strictEqual(buf.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(buf.toString('ascii', 8, 12), 'WAVE');
  assert.strictEqual(buf.readUInt16LE(20), 1, 'PCM');
  assert.strictEqual(buf.readUInt16LE(34), 16, '16 Bit');
  assert.strictEqual(buf.readUInt16LE(22), 2, 'Stereo');
  assert.ok(r.duration > 2, 'zu kurz: ' + r.duration);
});

test('Audio ist kein Stille-Signal und nicht übersteuert', () => {
  const r = mr.render({ style: 'pop', bars: 2, title: 'Pegeltest' });
  const buf = fs.readFileSync(r.file);
  let peak = 0, sum = 0, n = 0;
  for (let o = 44; o + 1 < buf.length; o += 2) {
    const v = Math.abs(buf.readInt16LE(o)) / 32768;
    peak = Math.max(peak, v); sum += v * v; n++;
  }
  const rms = Math.sqrt(sum / n);
  assert.ok(peak > 0.3, 'zu leise, peak=' + peak.toFixed(3));
  assert.ok(peak <= 1.0, 'übersteuert, peak=' + peak.toFixed(3));
  assert.ok(rms > 0.02, 'praktisch Stille, rms=' + rms.toFixed(4));
});

test('gleicher Seed → gleiches Ergebnis (Determinismus)', () => {
  const a = mr.render({ style: 'house', bars: 2, seed: 4242 });
  const b = mr.render({ style: 'house', bars: 2, seed: 4242 });
  assert.strictEqual(fs.readFileSync(a.file).equals(fs.readFileSync(b.file)), true, 'Bytes unterscheiden sich');
});

test('verschiedene Stile klingen verschieden (unterschiedliche Bytes)', () => {
  const a = mr.render({ style: 'lofi', bars: 2, seed: 1 });
  const b = mr.render({ style: 'trap', bars: 2, seed: 1 });
  assert.strictEqual(fs.readFileSync(a.file).equals(fs.readFileSync(b.file)), false);
});

test('Stems werden als eigene Dateien geschrieben', () => {
  const r = mr.render({ style: 'cinematic', bars: 2, title: 'Stems', stems: true });
  assert.ok(r.stems, 'keine Stems');
  for (const k of ['drums', 'bass', 'chords', 'melody']) {
    assert.ok(fs.existsSync(r.stems[k].file), k + ' fehlt');
    const b = fs.readFileSync(r.stems[k].file);
    assert.strictEqual(b.toString('ascii', 0, 4), 'RIFF');
  }
});

test('6 Stile sind verfügbar, kein Netz und kein ffmpeg nötig', () => {
  assert.strictEqual(mr.styles().length, 6);
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'lib', 'music_render.js'), 'utf8');
  assert.ok(!/https?:\/\//.test(src), 'Renderer darf kein Netzwerkziel enthalten');
  assert.ok(!/execFile|spawn/.test(src), 'Renderer darf keine externen Programme starten');
});

// ---------------------------------------------------------------- Songbook
test('Songbook: aus einem Prompt entsteht sofort hörbarer Ton', () => {
  const r = sb.create({ title: 'Nachtfahrt', prompt: 'entspannt, nachts, warme akkorde', style: 'lofi', bars: 2, artist: 'Sabr47' }, 'Sabr47');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.song.status, 'RENDERED');
  assert.strictEqual(r.song.variants, 1);
  assert.strictEqual(r.song.vocals, false, 'lokal gibt es keinen KI-Gesang');
  assert.ok(fs.existsSync(r.render.file));
});

test('Songbook: kurzer Prompt wird abgelehnt', () => {
  assert.strictEqual(sb.create({ title: 'X', prompt: 'kurz' }, 'Sabr47').code, 400);
  assert.strictEqual(sb.create({ title: 'X', prompt: 'lang genug prompt hier', style: 'gibtsnicht' }, 'Sabr47').code, 400);
});

test('Songbook: Varianten, Verlängern und Stems', () => {
  const s = sb.create({ title: 'Anthem', prompt: 'harter trap beat dunkel', style: 'trap', bars: 2, artist: 'Sabr47' }, 'Sabr47');
  const v = sb.variations(s.song.id, 3, 'Sabr47');
  assert.strictEqual(v.added, 3);
  const before = v.song.bars;
  const e = sb.extend(s.song.id, 4, 'Sabr47');
  assert.strictEqual(e.bars, before + 4);
  const st = sb.stems(s.song.id, 'Sabr47');
  assert.deepStrictEqual(Object.keys(st.stems).sort(), ['bass', 'chords', 'drums', 'melody']);
});

test('Songbook: Freigabe und Veröffentlichung nur durch Menschen', () => {
  const s = sb.create({ title: 'Freigabe', prompt: 'ruhiger song zum testen', style: 'pop', bars: 2, artist: 'Sabr47' }, 'Sabr47');
  assert.strictEqual(sb.setStatus(s.song.id, 'RELEASED', 'auto-bot').code, 403);
  assert.strictEqual(sb.setStatus(s.song.id, 'APPROVED', 'Sabr47').song.status, 'APPROVED');
  assert.strictEqual(sb.setStatus(s.song.id, 'UNSINN', 'Sabr47').code, 400);
});

test('Songbook: Suno wird ehrlich als nicht integrierbar geführt', () => {
  const st = sb.status();
  assert.ok(!st.ai_integrable.includes('suno'), 'Suno darf nicht als integrierbar gelten');
  assert.ok(!st.ai_integrable.includes('udio'));
  assert.ok(st.ai_integrable.includes('replicate'));
  const r = sb.create({ title: 'Suno-Versuch', prompt: 'pop mit gesang bitte', style: 'pop', mode: 'AI', provider: 'suno' }, 'Sabr47');
  assert.strictEqual(r.pending_ai.status, 'NOT-API');
  assert.match(r.pending_ai.note, /kein offizieller/);
});

test('Songbook: KI-Modus über echten Anbieter ist Freigabe-pflichtig', () => {
  const r = sb.create({ title: 'KI-Song', prompt: 'epische streicher cinematic', style: 'cinematic', mode: 'AI', provider: 'replicate' }, 'Sabr47');
  assert.strictEqual(r.pending_ai.status, 'pending_approval');
  assert.match(r.pending_ai.approval, /^AP-[0-9a-f]{6}$/);
  const cc = require('../backend/src/lib/control_center');
  assert.strictEqual(cc.decide(r.pending_ai.approval, 'approve', 'auto-bot').ok, false, 'Bot darf nicht freigeben');
});

test('Songbook: Suche und Playlists', () => {
  const l = sb.list({ q: 'trap' });
  assert.ok(l.songs.length >= 1);
  const p = sb.playlistAdd('Album 2026', [l.songs[0].id], 'Sabr47');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(sb.list().counts.playlists, 1);
});

test('Songbook heilt fehlende Speicherdatei', () => {
  fs.unlinkSync(process.env.AURA_SONGBOOK_FILE);
  assert.strictEqual(sb.status().area, 'SONGBOOK');
  assert.ok(fs.existsSync(process.env.AURA_SONGBOOK_FILE));
});

// ---------------------------------------------------------------- Artist-Konten
test('Artist-Konten: Bootstrap-Admin, dann nur Admin darf anlegen', () => {
  const a = aa.createArtist({ name: 'Auraos', password: 'sehr-langes-passwort-1', role: 'admin' }, 'bootstrap');
  assert.strictEqual(a.ok, true);
  assert.strictEqual(a.artist.role, 'admin');
  const s = aa.createArtist({ name: 'Sabr47', password: 'sabr47-geheim-2026', genres: ['rap', 'trap'] }, 'auraos');
  assert.strictEqual(s.ok, true);
  const f = aa.createArtist({ name: 'Fremd', password: 'fremd-passwort-123' }, 'sabr47');
  assert.strictEqual(f.code, 403, 'Artist darf keine Konten anlegen');
});

test('Passwörter liegen als scrypt-Hash, niemals im Klartext', () => {
  const raw = fs.readFileSync(process.env.AURA_ARTISTS_FILE, 'utf8');
  assert.ok(!raw.includes('sabr47-geheim-2026'), 'Klartext-Passwort in der Datei!');
  assert.ok(raw.includes('scrypt$'), 'kein scrypt-Hash');
  const h = aa.makeHash('ein-test-passwort-123');
  assert.strictEqual(aa.checkHash('ein-test-passwort-123', h), true);
  assert.strictEqual(aa.checkHash('falsch', h), false);
});

test('kurze Passwörter werden abgelehnt', () => {
  assert.strictEqual(aa.createArtist({ name: 'Kurz', password: 'abc' }, 'auraos').code, 400);
  assert.strictEqual(aa.resetPassword('sabr47', 'kurz', 'auraos').code, 400);
});

test('Multi-Login: mehrere Artists gleichzeitig angemeldet', () => {
  aa.reset();
  const l1 = aa.login('sabr47', 'sabr47-geheim-2026', { ip: '10.0.0.1' });
  const l2 = aa.login('auraos', 'sehr-langes-passwort-1', { ip: '10.0.0.2' });
  assert.strictEqual(l1.ok, true);
  assert.strictEqual(l2.ok, true);
  assert.notStrictEqual(l1.token, l2.token, 'Sitzungen müssen getrennt sein');
  const list = aa.sessionList();
  assert.strictEqual(list.count, 2);
  assert.deepStrictEqual(list.sessions.map((s) => s.artist).sort(), ['auraos', 'sabr47']);
});

test('Login gibt bei falschem Passwort nicht preis, was falsch war', () => {
  const r = aa.login('sabr47', 'falsches-passwort-xyz');
  assert.strictEqual(r.code, 401);
  assert.match(r.error, /Artist oder Passwort falsch/);
  assert.strictEqual(aa.login('gibtsnicht', 'egal-egal-egal').error, r.error);
});

test('Sitzung läuft ab bzw. ist nicht erratbar', () => {
  const t = aa.login('sabr47', 'sabr47-geheim-2026').token;
  assert.strictEqual(t.length, 48);
  assert.strictEqual(aa.whoami('deadbeef'.repeat(6)).code, 401);
  assert.strictEqual(aa.whoami(t).artist.id, 'sabr47');
  assert.strictEqual(aa.logout(t).ok, true);
  assert.strictEqual(aa.whoami(t).code, 401, 'Token nach Logout ungültig');
});

test('getrennte Sicht: Artist sieht nur eigene Daten, Admin sieht alles', () => {
  // je ein Song pro Artist — die Sicht muss trennen
  sb.create({ title: 'Sabr Song', prompt: 'dunkler trap beat fuer sabr', style: 'trap', bars: 2, artist: 'Sabr47' }, 'Sabr47');
  sb.create({ title: 'Admin Song', prompt: 'ruhiger lofi fuer den admin', style: 'lofi', bars: 2, artist: 'Auraos' }, 'Auraos');
  const own = aa.view('sabr47', 'sabr47');
  assert.strictEqual(own.ok, true);
  assert.ok(own.songs.length >= 1, 'eigene Songs müssen sichtbar sein');
  assert.ok(own.songs.every((s) => s.artist === 'Sabr47'), 'fremde Songs sichtbar!');
  const admin = aa.view('auraos', 'auraos');
  assert.ok(admin.songs.every((s) => s.artist === 'Auraos'), 'auch der Admin sieht in seinem Blick nur seine eigenen');
  assert.strictEqual(aa.view('sabr47', 'auraos').ok, true, 'Admin darf fremdes Konto sehen');
  assert.strictEqual(aa.view('auraos', 'sabr47').code, 403, 'Artist darf fremdes Konto nicht sehen');
});

test('Kanäle: nur der Artist selbst oder der Admin', () => {
  const c = aa.linkChannel('sabr47', { provider: 'instagram', handle: '@sabr47' }, 'sabr47');
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.channel.status, 'NOT-CONNECTED', 'Status bleibt ehrlich bis Schlüssel liegen');
  assert.strictEqual(aa.linkChannel('auraos', { provider: 'tiktok', handle: '@x' }, 'sabr47').code, 403);
  assert.strictEqual(aa.linkChannel('sabr47', { provider: 'instagram', handle: '@nochmal' }, 'sabr47').code, 409);
});

test('Kanal-Status kommt ehrlich aus der Connectoren-Schicht', () => {
  const ch = aa.channelsOf('sabr47');
  assert.strictEqual(ch.length, 1);
  // instagram wird auf den Connectoren-Anbieter "meta" abgebildet
  assert.strictEqual(ch[0].connector_provider, 'meta');
  assert.ok(['NOT-CONNECTED', 'LOCKED', 'PARTIAL', 'CONNECTED'].includes(ch[0].provider_status), ch[0].provider_status);
});

test('Dienste ohne offiziellen API-Zugang melden das ehrlich', () => {
  aa.linkChannel('sabr47', { provider: 'bandcamp', handle: 'sabr47.bandcamp.com' }, 'sabr47');
  const ch = aa.channelsOf('sabr47').find((c) => c.provider === 'bandcamp');
  assert.strictEqual(ch.provider_status, 'NOT-IN-CATALOG');
  assert.match(ch.note, /keinen offiziellen API-Zugang/i);
});

test('Fehlversuche sperren den Login zeitweise (Brute-Force-Schutz)', () => {
  aa.reset();
  const name = 'bruteforce';
  aa.createArtist({ name, password: 'bruteforce-passwort-123' }, 'auraos');
  for (let i = 0; i < 8; i++) aa.login(name, 'falsch');
  const r = aa.login(name, 'bruteforce-passwort-123');
  assert.strictEqual(r.code, 429, 'nach 8 Fehlversuchen muss gesperrt sein');
  assert.match(r.error, /gesperrt/);
});

test('Admin kann Sitzungen beenden und Passwörter setzen — Artists nicht', () => {
  aa.reset();
  aa.login('sabr47', 'sabr47-geheim-2026');
  assert.strictEqual(aa.killSession('sabr47', 'sabr47').code, 403, 'Artist darf keine Sitzungen killen');
  assert.strictEqual(aa.killSession('sabr47', 'auraos').ended, 1);
  assert.strictEqual(aa.resetPassword('sabr47', 'neues-langes-passwort-9', 'sabr47').code, 403);
  assert.strictEqual(aa.resetPassword('sabr47', 'neues-langes-passwort-9', 'auraos').ok, true);
  assert.strictEqual(aa.login('sabr47', 'neues-langes-passwort-9').ok, true);
  assert.strictEqual(aa.login('sabr47', 'sabr47-geheim-2026').ok, false, 'altes Passwort muss ungültig sein');
});

test('Artist-Datei heilt sich selbst', () => {
  fs.unlinkSync(process.env.AURA_ARTISTS_FILE);
  assert.strictEqual(aa.status().area, 'ARTISTS');
  assert.ok(fs.existsSync(process.env.AURA_ARTISTS_FILE));
});
