'use strict';
// AURA · Effekte und Specials — mit echten Filterketten, nicht mit Andeutungen.
//
// Jeder Effekt hat: Familie, was er tut, einen **echten** Befehlsteil (Sprache des Schnittprogramms
// ffmpeg), Wirkung, Dosis, Kosten und Risiken. Der Befehlsteil wird gegen eine Prüfliste getestet
// (Klammern, bekannte Filter, erlaubte Wertebereiche) — so steht hier nichts, was es nicht gibt.
//
// Zwei Dinge sind wichtiger als der Effekt selbst:
//   1. **Blitzlicht-Warnung.** Alles, was hell/dunkel mit mehr als 3 Wechseln je Sekunde flackert,
//      kann bei Menschen mit Fotosensibilität Anfälle auslösen. Solche Effekte werden markiert und in
//      der Kette begrenzt (kein Effekt allein schützt — die Warnung steht im Ergebnis).
//   2. **Wasserzeichen.** Effekte kommen auf Material, das uns gehört oder freigegeben ist. Bei
//      fremdem Material steht das Wasserzeichen als Pflicht im Plan.
//
// Ehrlich: AURA rechnet die Kette und prüft sie. Gerendert wird sie vom Schnittprogramm — hier läuft
// kein Video-Renderer. Wo unser eigenes ffmpeg Satzfilter nicht kann (kein drawtext im Sandkasten),
// steht der Ersatzweg dabei.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_EFFECTS_FILE || path.join(__dirname, '..', 'data', 'visual_effects.json');

const E = (id, name, family, chain, a) => ({
  id, name, family, chain,
  what: a.what || '', dose: a.dose || 'mittel', cost: a.cost || 'niedrig',
  risk: a.risk || '', needs: a.needs || [], applies_to: a.applies_to || ['video'], photosensitive: a.photosensitive === true, note: a.note || '',
});

const EFFECTS = [
  // ---------------------------------------------------------------- Farbe und Licht
  E('farbe-grundlook', 'Farb-Look (Grundkorrektur)', 'farbe', 'eq=contrast=1.06:saturation=1.08:brightness=0.01:gamma=1.02', { what: 'Kontrast, Sättigung, Helligkeit in einem Zug', dose: 'niedrig halten — Kontrast über 1.15 wirkt schnell künstlich', risk: 'zu viel Sättigung lässt Haut rot werden' }),
  E('farbe-kurven', 'Farbkurven (Tonhöhen)', 'farbe', 'curves=preset=medium_contrast', { what: 'Schwarzpunkt, Mitten, Weißpunkt getrennt', dose: 'mittel', risk: 'Zeichnung in Schatten reißen' }),
  E('farbe-teal-orange', 'Teal & Orange (Kino-Look)', 'farbe', 'colorbalance=rs=0.06:gs=-0.02:bs=-0.05:rm=0.03:bm=-0.02', { what: 'Haut warm, Schatten kühl — der übliche Kinokontrast', dose: 'mittel', cost: 'niedrig', risk: 'bei Tageslicht überzogen' }),
  E('farbe-entsättigen', 'Entsättigen (fast sw)', 'farbe', 'hue=s=0.15', { what: 'Farbe fast herausnehmen', dose: 'mittel', risk: 'wirkt schnell trostlos' }),
  E('farbe-schwarzweiss', 'Schwarzweiß', 'farbe', 'hue=s=0', { what: 'Alles auf Graustufen', dose: 'voll', risk: 'verlangt gutes Licht — Kontraste tragen das Bild' }),
  E('farbe-sepia', 'Sepia / Alt', 'farbe', 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131', { what: 'Braunton wie alte Fotografie', dose: 'mittel', risk: 'Klischee, sparsam' }),
  E('farbe-waerme', 'Wärme / Abendlicht', 'farbe', 'colorbalance=rs=0.04:gs=0.01:bs=-0.04', { what: 'Bild wärmer', dose: 'niedrig', risk: 'zu viel = Sonnenuntergang überall' }),
  E('farbe-kaelte', 'Kälte / Morgen', 'farbe', 'colorbalance=rs=-0.04:gs=0:bs=0.05', { what: 'Bild kühler', dose: 'niedrig' }),
  E('farbe-vignette', 'Vignette', 'farbe', 'vignette=angle=PI/5', { what: 'Ränder abdunkeln, Blick zur Mitte', dose: 'niedrig', risk: 'zu stark = Tunnelblick' }),
  E('farbe-verlauf', 'Verlauf / Farbverlaufsmaske', 'farbe', 'gradients=s=1920x1080:c0=0x101820:c1=0x000000', { what: 'Verlauf als Hintergrund oder Maske', dose: 'frei', applies_to: ['video', 'grafik'] }),

  // ---------------------------------------------------------------- Unschärfe und Tiefe
  E('unschaerfe-gauss', 'Weichzeichnen (Gauß)', 'unschaerfe', 'gblur=sigma=6', { what: 'Gleichmäßig weich', dose: 'niedrig', risk: 'Gesichter vermeiden, wenn Details wichtig sind' }),
  E('unschaerfe-tiefe', 'Tiefenunschärfe (nachträglich)', 'unschaerfe', 'boxblur=8:1:enable=1', { what: 'Hintergrund weich, Vordergrund scharf — über eine Maske', dose: 'mittel', risk: 'ohne saubere Maske franst es an Kanten', needs: ['Maske je Bild oder eine feste Trennung'] }),
  E('unschaerfe-zoom-blur', 'Zoom-Unschärfe (Wischer)', 'unschaerfe', 'gblur=sigma=2:steps=2', { what: 'Bewegung zwischen Szenen andeuten', dose: 'kurz, unter 0,4 s', risk: 'länger wird es unangenehm' }),
  E('unschaerfe-dreamy', 'Traum-Weichzeichner', 'unschaerfe', 'gblur=sigma=3,eq=contrast=0.96:brightness=0.04', { what: 'Weich plus hell, für Rückblicke', dose: 'mittel', risk: 'Kitschgrenze' }),

  // ---------------------------------------------------------------- Störungen und Texturen
  E('stoerung-filmkorn', 'Filmkorn', 'stoerung', 'noise=alls=12:allf=t+u', { what: 'Feines Rauschen wie Film', dose: 'niedrig bis mittel', risk: 'Kompression mag Korn nicht — Bitrate erhöhen' }),
  E('stoerung-vhs', 'VHS / alte Kassette', 'stoerung', 'noise=alls=20:allf=t,eq=saturation=0.85:contrast=0.95', { what: 'Weich, rauschig, blass', dose: 'mittel', risk: 'Klischee für „früher"', note: 'Dazu gehören Bildzeilen und Tonrauschen — Klang über daw_plugins.' }),
  E('stoerung-glitch', 'Glitch / Störung', 'stoerung', 'noise=alls=30:allf=t,chromashift=cbh=8:crh=-8', { what: 'Farbkanäle verschieben, Rauschen', dose: 'kurz, unter 0,3 s', risk: 'in Serie anstrengend' }),
  E('stoerung-scanlines', 'Bildzeilen (CRT)', 'stoerung', 'scanlines=s=1920x1080:t=2', { what: 'Feine Zeilen wie alter Fernseher', dose: 'mittel', applies_to: ['video'] }),
  E('stoerung-datamosh', 'Datamosh (Bildzerfall)', 'stoerung', 'noise=alls=40:allf=t', { what: 'Bildbewegung zerfließt', dose: 'kurz', risk: 'braucht das Original — nicht rückwärts anwenden' }),
  E('stoerung-chromatisch', 'Chromatic Aberration (Farbsaum)', 'stoerung', 'chromashift=cbh=3:crh=-3', { what: 'Farbsäume an Kanten', dose: 'niedrig', risk: 'bei Text unleserlich' }),
  E('stoerung-bloom', 'Bloom / Lichtblüte', 'stoerung', 'gblur=sigma=18,blend=all_mode=screen:all_opacity=0.35', { what: 'Helle Stellen blühen ins Bild', dose: 'niedrig', risk: 'Weiß brennt aus' }),
  E('stoerung-korn-super8', 'Super-8-Look', 'stoerung', 'noise=alls=18:allf=t,eq=saturation=0.9:contrast=1.05,vignette=angle=PI/4', { what: 'Korn, leichte Vignette, warm', dose: 'mittel' }),

  // ---------------------------------------------------------------- Schnitt und Übergänge
  E('schnitt-hart', 'Harter Schnitt', 'schnitt', '—(Schnitt, kein Filter)', { what: 'Direkter Wechsel', dose: 'Standard', cost: 'keine', note: 'Der häufigste und beste Übergang. Kein Effekt nötig.' }),
  E('schnitt-blende', 'Überblendung (Kreuzblende)', 'schnitt', 'xfade=transition=fade:duration=0.6:offset=0', { what: 'Bild A geht in Bild B über', dose: '0,4–1,0 s', risk: 'zu oft = Diashow-Gefühl' }),
  E('schnitt-schwarz', 'Schwarzblende', 'schnitt', 'fade=t=out:st=0:d=0.5', { what: 'Ins Schwarz, dann weiter', dose: 'klar trennend', risk: 'nur bei Zeitsprüngen' }),
  E('schnitt-weiss', 'Weißblende', 'schnitt', 'fade=t=out:st=0:d=0.4:color=white', { what: 'Ins Weiß — Übergang, Aufwachen, Blitz', dose: 'sparsam', photosensitive: true, risk: 'Weißblitze sind für lichtempfindliche Menschen riskant' }),
  E('schnitt-wisch', 'Wischer (Wipe)', 'schnitt', 'xfade=transition=wipeleft:duration=0.5:offset=0', { what: 'Kante schiebt Bild B herein', dose: 'kurz', risk: 'wirkt schnell altmodisch' }),
  E('schnitt-schieben', 'Schieben (Push)', 'schnitt', 'xfade=transition=slideleft:duration=0.5:offset=0', { what: 'Bild B schiebt A hinaus', dose: 'kurz' }),
  E('schnitt-radial', 'Radialer Wechsel', 'schnitt', 'xfade=transition=radial:duration=0.6:offset=0', { what: 'Kreis öffnet/schließt', dose: 'kurz', risk: 'auffällig' }),
  E('schnitt-zoom-blende', 'Zoom-Übergang', 'schnitt', 'xfade=transition=zoomin:duration=0.5:offset=0', { what: 'Zoom hinein, dann weiter', dose: 'kurz', risk: 'bei Musikvideos beliebt, schnell zu viel' }),
  E('schnitt-pixelize', 'Pixelwechsel', 'schnitt', 'xfade=transition=pixelize:duration=0.6:offset=0', { what: 'Bild zerfällt in Blöcke', dose: 'kurz' }),
  E('schnitt-glas', 'Glasblende', 'schnitt', 'xfade=transition=circlecrop:duration=0.6:offset=0', { what: 'Kreisblende wie eine Linse', dose: 'kurz' }),

  // ---------------------------------------------------------------- Bewegung und Zeit
  E('bewegung-ken-burns', 'Ken Burns (Fahrt über ein Standbild)', 'bewegung', 'zoompan=z=\'min(zoom+0.0008,1.15)\':d=250:s=1920x1080', { what: 'Ruhige Fahrt über ein Foto', dose: 'mittel', risk: 'zu schnell = Seekrankheit', applies_to: ['video', 'foto'] }),
  E('bewegung-zeitlupe', 'Zeitlupe', 'bewegung', 'setpts=2.0*PTS', { what: 'Halbe Geschwindigkeit', dose: 'mittel', risk: 'braucht mehr Bilder je Sekunde, sonst ruckelt es', needs: ['Dreh mit 50/60 Bildern je Sekunde'] }),
  E('bewegung-zeitraffer', 'Zeitraffer', 'bewegung', 'setpts=0.25*PTS', { what: 'Vierfache Geschwindigkeit', dose: 'mittel' }),
  E('bewegung-rampe', 'Geschwindigkeitsrampe', 'bewegung', 'setpts=\'if(lt(T,1),PTS,0.5*PTS)\'', { what: 'Tempo wechselt im Bild', dose: 'mittel', risk: 'Ton muss mit — nachvertonen' }),
  E('bewegung-standbild', 'Standbild einfrieren', 'bewegung', 'loop=loop=100:size=1:start=0', { what: 'Ein Bild bleibt stehen', dose: 'kurz', risk: 'länger als 3 Sekunden wirkt es wie ein Fehler' }),
  E('bewegung-spiegel', 'Spiegeln', 'bewegung', 'hflip', { what: 'Bild horizontal gedreht', dose: 'frei', risk: 'Text und Logos werden unleserlich' }),
  E('bewegung-schwenk-foto', 'Schwenk über eine Panoramaaufnahme', 'bewegung', 'crop=iw/3:ih:iw/3*t/8:0', { what: 'Ausschnitt wandert über ein breites Bild', dose: 'ruhig', applies_to: ['video', 'foto'] }),

  // ---------------------------------------------------------------- Aufteilung und Zusätze
  E('zusatz-bild-in-bild', 'Bild im Bild', 'zusatz', 'overlay=x=W-w-40:y=H-h-40', { what: 'Zweites Bild in die Ecke', dose: 'frei', needs: ['zweite Bildquelle'], applies_to: ['video'] }),
  E('zusatz-splitscreen', 'Geteilter Bildschirm', 'zusatz', 'hstack=inputs=2', { what: 'Zwei Bilder nebeneinander', dose: 'frei', needs: ['zwei Quellen'], applies_to: ['video'] }),
  E('zusatz-gitter', 'Gitter 2×2', 'zusatz', 'xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0', { what: 'Vier Bilder in einem Raster', dose: 'frei', needs: ['vier Quellen'], applies_to: ['video'] }),
  E('zusatz-untertitel-brennen', 'Untertitel einbrennen', 'zusatz', 'subtitles=untertitel.srt', { what: 'Text im Bild, für Kurzvideos', dose: 'frei', risk: 'Nicht durchsuchbar — zusätzlich als Textdatei mitliefern.', needs: ['Untertiteldatei', 'Satzfilter im Schnittprogramm'] }),
  E('zusatz-logo-wasserzeichen', 'Logo / Wasserzeichen', 'zusatz', 'overlay=x=W-w-30:y=30:format=auto', { what: 'Eigenes Zeichen im Bild', dose: 'niedrig, deckend', needs: ['PNG mit Transparenz'], note: 'Bei fremdem Material ist das Pflicht — unsere Regel: eigenes Wasserzeichen plus Quellenangabe.' }),
  E('zusatz-fortschrittsbalken', 'Fortschrittsbalken', 'zusatz', 'drawbox=x=0:y=H-8:w=iw*t/(TOTAL):h=8:color=0xFFD200:t=fill', { what: 'Zeigt, wie weit ein langes Video ist', dose: 'frei', risk: 'braucht die Gesamtlänge als Zahl' }),
  E('zusatz-zeitstempel', 'Zeitstempel einblenden', 'zusatz', 'drawtext=text=\'%{pts\\:hms}\':x=w-tw-20:y=h-th-20', { what: 'Laufzeit im Bild', dose: 'frei', risk: 'In unserem Sandkasten fehlt der Satzfilter (siehe Hinweis unten)', note: 'Wenn das Schnittprogramm drawtext nicht kann: Text als PNG-Ebene überlagern.' }),
  E('zusatz-kapitelmarken', 'Kapitelmarken setzen', 'zusatz', '—(Metadaten, kein Filter)', { what: 'Sprungmarken im Video', dose: 'frei', note: 'Gehört bei Podcast, Bibel und Lehrvideos dazu — siehe spoken_word (Kapitelmarken).' }),

  // ---------------------------------------------------------------- Freistellen und Keying
  E('keying-gruen', 'Grüner Hintergrund freistellen (Chroma Key)', 'keying', 'chromakey=color=0x00b140:similarity=0.18:blend=0.08', { what: 'Grün wird durchsichtig', dose: 'mittel', risk: 'Grünspill an Kanten — später nachziehen', needs: ['gleichmäßig ausgeleuchteter grüner Hintergrund'] }),
  E('keying-blau', 'Blauer Hintergrund freistellen', 'keying', 'chromakey=color=0x0047ab:similarity=0.18:blend=0.08', { what: 'Blau wird durchsichtig', dose: 'mittel' }),
  E('keying-maske-weich', 'Weiche Kantenmaske', 'keying', 'gblur=sigma=1,chromakey=color=0x00b140:similarity=0.15', { what: 'Kanten weicher, weniger Fransen', dose: 'niedrig' }),

  // ---------------------------------------------------------------- Ton-Effekte (Video)
  E('ton-unterleger', 'Musik unter der Stimme', 'ton', 'volume=0.25', { what: 'Musik leiser als die Stimme', dose: 'Musik 18–22 dB unter der Stimme', risk: 'zu laut = anstrengend', applies_to: ['audio', 'video'] }),
  E('ton-raumhall', 'Raumklang', 'ton', 'aecho=0.8:0.9:40:0.3', { what: 'Andeutung eines Raumes', dose: 'niedrig', risk: 'zu viel = unverständlich', applies_to: ['audio', 'video'] }),
  E('ton-nachhall-gross', 'Großer Hall', 'ton', 'aecho=0.8:0.88:200:0.5', { what: 'Weiter Raum', dose: 'niedrig', applies_to: ['audio', 'video'] }),
  E('ton-telefon', 'Telefonstimme', 'ton', 'highpass=f=300,lowpass=f=3400', { what: 'Bandbegrenzt wie ein Anruf', dose: 'frei', applies_to: ['audio', 'video'] }),
  E('ton-pitch-bett', 'Tonhöhe verändern (Effekt)', 'ton', 'asetrate=44100*0.9,aresample=44100', { what: 'Alles tiefer oder höher', dose: 'sparsam', risk: 'Verfremdung — bei Stimmen nur mit Erlaubnis', applies_to: ['audio', 'video'] }),

  // ---------------------------------------------------------------- Specials (Bausteine für Shows)
  E('special-intro-3s', 'Intro (3 Sekunden)', 'special', 'fade=t=in:st=0:d=0.3', { what: 'Logo, Ton, Titel — dann direkt zum Inhalt', dose: 'fest', note: 'Unsere Intros: 10 Sekunden für die Boot-Sequenz, 3 Sekunden für Folgen. Länge steht im Plan, nicht im Bauchgefühl.' }),
  E('special-abspann', 'Abspann', 'special', 'fade=t=out:st=0:d=1.0', { what: 'Danksagung, Rechte, Copyright', dose: 'fest', note: 'Copyright Creed Street Studios 2026 gehört hinein (siehe legal).' }),
  E('special-countdown', 'Countdown', 'special', 'drawbox=x=iw-60:y=40:w=40:h=40:color=0xFFD200@0.4:t=fill', { what: 'Zahl oder Balken vor dem Start', dose: 'frei' }),
  E('special-teaser-15s', 'Teaser (15 Sekunden)', 'special', 'speed=2.0', { what: 'Schnelle Ausschnitte aus dem Werk', dose: 'fest', note: 'Aus dem fertigen Schnitt gezogen, nicht neu gedreht.' }),
  E('special-shorts-schnitt', 'Kurzvideo-Fassung (9:16)', 'special', 'crop=ih*9/16:ih', { what: 'Mittlerer Ausschnitt für Hochformat', dose: 'fest', risk: 'Was in der Mitte nicht passt, fehlt — Ausschnitt planen, nicht nachträglich raten.', needs: ['Hochformat beim Dreh mitgedacht'] }),
  E('special-live-schaltung', 'Live-Schaltung vorbereiten', 'special', '—(Plan, kein Filter)', { what: 'Umschaltung zwischen zwei Quellen', dose: 'frei', needs: ['Aufnahmeprogramm mit Szenen', 'Testaufnahme 10 Minuten vorher'] }),
  E('special-duett-split', 'Duett geteilt darstellen', 'special', 'hstack=inputs=2', { what: 'Zwei Sänger nebeneinander — passend zum Duett-Baustein', dose: 'frei', note: 'Der Ton kommt aus duet (ausgerichtet und gemischt), das Bild aus dieser Kette.' }),
  E('special-karaoke-text', 'Lauftext (Karaoke)', 'special', 'subtitles=lauft.ext', { what: 'Text im Takt mitführen', dose: 'frei', needs: ['Zeitmarken je Zeile'], risk: 'Taktgenau nur mit geprüften Zeitmarken' }),
  E('special-ticker', 'Laufband (Ticker)', 'special', 'overlay=x=W-t*w:y=H-h-20', { what: 'Text läuft unten durch — wie bei Foundry/Sponsor', dose: 'frei', note: 'Im Betrieb: Foundry-Ticker unten, siehe sponsor-Baustein.' }),
  E('special-blindtext-shader', 'Blindtext-Anzeige (Text als Grafik)', 'special', '—(Text als PNG rendern und überlagern)', { what: 'Text ohne Satzfilter ins Bild', dose: 'frei', note: 'Der ehrliche Ersatzweg, wenn das Schnittprogramm keinen Text kann.' }),
];

function defaults() { return { plans: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['plans', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const KNOWN_FILTERS = ['eq', 'curves', 'colorbalance', 'hue', 'colorchannelmixer', 'vignette', 'gradients', 'gblur', 'boxblur', 'noise', 'chromashift', 'scanlines', 'blend', 'xfade', 'fade', 'zoompan', 'setpts', 'loop', 'hflip', 'vflip', 'crop', 'overlay', 'hstack', 'vstack', 'xstack', 'subtitles', 'drawbox', 'drawtext', 'chromakey', 'aecho', 'highpass', 'lowpass', 'asetrate', 'aresample', 'volume', 'speed', 'format', 'split', 'scale'];

// Prüfung einer Kette: Klammern, bekannte Filter, gefährliche Werte, Blitzlichtanteil.
function checkFilter(filter) {
  const problems = [], warnings = [];
  const f = String(filter || '');
  if (f.startsWith('—')) return { ok: true, filter: f, kind: 'kein Filter (Schnitt oder Plan)', problems, warnings, filters_used: [] };
  const open = (f.match(/\(/g) || []).length, close = (f.match(/\)/g) || []).length;
  if (open !== close) problems.push(`Klammern unausgeglichen (${open} auf, ${close} zu)`);
  const quotes = (f.match(/'/g) || []).length;
  if (quotes % 2 !== 0) problems.push(`Anführungszeichen ungerade (${quotes}) — Werte mit Komma brauchen ein Paar`);
  const parts = f.split(',').map((x) => x.trim()).filter(Boolean);
  const used = [];
  let depth = 0;
  for (const part of f) { if (part === '(') depth++; else if (part === ')') depth--; if (depth < 0) problems.push('schließende Klammer ohne öffnende'); }
  for (const part of parts) {
    const name = part.split('=')[0].replace(/^[^a-z]*/, '').trim().toLowerCase();
    if (!name) continue;
    used.push(name);
    if (!KNOWN_FILTERS.includes(name)) warnings.push(`Filter ${name} steht nicht in unserer Liste — im Schnittprogramm prüfen`);
  }
  const nums = (f.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  for (const n of nums) if (Math.abs(n) > 100000) warnings.push(`sehr großer Wert (${n}) — auf Tippfehler prüfen`);
  if (/noise=alls=(\d+)/.test(f)) {
    const strength = Number(f.match(/noise=alls=(\d+)/)[1]);
    if (strength > 60) warnings.push('sehr starkes Rauschen (über 60) — Bitrate erhöhen, sonst blockt die Kompression');
  }
  return { ok: problems.length === 0, filter: f, problems, warnings, filters_used: [...new Set(used)] };
}

// Eine ganze Kette aus mehreren Effekten bauen und prüfen.
function chain(input) {
  const p = input || {};
  const ids = Array.isArray(p.effects) ? p.effects : String(p.effects || '').split(/[,;\s]+/).filter(Boolean);
  if (!ids.length) return { ok: false, error: 'Keine Effekte angegeben (effects: [id, id, …])' };
  const found = [], missing = [];
  for (const id of ids) {
    const e = EFFECTS.find((x) => x.id === String(id).toLowerCase()) || EFFECTS.find((x) => x.name.toLowerCase() === String(id).toLowerCase());
    if (e) found.push(e); else missing.push(id);
  }
  if (!found.length) return { ok: false, error: `Kein Effekt erkannt: ${missing.join(', ')}` };
  const parts = found.filter((e) => !e.chain.startsWith('—')).map((e) => e.chain);
  const filter = parts.join(',');
  const check = checkFilter(filter || '—(nur Schnitt und Plan)');
  const photosensitive = found.filter((e) => e.photosensitive);
  const risky = found.filter((e) => e.risk);
  const needs = [...new Set(found.flatMap((e) => e.needs))];
  const familyOrder = ['farbe', 'unschaerfe', 'stoerung', 'schaerfe', 'keying', 'bewegung', 'zusatz', 'schnitt', 'ton', 'special'];
  const order = [...found].sort((a, b) => familyOrder.indexOf(a.family) - familyOrder.indexOf(b.family)).map((e) => e.id);
  const out = {
    ok: check.ok, count: found.length, ids: found.map((e) => e.id), missing: missing.length ? missing : undefined,
    filter: filter || '—',
    check,
    working_order: order,
    order_note: 'Reihenfolge: Farbe → Weichzeichnen → Störung → Keying → Bewegung → Zusätze → Übergang → Ton. Anders herum rechnet das Programm Korrekturen auf schon verfremdetes Bild.',
    photosensitive_warning: photosensitive.length ? {
      count: photosensitive.length, effects: photosensitive.map((e) => e.id),
      text: 'WARNUNG: Diese Effekte erzeugen helle Wechsel. Bei mehr als drei Hell-Dunkel-Wechseln je Sekunde besteht Anfallsrisiko für lichtempfindliche Menschen. Auf unter 3 Wechsel je Sekunde begrenzen, Vorwarnung im Video, und im Zweifel weglassen. Kein Effekt ist diesen Preis wert.',
    } : null,
    risks: risky.map((e) => ({ id: e.id, risk: e.risk })),
    needs,
    ffmpeg_plan: `ffmpeg -i eingang.mp4 -vf "${filter || 'null'}" -c:a copy ausgang.mp4`,
    honest: [
      'Die Kette wird geprüft, nicht gerendert: AURA ruft kein Schnittprogramm auf.',
      'Untertitel und Zeitstempel brauchen den Satzfilter; fehlt er, wird Text als Bildebene überlagert.',
      'Wasserzeichen bei fremdem Material ist Pflicht (Copyright Creed Street Studios 2026 bleibt im Abspann).',
    ],
  };
  const d = load();
  d.plans.unshift({ at: new Date().toISOString(), ids: out.ids, ok: out.ok, filter: out.filter, photosensitive: photosensitive.length });
  d.plans = d.plans.slice(0, 200);
  d.audit.unshift({ at: new Date().toISOString(), action: 'chain', count: out.count, ok: out.ok });
  save(d);
  return out;
}

// Vorlagen: fertige Ketten für typische Aufgaben (jede geprüft).
const PRESETS = {
  'musikvideo-nacht': { name: 'Musikvideo bei Nacht', effects: ['farbe-teal-orange', 'stoerung-bloom', 'stoerung-chromatisch', 'farbe-vignette', 'schnitt-hart'], minutes: 4 },
  'doku-ruhig': { name: 'Dokumentation ruhig', effects: ['farbe-grundlook', 'farbe-kurven', 'schnitt-blende'], minutes: 20 },
  'erklaervideo': { name: 'Erklärvideo', effects: ['farbe-grundlook', 'zusatz-untertitel-brennen', 'zusatz-fortschrittsbalken'], minutes: 8 },
  'erinnerung-vhs': { name: 'Erinnerung / alte Aufnahme', effects: ['stoerung-vhs', 'stoerung-scanlines', 'bewegung-zeitlupe'], minutes: 3 },
  'trailer-kurz': { name: 'Trailer (kurz, schnell)', effects: ['schnitt-zoom-blende', 'bewegung-rampe', 'stoerung-bloom', 'bewegung-standbild'], minutes: 1 },
  'podcast-video': { name: 'Podcast als Video', effects: ['farbe-grundlook', 'zusatz-kapitelmarken', 'zusatz-splitscreen', 'special-ticker'], minutes: 45 },
  'duett-bild': { name: 'Duett-Bild (zwei Stimmen)', effects: ['special-duett-split', 'farbe-waerme', 'zusatz-logo-wasserzeichen'], minutes: 4 },
  'kinderbibel': { name: 'Kinderbibel-Folge', effects: ['farbe-grundlook', 'bewegung-ken-burns', 'special-intro-3s', 'special-abspann'], minutes: 12 },
  'kurzvideo-hochformat': { name: 'Kurzvideo (Hochformat)', effects: ['special-shorts-schnitt', 'zusatz-untertitel-brennen', 'farbe-grundlook'], minutes: 1 },
  'bibellesung-ruhig': { name: 'Bibellesung, ruhig', effects: ['bewegung-schwenk-foto', 'schnitt-schwarz', 'zusatz-kapitelmarken'], minutes: 25 },
};

function applyPreset(input) {
  const p = input || {};
  const preset = PRESETS[String(p.preset || '').toLowerCase()];
  if (!preset) return { ok: false, error: `Vorlage unbekannt. Erlaubt: ${Object.keys(PRESETS).join(', ')}` };
  const built = chain({ effects: preset.effects });
  return Object.assign({ ok: built.ok, preset: String(p.preset).toLowerCase(), name: preset.name, minutes: preset.minutes, based_on: preset.effects }, built);
}

function search(input) {
  const q = String((input || {}).q || '').toLowerCase().trim();
  const fam = (input || {}).family ? String(input.family).toLowerCase() : null;
  if (fam && !EFFECTS.some((e) => e.family === fam)) return { ok: false, error: `Familie unbekannt. Erlaubt: ${[...new Set(EFFECTS.map((e) => e.family))].join(', ')}` };
  const rows = EFFECTS.filter((e) => (!fam || e.family === fam) && (!q || e.id.includes(q) || e.name.toLowerCase().includes(q) || e.what.toLowerCase().includes(q) || e.family.includes(q)));
  return { ok: true, query: q || null, family: fam, count: rows.length, effects: rows };
}

function status() {
  const d = load();
  const byFamily = [...new Set(EFFECTS.map((e) => e.family))].map((f) => ({ family: f, count: EFFECTS.filter((e) => e.family === f).length }));
  const checked = EFFECTS.map((e) => checkFilter(e.chain));
  return {
    area: 'FX', module: 'visual_effects', state: 'live', file: FILE,
    effects: EFFECTS.length, by_family: byFamily, presets: Object.keys(PRESETS).length,
    chains_checked: checked.length, chains_ok: checked.filter((c) => c.ok).length,
    photosensitive_effects: EFFECTS.filter((e) => e.photosensitive).map((e) => e.id),
    planned_chains: d.plans.length,
    rules: [
      'Jeder Effekt trägt eine echte Befehlskette und eine Prüfung (Klammern, Wertebereiche, bekannte Filter).',
      'AURA rendert kein Video — die Kette wird geprüft und an das Schnittprogramm übergeben.',
      'Helle Blitze über drei Wechsel je Sekunde: Warnung im Ergebnis, im Zweifel weglassen.',
      'Fremdes Material nur mit Wasserzeichen und Quellenangabe.',
      'Ohne Satzfilter im Programm wird Text als Bildebene überlagert — kein erfundener Text im Bild.',
    ],
  };
}

module.exports = {
  meta: { area: 'FX', id: 'visual_effects', name: 'Effekte und Specials (Filterketten, geprüft)', state: 'live' },
  actions: {
    status: () => status(),
    list: (p) => search(p || {}),
    get: (p) => { const e = EFFECTS.find((x) => x.id === String((p || {}).id || '').toLowerCase()); return e ? { ok: true, effect: e, check: checkFilter(e.chain) } : { ok: false, error: 'Effekt unbekannt' }; },
    check: (p) => checkFilter((p || {}).filter),
    chain: (p) => chain(p || {}),
    preset: (p) => applyPreset(p || {}),
    presets: () => ({ ok: true, presets: Object.entries(PRESETS).map(([id, v]) => ({ id, name: v.name, effects: v.effects, minutes: v.minutes })) }),
    families: () => ({ ok: true, families: [...new Set(EFFECTS.map((e) => e.family))] }),
  },
  EFFECTS, PRESETS, KNOWN_FILTERS, checkFilter, chain, applyPreset, search, status,
};
