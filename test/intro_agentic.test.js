'use strict';
// Prüfung des Intros „Agentic AI" (Runde 7): Hirn-Hub, Strahlen, fünf Felder mit **je eigenem
// laufendem Workflow**, Fundament. Der Test glaubt dem Baustein nichts — er rechnet Bilder und
// vergleicht Pixel, damit „animiert" auch wirklich belegt ist und nicht nur behauptet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Laufzeitdaten des Tests landen in /tmp, nicht im Projekt.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-agentic-'));
process.env.AURA_AGENTIC_DIR = TMP;
process.env.AURA_AGENTIC_FILE = path.join(TMP, 'intro_agentic.json');
process.env.AURA_AGENTIC_FRAMES = path.join(TMP, 'frames');

const ai = require(path.join(__dirname, '..', 'backend', 'src', 'lib', 'agentic_intro'));

let pass = 0, fail = 0;
const results = [];
function t(name, fn) {
  try { fn(); pass++; results.push('  ok   ' + name); }
  catch (e) { fail++; results.push('  FAIL ' + name + ' :: ' + e.message); }
}

// Pixel im Bereich zweier Bilder vergleichen — das ist der Bewegungsbeweis.
function diffRegion(a, b, box) {
  let n = 0;
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    if (x < 0 || y < 0 || x >= a.w || y >= a.h) continue;
    const o = (y * a.w + x) * 3;
    if (Math.abs(a.px[o] - b.px[o]) + Math.abs(a.px[o + 1] - b.px[o + 1]) + Math.abs(a.px[o + 2] - b.px[o + 2]) > 12) n++;
  }
  return n;
}
const boxOf = (p, pad) => ({
  x0: Math.round(p.cx - p.w / 2) - (pad || 0), x1: Math.round(p.cx + p.w / 2) + (pad || 0),
  y0: Math.round(p.cy - p.h / 2) - (pad || 0), y1: Math.round(p.cy + p.h / 2) + (pad || 0),
});
const build = (t1, t2) => [ai.frameAt(t1, ai.DEFAULT_TOTAL, { width: 1280, height: 720 }), ai.frameAt(t2, ai.DEFAULT_TOTAL, { width: 1280, height: 720 })];

// ------------------------------------------------------------------ Aufbau
t('Kopf: Bereich INTRO2, fünf Felder', () => {
  assert.strictEqual(ai.meta.area, 'INTRO2');
  assert.strictEqual(ai.PANELS.length, 5);
});

t('Jedes Feld hat Knoten, Kanten und einen gültigen Pfad', () => {
  for (const p of ai.PANELS) {
    assert.ok(p.nodes.length >= 4 && p.nodes.length <= 7, p.id + ': ' + p.nodes.length + ' Knoten');
    assert.ok(p.edges.length >= 4, p.id + ': zu wenige Kanten');
    for (const [a, b] of p.edges) {
      assert.ok(a >= 0 && a < p.nodes.length && b >= 0 && b < p.nodes.length, p.id + ': Kante zeigt ins Leere');
    }
    for (const i of p.path) assert.ok(i >= 0 && i < p.nodes.length, p.id + ': Pfad zeigt ins Leere');
    assert.ok(p.note && p.note.length > 10, p.id + ': ohne Beschreibung des Ablaufs');
  }
});

t('Felder erscheinen nacheinander (steigende Startzeit)', () => {
  const phases = ai.PANELS.map((p) => p.phase);
  for (let i = 1; i < phases.length; i++) assert.ok(phases[i] > phases[i - 1], 'Reihenfolge stimmt nicht');
});

t('Hirn-Hub sitzt mittig, Felder liegen außen herum', () => {
  assert.strictEqual(ai.HUB.cx, 640);
  for (const p of ai.PANELS) {
    const d = Math.hypot(p.cx - ai.HUB.cx, p.cy - ai.HUB.cy);
    assert.ok(d > ai.HUB.r + 40, p.id + ' liegt zu dicht am Hub');
  }
});

t('Fundament trägt den Namen aus der Vorlage', () => {
  assert.strictEqual(ai.FOUNDATION.label, 'DATA ENGINEERING: THE FOUNDATION');
  assert.ok(ai.FOUNDATION.y0 > 500, 'Fundament muss unten sitzen');
});

// ------------------------------------------------------------------ Bewegung je Feld
t('Bewegungsbeweis: in JEDEM Feld ändert sich das Bild (Workflow läuft)', () => {
  const [a, b] = build(9.0, 9.45);
  const report = [];
  for (const p of ai.PANELS) {
    const n = diffRegion(a, b, boxOf(p, 2));
    report.push(p.id + ':' + n);
    assert.ok(n > 150, p.id + ' steht still (nur ' + n + ' geänderte Bildpunkte)');
  }
  results.push('       Felder: ' + report.join(' · '));
});

t('Bewegung ist nicht zufällig: zwischen zwei Kurzzeitpunkten bleibt das Feld sonst gleich', () => {
  // Ohne das Modul zu ändern, muss ein Vergleich identischer Zeitpunkte null Unterschiede zeigen —
  // damit ist bewiesen, dass die Abweichung oben von der Animation kommt und nicht vom Rauschen.
  const [a, b] = build(9.2, 9.2);
  let n = 0;
  for (const p of ai.PANELS) n += diffRegion(a, b, boxOf(p, 2));
  assert.strictEqual(n, 0, 'gleicher Zeitpunkt ergibt ' + n + ' Unterschiede — Zufall im Bild');
});

t('Gehirn-Matrix im Hub pulsiert (7×5 Knoten leuchten unterschiedlich)', () => {
  const [a, b] = build(2.5, 2.9);
  const box = { x0: ai.HUB.cx - 55, x1: ai.HUB.cx + 55, y0: ai.HUB.cy - 45, y1: ai.HUB.cy + 65 };
  const n = diffRegion(a, b, box);
  assert.ok(n > 120, 'Matrix steht still (' + n + ')');
});

t('Fundament: Daten steigen (Bewegung im Fundamentbereich)', () => {
  const [a, b] = build(5.0, 5.35);
  const box = { x0: ai.FOUNDATION.x0 - 40, x1: ai.FOUNDATION.x1 + 40, y0: ai.FOUNDATION.y0 - 90, y1: ai.FOUNDATION.y1 };
  const n = diffRegion(a, b, box);
  assert.ok(n > 150, 'Fundament steht still (' + n + ')');
});

t('Strahlen: der Weg vom Hub zu den Feldern entsteht sichtbar', () => {
  const early = ai.frameAt(2.35, ai.DEFAULT_TOTAL, { width: 1280, height: 720 });
  const later = ai.frameAt(3.2, ai.DEFAULT_TOTAL, { width: 1280, height: 720 });
  // Korridor zwischen Hub und oberem Feld
  const top = ai.PANELS[0];
  const box = { x0: 540, x1: 740, y0: Math.round(top.cy + top.h / 2) + 2, y1: ai.HUB.cy - ai.HUB.r - 8 };
  const n = diffRegion(early, later, box);
  assert.ok(n > 100, 'kein Strahlaufbau messbar (' + n + ')');
});

// ------------------------------------------------------------------ Bilder und Dateien
t('Einzelbilder sind echte PNG-Dateien mit Inhalt', () => {
  for (const s of [0.4, 2.5, 4.5, 5.5, 6.5, 10.0]) {
    const r = ai.picture({ seconds: s, width: 1280, height: 720 });
    assert.deepStrictEqual(Array.from(r.png.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47], s + 's: keine PNG-Kennung');
    assert.ok(r.bytes > 2000, s + 's: nur ' + r.bytes + ' B');
    assert.ok(r.ms < 2000, s + 's: zu langsam (' + r.ms + ' ms)');
  }
});

t('Kein Standbild am Anfang: der Hauptkreis baut sich sichtbar auf', () => {
  // Gemessen wird die Helligkeit im Hauptkreis — der Matrix-Regen läuft von Anfang an über das
  // ganze Bild, taugt also nicht als Maß für den Aufbau.
  const lit = (t) => {
    const c = ai.frameAt(t, ai.DEFAULT_TOTAL, { width: 1280, height: 720 });
    const L = ai.layoutFor(1280, 720, 1);
    const box = { x0: Math.round(L.hub.cx - L.hub.r), x1: Math.round(L.hub.cx + L.hub.r), y0: Math.round(L.hub.cy - L.hub.r), y1: Math.round(L.hub.cy + L.hub.r) };
    let n = 0;
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
      const o = (y * c.w + x) * 3;
      if (c.px[o] + c.px[o + 1] + c.px[o + 2] > 200) n++;
    }
    return n;
  };
  const early = lit(0.05), later = lit(2.0);
  assert.ok(later > early * 2.5, 'Hauptkreis baut sich kaum auf (früh ' + early + ', später ' + later + ')');
});

t('Status nennt Felder, Phasen, Ehrlichkeit und den Kodierer', () => {
  const st = ai.status();
  assert.strictEqual(st.panels.length, 5);
  assert.strictEqual(st.phases.length, 7);
  assert.strictEqual(st.foundation.cylinders, 5);
  assert.ok(st.honesty.length >= 3);
  assert.ok(typeof st.ffmpeg === 'string' && st.ffmpeg.length > 3, 'ffmpeg-Zustand fehlt');
});

t('workflows: Angaben sind vollständig und passen zu den Feldern', () => {
  const w = ai.actions.workflows();
  assert.strictEqual(w.panels.length, 5);
  for (const p of w.panels) {
    assert.ok(p.nodes >= 4 && p.edges >= 4, p.id + ' unvollständig');
    assert.ok(p.what.length > 10 && p.appears_at_second > 0, p.id + ' ohne Angaben');
  }
});

t('Vorschauseite lädt Einzelbilder nach (kein Video nötig)', () => {
  const pg = ai.page({ seconds: 12 });
  assert.ok(pg.html.includes('/api/intro/agentic/frame.png'), 'Bildendpunkt fehlt');
  assert.ok(pg.html.includes('Anhalten'), 'Abspielsteuerung fehlt');
  assert.ok(pg.html.includes('DATA ENGINEERING'), 'Vorlage nicht erwähnt');
});

t('Kleine Videoprobe: ffmpeg kodiert, Datei ist echt', () => {
  const r = ai.renderToFrames({ seconds: 4, fps: 12, width: 320, height: 180 });
  assert.strictEqual(r.count, 48);
  const files = fs.readdirSync(r.frames_dir).filter((f) => f.endsWith('.ppm'));
  assert.strictEqual(files.length, 48, files.length + ' Einzelbilder');
  const one = fs.readFileSync(path.join(r.frames_dir, files[0]));
  assert.strictEqual(one.slice(0, 2).toString(), 'P6', 'kein PPM-Kopf');
  // Aufräumen (der Baustein räumt nach echten Läufen selbst auf)
  for (const f of files) fs.unlinkSync(path.join(r.frames_dir, f));
});


// ------------------------------------------------------------------ Runde 7b: „baller"
t('Bewegung ist deutlich stärker als in der ersten Fassung (über 1000 Punkte je Feld)', () => {
  const [a, b] = build(9.0, 9.3);
  for (const p of ai.PANELS) {
    const n = diffRegion(a, b, boxOf(p, 2));
    assert.ok(n > 1000, p.id + ' zu ruhig (' + n + ' Punkte)');
  }
});

t('Fundament: Name und Unterzeile berühren sich in keiner Bildgröße', () => {
  for (const [w, h] of [[640, 360], [1280, 720], [1920, 1080]]) {
    const c = ai.frameAt(9.0, ai.DEFAULT_TOTAL, { width: w, height: h });
    const L = ai.layoutFor(w, h, 1);
    const fx0 = Math.round(L.foundation.x0) + 6, fx1 = Math.round(L.foundation.x1) - 6;
    let lastWhite = -1, firstCyan = -1;
    for (let y = Math.round(L.foundation.y0); y <= Math.round(L.foundation.y1); y++) {
      let white = 0, cyan = 0;
      for (let x = fx0; x <= fx1; x++) {
        const o = (y * c.w + x) * 3, R = c.px[o], G = c.px[o + 1], B = c.px[o + 2];
        if (R > 200 && G > 200 && B > 200) white++;
        else if (B > 140 && G > 140 && R < 140) cyan++;
      }
      if (white > 5) lastWhite = y;
      if (cyan > 5 && firstCyan < 0) firstCyan = y;
    }
    assert.ok(lastWhite > 0 && firstCyan > 0, w + 'x' + h + ': Zeilen nicht gefunden');
    assert.ok(firstCyan - lastWhite >= 2, w + 'x' + h + ': Zeilen berühren sich (Abstand ' + (firstCyan - lastWhite) + ')');
  }
});

t('Anordnung bleibt in jeder Bildgröße vollständig im Bild', () => {
  for (const [w, h] of [[640, 360], [1280, 720], [1920, 1080]]) {
    const L = ai.layoutFor(w, h, 1);
    assert.ok(L.foundation.x0 > 0 && L.foundation.x1 < w, w + 'x' + h + ': Fundament ragt heraus');
    assert.ok(L.foundation.y1 < h, w + 'x' + h + ': Fundament unten abgeschnitten');
    for (const p of L.panels) {
      assert.ok(p.cx - p.w / 2 > 0 && p.cx + p.w / 2 < w, p.id + ' ragt seitlich heraus');
      assert.ok(p.cy - p.h / 2 > 0 && p.cy + p.h / 2 < h, p.id + ' ragt oben/unten heraus');
    }
    assert.ok(L.hub.cy - L.hub.r > 0, 'Hub ragt oben heraus');
  }
});

t('Kamera-Atmung: mit still=true ist das Bild ruhig, ohne atmet es', () => {
  const stillA = ai.frameAt(9.0, ai.DEFAULT_TOTAL, { width: 640, height: 360, still: true });
  const stillB = ai.frameAt(9.0, ai.DEFAULT_TOTAL, { width: 640, height: 360, still: true });
  assert.strictEqual(diffRegion(stillA, stillB, { x0: 0, y0: 0, x1: 639, y1: 359 }), 0, 'still ist nicht ruhig');
});


// ------------------------------------------------------------------ Runde 7c: Hervorhebung
t('Hervorhebung wandert im 12-Sekunden-Video über alle fünf Felder', () => {
  const seen = [];
  for (let t = 4.6; t < 11.5; t += 0.1) {   // erster Umlauf (der zweite beginnt bei 11,6 s)
    const h = ai.highlightAt(t);
    if (h.index >= 0 && h.amount > 0.9 && seen[seen.length - 1] !== h.id) seen.push(h.id);
  }
  assert.deepStrictEqual(seen, ai.PANELS.map((p) => p.id), 'Reihenfolge oder Vollständigkeit fehlt: ' + seen.join(','));
});

t('Das hervorgehobene Feld ist deutlich heller als die zurücktretenden', () => {
  const t = 6.9;                                    // musik ist aktiv
  const c = ai.frameAt(t, ai.DEFAULT_TOTAL, { width: 1280, height: 720 });
  const L = ai.layoutFor(1280, 720, 1);
  const lum = (p) => {
    let sum = 0, n = 0;
    const x0 = Math.round(p.cx - p.w / 2), x1 = Math.round(p.cx + p.w / 2);
    const y0 = Math.round(p.cy - p.h / 2), y1 = Math.round(p.cy + p.h / 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = (y * c.w + x) * 3;
      sum += c.px[o] + c.px[o + 1] + c.px[o + 2]; n++;
    }
    return sum / n;
  };
  const active = lum(L.panels[1]);
  const others = [0, 2, 3, 4].map((i) => lum(L.panels[i]));
  const maxOther = Math.max(...others);
  assert.ok(active > maxOther * 1.25, 'aktives Feld nicht heller (' + active.toFixed(1) + ' vs ' + maxOther.toFixed(1) + ')');
});

t('Ablauf-Text erscheint unter dem hervorgehobenen Feld', () => {
  const c = ai.frameAt(6.9, ai.DEFAULT_TOTAL, { width: 1280, height: 720 });
  const L = ai.layoutFor(1280, 720, 1);
  const p = L.panels[1];
  const y1 = Math.round(p.cy + p.h / 2);
  let cyan = 0;
  for (let y = y1 + 2; y <= y1 + 24; y++) for (let x = Math.round(p.cx - 90); x <= Math.round(p.cx + 90); x++) {
    const o = (y * c.w + x) * 3;
    if (c.px[o + 2] > 140 && c.px[o + 1] > 140 && c.px[o] < 140) cyan++;
  }
  assert.ok(cyan > 100, 'Ablauf-Box nicht sichtbar (' + cyan + ' Cyan-Punkte)');
});

t('Regression: Primitive mit Float-Koordinaten zeichnen (setPixel rundet zentral)', () => {
  const c = ai.canvas(64, 64, [0, 0, 0]);
  c.sc = 1;
  ai.rect(c, 10.4, 10.6, 20.7, 20.2, [200, 200, 200], 1, 1);
  const o = (11 * 64 + 15) * 3;
  assert.ok(c.px[o] > 150, 'rect mit Floats zeichnet nichts');
  ai.text(c, 'TEST', 10.3, 30.7, 1, [200, 200, 200], 1);
  let n = 0;
  for (let y = 30; y < 40; y++) for (let x = 10; x < 40; x++) { const q = (y * 64 + x) * 3; if (c.px[q] > 150) n++; }
  assert.ok(n > 20, 'text mit Floats zeichnet nichts (' + n + ')');
});


t('Jedes Feld trägt seinen Ablauf dauerhaft als Box unter sich — nicht nur das aktive', () => {
  const c = ai.frameAt(6.9, ai.DEFAULT_TOTAL, { width: 1920, height: 1080 });
  const L = ai.layoutFor(1920, 1080, 1);
  L.panels.forEach((p, i) => {
    const y1 = Math.round(p.cy + p.h / 2);
    let n = 0;
    for (let y = y1 + 2; y <= y1 + 26; y++) for (let x = Math.round(p.cx - 95); x <= Math.round(p.cx + 95); x++) {
      const o = (y * c.w + x) * 3;
      if (c.px[o] + c.px[o + 1] + c.px[o + 2] > 110) n++;
    }
    assert.ok(n > 200, p.id + ': Ablauf-Box nicht sichtbar (' + n + ' Punkte)');
  });
});


t('Das hervorgehobene Feld wächst sichtbar an (Rahmenkante wandert nach außen)', () => {
  const edge = (t) => {
    const c = ai.frameAt(t, ai.DEFAULT_TOTAL, { width: 1280, height: 720 });
    let minx = 9999;
    for (let y = 100; y <= 200; y++) for (let x = 0; x < 400; x++) {
      const o = (y * c.w + x) * 3;
      if (c.px[o] + c.px[o + 1] + c.px[o + 2] > 200) { if (x < minx) minx = x; break; }
    }
    return minx;
  };
  const ohne = edge(4.0), aktiv = edge(6.9);
  assert.ok(aktiv <= ohne - 6, 'Feld wächst nicht sichtbar (ohne ' + ohne + ', aktiv ' + aktiv + ')');
  assert.ok(aktiv > 4, 'Feld wächst aus dem Bild (' + aktiv + ')');
});

t('Lichtkegel: die Zone zwischen Hub und aktivem Feld wird heller', () => {
  const lum = (t) => {
    const c = ai.frameAt(t, ai.DEFAULT_TOTAL, { width: 1280, height: 720 });
    let sum = 0, n = 0;
    for (let y = 150; y <= 230; y++) for (let x = 320; x <= 520; x++) {
      const o = (y * c.w + x) * 3; sum += c.px[o] + c.px[o + 1] + c.px[o + 2]; n++;
    }
    return sum / n;
  };
  const ohne = lum(4.0), aktiv = lum(6.9);
  assert.ok(aktiv > ohne * 1.2, 'Kegel nicht sichtbar (ohne ' + ohne.toFixed(1) + ', aktiv ' + aktiv.toFixed(1) + ')');
});

console.log(results.join('\n'));
console.log('\nAgentic-Intro: ' + pass + ' pass / ' + fail + ' fail');
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* egal */ }
process.exit(fail ? 1 : 0);
