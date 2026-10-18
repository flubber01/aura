'use strict';
// AURA · Stilkatalog — jeder gängige Stil, mit Zahlen statt Bauchgefühl.
//
// Aufbau je Stil: Familie, Tempo (typisch + Bereich), Takt, Schlagzeug-Muster, Instrumente, Stimmung,
// Herkunft/Zeit, und — der wichtige Teil — **worauf er im Renderer abgebildet wird**. Der lokale
// Renderer kennt sechs Grundgerüste (lofi, trap, house, pop, cinematic, schlager); jeder weitere Stil
// wird über Tempo, Tonleiter, Klangfarbe, Hall und Muster darauf gelegt. Die Liste sagt bei jedem
// Eintrag offen, welches Gerüst benutzt wird und was geändert wird.
//
// Die Angaben (Tempo, Takt) sind die in der Praxis üblichen Spannen. Sie sind Erfahrungswerte, keine
// Messungen an einem bestimmten Stück — das steht auch in jedem Eintrag so drin.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_STYLES_FILE || path.join(__dirname, '..', 'data', 'styles_catalog.json');

// Abkürzungen für die Spalten: bpm [typisch, von, bis], Takt, Gerüst aus music_render
// g = Grundgerüst, t = Tempo, s = Tonleiter, b = Helligkeit, r = Hall, sw = Swing, sch = Schlagzeug
const G = { lofi: 'lofi', trap: 'trap', house: 'house', pop: 'pop', cinematic: 'cinematic', schlager: 'schlager' };

function s(id, name, family, a) {
  return {
    id, name, family,
    bpm: a.bpm, meter: a.meter || '4/4', drums: a.drums || '—', instruments: a.inst || [], mood: a.mood || '',
    from: a.from || '', render: Object.assign({ g: a.g || 'pop', s: a.s || 'minor' }, a.tweak || {}),
    match: a.match || [name.toLowerCase()],
    note: a.note || '',
  };
}

const FAMILIES = [
  {
    id: 'pop', name: 'Pop und Radio',
    styles: [
      s('pop', 'Pop', 'pop', { bpm: [104, 92, 120], drums: 'gerader Beat, Klatschen auf 2 und 4', inst: ['Klavier', 'Synth', 'Bass', 'Drumset'], mood: 'hell, eingängig', from: 'ab 1960', g: 'pop', s: 'major', tweak: { b: 0.65, r: 0.28 }, match: ['pop', 'radiotauglich'] }),
      s('dancepop', 'Dance-Pop', 'pop', { bpm: [118, 110, 128], drums: 'Four-on-the-Floor mit Klatsche', inst: ['Synthesizer', 'Sidechain-Bass'], mood: 'treibend, hell', from: 'ab 2000', g: 'house', s: 'major', tweak: { b: 0.75 }, match: ['dance pop', 'dancepop'] }),
      s('synthpop', 'Synth-Pop', 'pop', { bpm: [112, 100, 124], drums: 'Drummachine, Snare mit Hall', inst: ['Analogsynth', 'Gated Drums'], mood: 'kühl, melodisch', from: '1980er', g: 'pop', tweak: { b: 0.7, r: 0.35 }, match: ['synthpop', 'synth pop', '80er'] }),
      s('kpop', 'K-Pop', 'pop', { bpm: [120, 100, 140], drums: 'harter Beat, Stopps', inst: ['Synth', 'Rap-Teil', 'Chor'], mood: 'schnell, wechselnd', from: 'ab 1990 Korea', g: 'house', tweak: { b: 0.8 }, match: ['k-pop', 'kpop'] }),
      s('jpop', 'J-Pop', 'pop', { bpm: [132, 120, 150], drums: 'schneller Rock-Beat', inst: ['Gitarre', 'Synth', 'Streicher'], mood: 'energiegeladen', from: 'ab 1990 Japan', g: 'pop', tweak: { b: 0.72 }, match: ['j-pop', 'jpop'] }),
      s('schlager', 'Schlager', 'pop', { bpm: [126, 116, 136], drums: 'Offbeat, Klatschen', inst: ['Akkordeon', 'Streicher', 'Bläser'], mood: 'feiernd, herzlich', from: 'ab 1950 DE/AT', g: 'schlager', s: 'major', tweak: { b: 0.8 }, match: ['schlager', 'volksmusik nah'] }),
      s('volksmusik', 'Volksmusik', 'pop', { bpm: [120, 100, 140], drums: 'Polka- oder Walzerbegleitung', inst: ['Akkordeon', 'Tuba', 'Bläser'], mood: 'ländlich, festlich', from: 'Tradition', g: 'schlager', s: 'major', meter: '3/4 oder 4/4', match: ['volksmusik', 'blasmusik'] }),
      s('ballade', 'Ballade', 'pop', { bpm: [68, 56, 80], drums: 'sparsam, oft nur Becken', inst: ['Klavier', 'Streicher'], mood: 'getragen, nah', from: 'immer', g: 'cinematic', tweak: { b: 0.5, r: 0.45 }, match: ['ballade', 'ballad'] }),
      s('teenpop', 'Teen-Pop', 'pop', { bpm: [116, 100, 130], drums: 'gerader Beat, Handclaps', inst: ['Synth', 'Gitarre'], mood: 'unbeschwert', from: 'ab 1990', g: 'pop', tweak: { b: 0.78 }, match: ['teen pop'] }),
      s('adultcontemporary', 'Adult Contemporary', 'pop', { bpm: [92, 76, 108], drums: 'weich, viel Besen', inst: ['Klavier', 'Gitarre', 'Streicher'], mood: 'ruhig, erwachsen', from: 'ab 1970', g: 'pop', tweak: { b: 0.5, r: 0.35 }, match: ['adult contemporary'] }),
    ],
  },
  {
    id: 'rock', name: 'Rock',
    styles: [
      s('rock', 'Rock', 'rock', { bpm: [120, 100, 140], drums: 'harter Backbeat', inst: ['E-Gitarre', 'Bass', 'Drumset'], mood: 'kraftvoll', from: 'ab 1955', g: 'pop', tweak: { b: 0.68, r: 0.25 }, match: ['rock'] }),
      s('hardrock', 'Hard Rock', 'rock', { bpm: [128, 110, 150], drums: 'dicht, viel Snare', inst: ['Verzerrte Gitarre'], mood: 'drückend', from: 'ab 1970', g: 'pop', tweak: { b: 0.62 }, match: ['hard rock'] }),
      s('metal', 'Metal', 'rock', { bpm: [150, 120, 200], drums: 'Double-Bass, Blast-Rhythmen', inst: ['Tiefergestimmte Gitarren'], mood: 'schwer, dunkel', from: 'ab 1970', g: 'trap', tweak: { b: 0.5, r: 0.2 }, match: ['metal', 'metall'] }),
      s('punk', 'Punk', 'rock', { bpm: [168, 150, 200], drums: 'schnell, gerade', inst: ['Gitarre', 'Bass'], mood: 'wütend, roh', from: 'ab 1976', g: 'pop', tweak: { b: 0.75, r: 0.1 }, match: ['punk'] }),
      s('indie', 'Indie-Rock', 'rock', { bpm: [122, 100, 140], drums: 'locker, live gespielt', inst: ['Gitarren mit Hall'], mood: 'versponnen', from: 'ab 1990', g: 'pop', tweak: { b: 0.55, r: 0.4 }, match: ['indie'] }),
      s('alternative', 'Alternative', 'rock', { bpm: [118, 96, 140], drums: 'ungewöhnliche Betonungen', inst: ['Gitarren', 'Noise'], mood: 'kantig', from: 'ab 1985', g: 'pop', tweak: { b: 0.52 }, match: ['alternative'] }),
      s('grunge', 'Grunge', 'rock', { bpm: [104, 88, 130], drums: 'schwer, schleppend', inst: ['Verzerrte Gitarre'], mood: 'mürbe', from: 'ab 1988 Seattle', g: 'pop', tweak: { b: 0.45, r: 0.35 }, match: ['grunge'] }),
      s('progressiverock', 'Progressive Rock', 'rock', { bpm: [110, 70, 160], drums: 'Taktwechsel', inst: ['Mellotron', 'Lange Formen'], mood: 'ausladend', from: 'ab 1969', g: 'cinematic', tweak: { b: 0.5, r: 0.45 }, match: ['progressive', 'prog rock'] }),
      s('classicrock', 'Classic Rock', 'rock', { bpm: [124, 108, 140], drums: 'Live-Backbeat', inst: ['Orgel', 'Gitarre'], mood: 'breit', from: 'ab 1968', g: 'pop', tweak: { b: 0.6 }, match: ['classic rock'] }),
      s('garagerock', 'Garage Rock', 'rock', { bpm: [140, 120, 170], drums: 'roh, wenig Hall', inst: ['Gitarre', 'Farfisa'], mood: 'direkt', from: 'ab 1963', g: 'pop', tweak: { b: 0.7, r: 0.12 }, match: ['garage'] }),
    ],
  },
  {
    id: 'metal-extra', name: 'Härtere Spielarten',
    styles: [
      s('deathmetal', 'Death Metal', 'metal-extra', { bpm: [170, 140, 240], drums: 'Blast-Beats', inst: ['Tiefe Gitarren'], mood: 'brutal', from: 'ab 1985', g: 'trap', tweak: { b: 0.4, r: 0.15 }, match: ['death metal'] }),
      s('blackmetal', 'Black Metal', 'metal-extra', { bpm: [180, 150, 260], drums: 'Blast, Tremolo', inst: ['Dünn klingende Gitarren'], mood: 'eisig', from: 'ab 1990 Norwegen', g: 'trap', tweak: { b: 0.35, r: 0.5 }, match: ['black metal'] }),
      s('metalcore', 'Metalcore', 'metal-extra', { bpm: [160, 130, 200], drums: 'Breakdowns', inst: ['Drop-Tuning'], mood: 'zornig', from: 'ab 1995', g: 'trap', tweak: { b: 0.5 }, match: ['metalcore'] }),
      s('doom', 'Doom Metal', 'metal-extra', { bpm: [60, 40, 80], drums: 'sehr langsam', inst: ['Sehr tiefe Gitarren'], mood: 'schwer, schleppend', from: 'ab 1970', g: 'cinematic', tweak: { b: 0.3, r: 0.6 }, match: ['doom'] }),
      s('nu-metal', 'Nu Metal', 'metal-extra', { bpm: [132, 110, 160], drums: 'Groove, Scratch', inst: ['Tiefer Groove', 'DJ'], mood: 'aggressiv', from: 'ab 1994', g: 'trap', tweak: { b: 0.5 }, match: ['nu metal', 'nu-metal'] }),
      s('power-metal', 'Power Metal', 'metal-extra', { bpm: [168, 140, 210], drums: 'Double-Bass, Melodie', inst: ['Zwillingsgitarren', 'Chor'], mood: 'heroisch', from: 'ab 1985', g: 'pop', tweak: { b: 0.72 }, match: ['power metal'] }),
    ],
  },
  {
    id: 'hiphop', name: 'Hip-Hop und Rap',
    styles: [
      s('hiphop', 'Hip-Hop', 'hiphop', { bpm: [92, 80, 105], drums: 'Boom-Bap', inst: ['Sampling-Idee', 'Bass'], mood: 'erdig', from: 'ab 1979 Bronx', g: 'lofi', tweak: { b: 0.5, sw: 0.1 }, match: ['hip hop', 'hiphop', 'rap'] }),
      s('trap', 'Trap', 'hiphop', { bpm: [140, 130, 150], drums: '808-Bass, schnelle Hats', inst: ['808', 'Glockenspiel-artige Leads'], mood: 'dunkel, weit', from: 'ab 2003 Atlanta', g: 'trap', match: ['trap'] }),
      s('drill', 'Drill', 'hiphop', { bpm: [142, 130, 150], drums: 'Sliding 808, offbeat Hats', inst: ['Dunkle Melodien'], mood: 'kalt', from: 'ab 2010 Chicago/London', g: 'trap', tweak: { b: 0.4, r: 0.3 }, match: ['drill'] }),
      s('boombap', 'Boom Bap', 'hiphop', { bpm: [90, 84, 96], drums: 'Kick auf 1 und 3, Snare auf 2 und 4', inst: ['Vinyl-Sampling-Idee'], mood: 'klassisch', from: 'ab 1988', g: 'lofi', tweak: { b: 0.45, sw: 0.14 }, match: ['boom bap', 'boombap'] }),
      s('gfunk', 'G-Funk', 'hiphop', { bpm: [96, 88, 104], drums: 'Funk-Groove', inst: ['Whine-Synth', 'Pfeifen'], mood: 'lässig', from: 'ab 1992 Westküste', g: 'lofi', tweak: { b: 0.55, sw: 0.1 }, match: ['g-funk', 'gfunk'] }),
      s('cloudrap', 'Cloud Rap', 'hiphop', { bpm: [128, 120, 140], drums: 'weiche Hats', inst: ['Sägezahn-Pads'], mood: 'verträumt', from: 'ab 2010', g: 'trap', tweak: { b: 0.55, r: 0.5 }, match: ['cloud rap'] }),
      s('phonk', 'Phonk', 'hiphop', { bpm: [140, 120, 160], drums: 'Cowbell, verzerrte 808', inst: ['Memphis-Sample-Idee'], mood: 'düster, laut', from: 'ab 2010', g: 'trap', tweak: { b: 0.6 }, match: ['phonk'] }),
      s('lofihiphop', 'Lo-Fi Hip-Hop', 'hiphop', { bpm: [78, 66, 90], drums: 'weich, verrauscht', inst: ['Klavier', 'Vinylrauschen'], mood: 'ruhig', from: 'ab 2010', g: 'lofi', tweak: { b: 0.4, r: 0.4, sw: 0.12 }, match: ['lofi', 'lo-fi'] }),
      s('grime', 'Grime', 'hiphop', { bpm: [140, 130, 145], drums: 'harte, eckige Muster', inst: ['Bass-Sirup'], mood: 'nervös', from: 'ab 2002 London', g: 'trap', tweak: { b: 0.55 }, match: ['grime'] }),
      s('jazzrap', 'Jazz-Rap', 'hiphop', { bpm: [92, 80, 104], drums: 'Jazz-Besen', inst: ['Kontrabass', 'Klavier'], mood: 'warm', from: 'ab 1990', g: 'lofi', tweak: { b: 0.5, sw: 0.16 }, match: ['jazz rap'] }),
    ],
  },
  {
    id: 'rnb', name: 'R&B und Soul',
    styles: [
      s('rnb', 'R&B', 'rnb', { bpm: [92, 72, 108], drums: 'weiche Kicks, viele Ghost-Noten', inst: ['E-Piano', 'Bass'], mood: 'warm, sinnlich', from: 'ab 1950', g: 'lofi', tweak: { b: 0.5, sw: 0.1 }, match: ['r&b', 'rnb', 'rhythm and blues'] }),
      s('neosoul', 'Neo-Soul', 'rnb', { bpm: [84, 70, 96], drums: 'entspannt, synkopiert', inst: ['Rhodes', 'Bläser'], mood: 'gediegen', from: 'ab 1995', g: 'lofi', tweak: { b: 0.48, sw: 0.14 }, match: ['neo soul', 'neo-soul'] }),
      s('soul', 'Soul', 'rnb', { bpm: [92, 76, 110], drums: 'Backbeat mit Bläsern', inst: ['Bläser', 'Orgel'], mood: 'leidenschaftlich', from: 'ab 1960', g: 'lofi', tweak: { b: 0.55, sw: 0.08 }, match: ['soul'] }),
      s('motown', 'Motown', 'rnb', { bpm: [116, 104, 128], drums: 'Vier-Viertel mit Tambourin', inst: ['Bläser', 'Bass'], mood: 'fröhlich', from: 'ab 1961 Detroit', g: 'pop', tweak: { b: 0.7 }, match: ['motown'] }),
      s('funk', 'Funk', 'rnb', { bpm: [106, 96, 120], drums: 'One-Hit-Hat, Slap', inst: ['Slap-Bass', 'Gitarre'], mood: 'federnd', from: 'ab 1967', g: 'lofi', tweak: { b: 0.68, sw: 0.1 }, match: ['funk'] }),
      s('disco', 'Disco', 'rnb', { bpm: [120, 112, 130], drums: 'Four-on-the-Floor, offene Hi-Hat', inst: ['Streicher', 'Bläser'], mood: 'feiernd', from: 'ab 1974', g: 'house', tweak: { b: 0.72 }, match: ['disco'] }),
      s('quietstorm', 'Quiet Storm', 'rnb', { bpm: [76, 66, 88], drums: 'sehr weich', inst: ['Fender-Rhodes'], mood: 'nacht', from: 'ab 1980', g: 'lofi', tweak: { b: 0.4, r: 0.45 }, match: ['quiet storm'] }),
      s('gospel', 'Gospel', 'rnb', { bpm: [86, 70, 110], drums: 'Orgel-gestützt', inst: ['Hammond', 'Chor'], mood: 'erhebend', from: 'Tradition', g: 'lofi', tweak: { b: 0.6, sw: 0.08 }, match: ['gospel'] }),
    ],
  },
  {
    id: 'electronic', name: 'Elektronisch',
    styles: [
      s('house', 'House', 'electronic', { bpm: [124, 118, 130], drums: 'Four-on-the-Floor', inst: ['Klavier-Stabs', 'Bass'], mood: 'tanzend', from: 'ab 1984 Chicago', g: 'house', match: ['house'] }),
      s('deephouse', 'Deep House', 'electronic', { bpm: [122, 115, 128], drums: 'weiche Kicks', inst: ['Rhodes', 'Pad'], mood: 'tief, warm', from: 'ab 1990', g: 'house', tweak: { b: 0.5, r: 0.4 }, match: ['deep house'] }),
      s('techhouse', 'Tech-House', 'electronic', { bpm: [126, 120, 132], drums: 'Rolling Bass', inst: ['Saw-Bass'], mood: 'drängend', from: 'ab 2000', g: 'house', tweak: { b: 0.62 }, match: ['tech house', 'techhouse'] }),
      s('techno', 'Techno', 'electronic', { bpm: [135, 125, 150], drums: 'gerade Kick, metallische Hats', inst: ['Sequenzer', 'Noise'], mood: 'maschinell', from: 'ab 1985 Detroit', g: 'house', tweak: { b: 0.55, r: 0.3 }, match: ['techno'] }),
      s('trance', 'Trance', 'electronic', { bpm: [138, 132, 145], drums: 'rollend', inst: ['Supersaw-Pads', 'Arpeggien'], mood: 'schwebend', from: 'ab 1992', g: 'house', tweak: { b: 0.65, r: 0.5 }, match: ['trance'] }),
      s('edm', 'EDM / Big Room', 'electronic', { bpm: [128, 126, 132], drums: 'Festival-Kick', inst: ['Lead-Synth', 'Drop'], mood: 'groß', from: 'ab 2010', g: 'house', tweak: { b: 0.8 }, match: ['edm', 'big room'] }),
      s('dubstep', 'Dubstep', 'electronic', { bpm: [140, 138, 150], drums: 'Halftime', inst: ['Wobble-Bass'], mood: 'wuchtig', from: 'ab 2000 London', g: 'trap', tweak: { b: 0.6, r: 0.35 }, match: ['dubstep'] }),
      s('drumandbass', 'Drum and Bass', 'electronic', { bpm: [174, 168, 180], drums: 'Amen-artiges Breakbeat', inst: ['Subbass'], mood: 'schnell', from: 'ab 1993', g: 'trap', tweak: { b: 0.6, r: 0.3 }, match: ['drum and bass', 'dnb', 'drum & bass'] }),
      s('jungle', 'Jungle', 'electronic', { bpm: [160, 150, 170], drums: 'zerhackte Breaks', inst: ['Dub-Bass'], mood: 'rau', from: 'ab 1992', g: 'trap', tweak: { b: 0.55 }, match: ['jungle'] }),
      s('ambient', 'Ambient', 'electronic', { bpm: [60, 40, 80], drums: 'meist keine', inst: ['Flächen', 'Feldaufnahmen-Idee'], mood: 'ruhig, weit', from: 'ab 1978', g: 'cinematic', tweak: { b: 0.35, r: 0.65 }, match: ['ambient'] }),
      s('downtempo', 'Downtempo', 'electronic', { bpm: [90, 70, 105], drums: 'entspannt', inst: ['Rhodes', 'Feldaufnahmen'], mood: 'ruhig', from: 'ab 1993', g: 'lofi', tweak: { b: 0.45, r: 0.45 }, match: ['downtempo'] }),
      s('triphop', 'Trip-Hop', 'electronic', { bpm: [88, 80, 100], drums: 'schwerer, langsamer Beat', inst: ['Bass', 'Streichsatz'], mood: 'melancholisch', from: 'ab 1991 Bristol', g: 'lofi', tweak: { b: 0.4, r: 0.5 }, match: ['trip hop', 'triphop'] }),
      s('synthwave', 'Synthwave', 'electronic', { bpm: [104, 84, 120], drums: 'Drummachine, gated Snare', inst: ['Analogsynth', 'Arpeggio'], mood: 'retro', from: 'ab 2005', g: 'pop', tweak: { b: 0.62, r: 0.42 }, match: ['synthwave', 'retrowave'] }),
      s('vaporwave', 'Vaporwave', 'electronic', { bpm: [70, 60, 90], drums: 'langsam, verhallt', inst: ['Verlangsamte Flächen'], mood: 'schwebend', from: 'ab 2010', g: 'lofi', tweak: { b: 0.35, r: 0.6 }, match: ['vaporwave'] }),
      s('idm', 'IDM / Experimentell', 'electronic', { bpm: [130, 90, 180], drums: 'unregelmäßig', inst: ['Klangbasteln'], mood: 'kühl', from: 'ab 1992', g: 'trap', tweak: { b: 0.5, r: 0.4 }, match: ['idm', 'experimentell elektronisch'] }),
      s('garage', 'UK Garage', 'electronic', { bpm: [134, 128, 140], drums: 'Shuffle, geschnittene Stimmen', inst: ['Subbass'], mood: 'springend', from: 'ab 1995 London', g: 'house', tweak: { b: 0.6 }, match: ['uk garage', 'garage'] }),
      s('hardstyle', 'Hardstyle', 'electronic', { bpm: [150, 145, 160], drums: 'harte Kick mit Verzerrung', inst: ['Reverse-Bass'], mood: 'brachial', from: 'ab 2000 NL', g: 'house', tweak: { b: 0.7, r: 0.3 }, match: ['hardstyle'] }),
      s('psytrance', 'Psy-Trance', 'electronic', { bpm: [145, 138, 152], drums: 'rollende Basslinie', inst: ['Wirbelnde Arpeggien'], mood: 'hypnotisch', from: 'ab 1995 Goa', g: 'house', tweak: { b: 0.68, r: 0.42 }, match: ['psytrance', 'psy trance'] }),
      s('futurebass', 'Future Bass', 'electronic', { bpm: [150, 140, 160], drums: 'Halftime', inst: ['Sägezahn-Akkorde'], mood: 'bunt', from: 'ab 2013', g: 'trap', tweak: { b: 0.72, r: 0.35 }, match: ['future bass'] }),
    ],
  },
  {
    id: 'jazz-blues', name: 'Jazz und Blues',
    styles: [
      s('jazz', 'Jazz', 'jazz-blues', { bpm: [120, 80, 200], drums: 'Besen, Ride', inst: ['Kontrabass', 'Klavier', 'Bläser'], mood: 'frei', from: 'ab 1917', g: 'lofi', tweak: { b: 0.5, sw: 0.18 }, match: ['jazz'] }),
      s('swing', 'Swing', 'jazz-blues', { bpm: [160, 120, 220], drums: 'Shuffle-Becken', inst: ['Großes Bläserensemble'], mood: 'fröhlich', from: '1930er', g: 'lofi', tweak: { b: 0.62, sw: 0.2 }, match: ['swing'] }),
      s('bebop', 'Bebop', 'jazz-blues', { bpm: [210, 180, 280], drums: 'schnelles Ride', inst: ['Trompete', 'Saxofon'], mood: 'virtuos', from: 'ab 1945', g: 'lofi', tweak: { b: 0.55, sw: 0.16 }, match: ['bebop', 'bop'] }),
      s('bossa', 'Bossa Nova', 'jazz-blues', { bpm: [120, 100, 140], drums: 'Besen, ruhige Achtel', inst: ['Nylongitarre', 'Klavier'], mood: 'leicht', from: 'ab 1958 Brasilien', g: 'lofi', tweak: { b: 0.48, sw: 0.1 }, match: ['bossa', 'bossa nova'] }),
      s('samba', 'Samba', 'jazz-blues', { bpm: [100, 90, 120], drums: 'Surdo, Agogô', inst: ['Perkussion', 'Bläser'], mood: 'feiernd', from: 'Brasilien', g: 'lofi', tweak: { b: 0.66, sw: 0.12 }, match: ['samba'] }),
      s('afrobeat', 'Afrobeat', 'jazz-blues', { bpm: [112, 100, 128], drums: 'Perkussionsschicht', inst: ['Gitarren-Riff', 'Bläser'], mood: 'treibend', from: 'ab 1968 Nigeria', g: 'lofi', tweak: { b: 0.62, sw: 0.1 }, match: ['afrobeat', 'afro'] }),
      s('blues', 'Blues', 'jazz-blues', { bpm: [92, 70, 120], drums: 'Shuffle', inst: ['Slide-Gitarre', 'Mundharmonika'], mood: 'schwer, ehrlich', from: 'ab 1900', g: 'lofi', tweak: { b: 0.45, sw: 0.16 }, match: ['blues'] }),
      s('rhythmandblues-classic', 'Rhythm and Blues (klassisch)', 'jazz-blues', { bpm: [120, 100, 140], drums: 'Shuffle-Backbeat', inst: ['Klavier', 'Bläser'], mood: 'schwungvoll', from: 'ab 1945', g: 'lofi', tweak: { b: 0.6, sw: 0.14 }, match: ['rhythm and blues klassisch'] }),
      s('latinjazz', 'Latin Jazz', 'jazz-blues', { bpm: [140, 120, 200], drums: 'Clave', inst: ['Perkussion', 'Klavier'], mood: 'heiß', from: 'ab 1947', g: 'lofi', tweak: { b: 0.6, sw: 0.12 }, match: ['latin jazz'] }),
      s('gypsyjazz', 'Gypsy-Jazz', 'jazz-blues', { bpm: [180, 150, 240], drums: 'Pompe-Technik', inst: ['Akustikgitarre', 'Geige'], mood: 'flink', from: '1930er Frankreich', g: 'lofi', tweak: { b: 0.6, sw: 0.15 }, match: ['gypsy jazz', 'swing manouche'] }),
    ],
  },
  {
    id: 'klassik', name: 'Klassik und Filmmusik',
    styles: [
      s('klassik', 'Klassik', 'klassik', { bpm: [90, 40, 180], drums: 'keine', inst: ['Orchester'], mood: 'feierlich', from: 'ab 1600', g: 'cinematic', tweak: { b: 0.5, r: 0.5 }, match: ['klassik', 'orchester'] }),
      s('barock', 'Barock', 'klassik', { bpm: [92, 60, 120], drums: 'keine', inst: ['Cembalo', 'Streicher'], mood: 'verziert', from: '1600–1750', g: 'cinematic', tweak: { b: 0.62, r: 0.4 }, match: ['barock'] }),
      s('romantik', 'Romantik', 'klassik', { bpm: [72, 40, 140], drums: 'Pauken', inst: ['Großes Orchester'], mood: 'aufgewühlt', from: '1800–1900', g: 'cinematic', tweak: { b: 0.45, r: 0.55 }, match: ['romantik klassisch'] }),
      s('filmmusik', 'Filmmusik', 'klassik', { bpm: [80, 50, 140], drums: 'Pauken, große Trommel', inst: ['Orchester', 'Chor'], mood: 'groß', from: 'ab 1930', g: 'cinematic', tweak: { b: 0.42, r: 0.6 }, match: ['filmmusik', 'score'] }),
      s('trailer', 'Trailer-Musik', 'klassik', { bpm: [100, 80, 140], drums: 'Braams, Hits', inst: ['Blechbläser', 'Chor'], mood: 'wuchtig', from: 'ab 2000', g: 'cinematic', tweak: { b: 0.55, r: 0.5 }, match: ['trailer'] }),
      s('neoklassik', 'Neoklassik', 'klassik', { bpm: [70, 50, 100], drums: 'keine', inst: ['Klavier', 'Streicher'], mood: 'still', from: 'ab 2000', g: 'cinematic', tweak: { b: 0.4, r: 0.6 }, match: ['neoklassik', 'neo-klassik'] }),
      s('kammermusik', 'Kammermusik', 'klassik', { bpm: [84, 50, 140], drums: 'keine', inst: ['Streichquartett'], mood: 'nah', from: 'ab 1750', g: 'cinematic', tweak: { b: 0.55, r: 0.35 }, match: ['kammermusik'] }),
      s('oper', 'Oper', 'klassik', { bpm: [80, 40, 160], drums: 'Pauken', inst: ['Orchester', 'Gesang'], mood: 'dramatisch', from: 'ab 1600', g: 'cinematic', tweak: { b: 0.5, r: 0.55 }, match: ['oper', 'arie'] }),
    ],
  },
  {
    id: 'welt', name: 'Welt und Tradition',
    styles: [
      s('reggea', 'Reggae', 'welt', { bpm: [76, 60, 90], drums: 'One Drop', inst: ['Bass', 'Gitarre (Skank)'], mood: 'entspannt', from: 'ab 1968 Jamaika', g: 'lofi', tweak: { b: 0.55, r: 0.35 }, match: ['reggae', 'reggea'] }),
      s('dancehall', 'Dancehall', 'welt', { bpm: [100, 90, 110], drums: 'Riddim', inst: ['Bass', 'Synth'], mood: 'feiernd', from: 'ab 1980', g: 'lofi', tweak: { b: 0.65 }, match: ['dancehall'] }),
      s('ska', 'Ska', 'welt', { bpm: [150, 130, 180], drums: 'Offbeat', inst: ['Bläser', 'Gitarre'], mood: 'sprunghaft', from: 'ab 1959', g: 'pop', tweak: { b: 0.72 }, match: ['ska'] }),
      s('cumbia', 'Cumbia', 'welt', { bpm: [96, 85, 110], drums: 'Guacharaca', inst: ['Akkordeon', 'Perkussion'], mood: 'warm', from: 'Kolumbien', g: 'lofi', tweak: { b: 0.6, sw: 0.08 }, match: ['cumbia'] }),
      s('latin', 'Latin Pop', 'welt', { bpm: [96, 88, 110], drums: 'Reggaeton-Groove', inst: ['Gitarre', 'Perkussion'], mood: 'sommertauglich', from: 'ab 1990', g: 'lofi', tweak: { b: 0.68, sw: 0.06 }, match: ['latin', 'latino'] }),
      s('reggaeton', 'Reggaeton', 'welt', { bpm: [92, 88, 98], drums: 'Dembow', inst: ['Bass', 'Synth-Bell'], mood: 'heiß', from: 'ab 1994 Puerto Rico', g: 'lofi', tweak: { b: 0.7 }, match: ['reggaeton'] }),
      s('flamenco', 'Flamenco', 'welt', { bpm: [120, 90, 160], drums: 'Cajón, Palmas', inst: ['Nylongitarre'], mood: 'feurig', from: 'Andalusien', g: 'lofi', tweak: { b: 0.62, sw: 0.1 }, match: ['flamenco'] }),
      s('kletzmer', 'Klezmer', 'welt', { bpm: [140, 110, 180], drums: 'Bulgar', inst: ['Klarinette', 'Geige'], mood: 'festlich', from: 'Osteuropa', g: 'lofi', tweak: { b: 0.62, sw: 0.12 }, match: ['klezmer', 'kletzmer'] }),
      s('country', 'Country', 'welt', { bpm: [104, 80, 130], drums: 'Zwei-Vier-Backbeat', inst: ['Akustikgitarre', 'Pedal Steel', 'Geige'], mood: 'bodenständig', from: 'ab 1920 USA', g: 'pop', tweak: { b: 0.6 }, match: ['country'] }),
      s('folk', 'Folk', 'welt', { bpm: [96, 70, 130], drums: 'oft keine', inst: ['Akustikgitarre', 'Geige'], mood: 'erzählend', from: 'Tradition', g: 'pop', tweak: { b: 0.5, r: 0.3 }, match: ['folk'] }),
      s('celtic', 'Keltisch', 'welt', { bpm: [120, 90, 160], drums: 'Bodhrán', inst: ['Geige', 'Tin Whistle'], mood: 'weit', from: 'Irland/Schottland', g: 'cinematic', tweak: { b: 0.58, r: 0.42 }, match: ['keltisch', 'celtic', 'irisch'] }),
      s('nordic', 'Nordisch', 'welt', { bpm: [70, 50, 100], drums: 'Rahmentrommel', inst: ['Streicher', 'Horn'], mood: 'karg, groß', from: 'Nord', g: 'cinematic', tweak: { b: 0.35, r: 0.6 }, match: ['nordisch', 'nordic'] }),
      s('orientalisch', 'Orientalisch', 'welt', { bpm: [100, 80, 130], drums: 'Darbuka', inst: ['Oud', 'Kanonun-ähnlich'], mood: 'fremd, warm', from: 'Naher Osten', g: 'lofi', tweak: { b: 0.55, sw: 0.1 }, match: ['orientalisch', 'arabisch'] }),
      s('indisch', 'Indisch', 'welt', { bpm: [90, 60, 140], drums: 'Tabla', inst: ['Sitar', 'Tanpura'], mood: 'schwingend', from: 'Indien', g: 'cinematic', tweak: { b: 0.55, r: 0.45 }, match: ['indisch', 'bollywood'] }),
      s('klassik-chinesisch', 'Chinesisch traditionell', 'welt', { bpm: [76, 50, 110], drums: 'Große Trommel', inst: ['Erhu', 'Guzheng'], mood: 'erhaben', from: 'China', g: 'cinematic', tweak: { b: 0.5, r: 0.5 }, match: ['chinesisch'] }),
      s('japanisch-traditionell', 'Japanisch traditionell', 'welt', { bpm: [72, 50, 110], drums: 'Taiko', inst: ['Koto', 'Shakuhachi'], mood: 'still, streng', from: 'Japan', g: 'cinematic', tweak: { b: 0.45, r: 0.5 }, match: ['japanisch traditionell'] }),
      s('karibik', 'Karibik / Calypso', 'welt', { bpm: [120, 100, 140], drums: 'Steelpan-Groove', inst: ['Steelpan', 'Bläser'], mood: 'sonnig', from: 'Trinidad', g: 'pop', tweak: { b: 0.72 }, match: ['calypso', 'karibik'] }),
      s('gospel-afrikanisch', 'Afrikanischer Gospel', 'welt', { bpm: [100, 80, 130], drums: 'Trommeln, Chor', inst: ['Chor', 'Djembe'], mood: 'erhebend', from: 'Afrika', g: 'lofi', tweak: { b: 0.65, sw: 0.08 }, match: ['afrikanisch', 'afrobeats'] }),
    ],
  },
  {
    id: 'medien', name: 'Bühne, Medien, Hintergrund',
    styles: [
      s('musical', 'Musical', 'medien', { bpm: [120, 80, 180], drums: 'Orchester-Schlagwerk', inst: ['Orchester', 'Gesangsensemble'], mood: 'theatralisch', from: 'ab 1920', g: 'cinematic', tweak: { b: 0.65, r: 0.4 }, match: ['musical'] }),
      s('kabarett', 'Kabarett / Chanson', 'medien', { bpm: [100, 70, 130], drums: 'leicht', inst: ['Klavier', 'Akkordeon'], mood: 'pointiert', from: 'ab 1900', g: 'schlager', tweak: { b: 0.6 }, match: ['chanson', 'kabarett'] }),
      s('werbung', 'Werbe-Jingle', 'medien', { bpm: [128, 110, 150], drums: 'klarer Puls', inst: ['Synth-Bell', 'Klatschen'], mood: 'optimistisch', from: 'ab 1950', g: 'pop', tweak: { b: 0.8 }, match: ['jingle', 'werbung'] }),
      s('kindermusik', 'Kindermusik', 'medien', { bpm: [112, 90, 130], drums: 'einfach', inst: ['Glockenspiel', 'Xylophon'], mood: 'fröhlich', from: 'immer', g: 'pop', tweak: { b: 0.85 }, match: ['kindermusik', 'kinderlied'] }),
      s('weihnachten', 'Weihnachtsmusik', 'medien', { bpm: [96, 70, 130], drums: 'Glocken', inst: ['Glockenspiel', 'Streicher'], mood: 'festlich', from: 'Tradition', g: 'schlager', tweak: { b: 0.75, r: 0.4 }, match: ['weihnacht', 'christmas'] }),
      s('hoerspiel', 'Hörspiel-Untermalung', 'medien', { bpm: [80, 50, 120], drums: 'sparsam', inst: ['Streicher', 'Klangflächen'], mood: 'spannend', from: 'ab 1924', g: 'cinematic', tweak: { b: 0.42, r: 0.55 }, match: ['hörspiel', 'hoerspiel'] }),
      s('podcast', 'Podcast-Bett', 'medien', { bpm: [92, 70, 110], drums: 'weich, unaufdringlich', inst: ['Rhodes', 'Bass'], mood: 'zurückhaltend', from: 'ab 2004', g: 'lofi', tweak: { b: 0.45, r: 0.35 }, match: ['podcast bett', 'podcast intro'] }),
      s('audiobibel', 'Audiobibel-Untermalung', 'medien', { bpm: [66, 50, 84], drums: 'keine', inst: ['Streicher', 'Flöte'], mood: 'erhaben, ruhig', from: 'ab 1950', g: 'cinematic', tweak: { b: 0.36, r: 0.62 }, match: ['audiobibel', 'bibel'] }),
      s('nachrichten', 'Nachrichten-Bett', 'medien', { bpm: [120, 110, 132], drums: 'Puls', inst: ['Synth-Puls'], mood: 'sachlich', from: 'ab 1960', g: 'pop', tweak: { b: 0.6 }, match: ['nachrichten'] }),
      s('sport', 'Sport-Intro', 'medien', { bpm: [140, 120, 160], drums: 'wuchtig', inst: ['Bläser', 'Rock-Gitarre'], mood: 'aufputschend', from: 'ab 1970', g: 'pop', tweak: { b: 0.75 }, match: ['sport intro'] }),
    ],
  },
  {
    id: 'bass-club', name: 'Bass, Club, Szene',
    styles: [
      s('breakbeat', 'Breakbeat', 'bass-club', { bpm: [130, 120, 150], drums: 'gebrochene Beats', inst: ['Bass', 'Scratch'], mood: 'energisch', from: 'ab 1990', g: 'trap', tweak: { b: 0.6 }, match: ['breakbeat', 'breaks'] }),
      s('bigbeat', 'Big Beat', 'bass-club', { bpm: [126, 115, 140], drums: 'fette Breaks', inst: ['Bass', 'Loops'], mood: 'frech', from: 'ab 1995', g: 'trap', tweak: { b: 0.68 }, match: ['big beat'] }),
      s('glitchhop', 'Glitch Hop', 'bass-club', { bpm: [104, 90, 120], drums: 'zerstückelt', inst: ['Glitches', 'Bass'], mood: 'kantig', from: 'ab 2010', g: 'lofi', tweak: { b: 0.6 }, match: ['glitch hop'] }),
      s('moombahton', 'Moombahton', 'bass-club', { bpm: [108, 100, 116], drums: 'Dembow-langsam', inst: ['Bass', 'Synth'], mood: 'tropisch', from: 'ab 2009', g: 'house', tweak: { b: 0.72 }, match: ['moombahton'] }),
      s('bass-house', 'Bass House', 'bass-club', { bpm: [126, 120, 132], drums: 'Four-on-the-Floor + Wobble', inst: ['Sägezahn-Bass'], mood: 'drückend', from: 'ab 2010', g: 'house', tweak: { b: 0.68 }, match: ['bass house'] }),
      s('midtempo', 'Midtempo-Bass', 'bass-club', { bpm: [100, 90, 110], drums: 'Halftime', inst: ['Verzerrter Bass'], mood: 'finster', from: 'ab 2015', g: 'trap', tweak: { b: 0.55 }, match: ['midtempo'] }),
      s('lofi-house', 'Lo-Fi House', 'bass-club', { bpm: [120, 115, 126], drums: 'verwaschen', inst: ['Verrauschte Flächen'], mood: 'neblig', from: 'ab 2015', g: 'house', tweak: { b: 0.42, r: 0.45 }, match: ['lofi house'] }),
      s('afrohouse', 'Afro House', 'bass-club', { bpm: [122, 115, 128], drums: 'Perkussion über House-Kick', inst: ['Marimba-artig', 'Bass'], mood: 'tanzend, weit', from: 'ab 2010', g: 'house', tweak: { b: 0.62 }, match: ['afro house'] }),
      s('melodic-techno', 'Melodic Techno', 'bass-club', { bpm: [124, 118, 130], drums: 'rollend, lang', inst: ['Analoge Flächen', 'Arpeggio'], mood: 'treibend, melancholisch', from: 'ab 2012', g: 'house', tweak: { b: 0.5, r: 0.5 }, match: ['melodic techno'] }),
      s('hardcore-techno', 'Hardcore-Techno', 'bass-club', { bpm: [160, 150, 200], drums: 'harte Kick', inst: ['Verzerrte Flächen'], mood: 'gnadenlos', from: 'ab 1992', g: 'house', tweak: { b: 0.6 }, match: ['hardcore techno', 'gabber'] }),
    ],
  },
  {
    id: 'speziell', name: 'Spezielles und Mischformen',
    styles: [
      s('orchestral-epic', 'Episch orchestral', 'speziell', { bpm: [88, 60, 120], drums: 'Pauken, Taiko', inst: ['Orchester', 'Chor'], mood: 'erhaben', from: 'ab 1990', g: 'cinematic', tweak: { b: 0.5, r: 0.55 }, match: ['episch', 'epic'] }),
      s('darkambient', 'Dark Ambient', 'speziell', { bpm: [55, 40, 70], drums: 'keine', inst: ['Drohnen', 'Metallklänge'], mood: 'unheimlich', from: 'ab 1985', g: 'cinematic', tweak: { b: 0.22, r: 0.7 }, match: ['dark ambient'] }),
      s('industrial', 'Industrial', 'speziell', { bpm: [128, 100, 160], drums: 'Maschinenrhythmus', inst: ['Metallschläge'], mood: 'kalt, hart', from: 'ab 1976', g: 'trap', tweak: { b: 0.45, r: 0.4 }, match: ['industrial'] }),
      s('noise', 'Noise / Krach', 'speziell', { bpm: [120, 60, 200], drums: 'kein Takt nötig', inst: ['Rauschen', 'Rückkopplung'], mood: 'brutal', from: 'ab 1980', g: 'cinematic', tweak: { b: 0.4, r: 0.3 }, match: ['noise', 'lärm'] }),
      s('mathrock', 'Math-Rock', 'speziell', { bpm: [150, 120, 200], drums: 'unGerade Takte', inst: ['Gitarre mit Tapping'], mood: 'kantig, klug', from: 'ab 1990', g: 'pop', tweak: { b: 0.62 }, match: ['math rock'] }),
      s('postrock', 'Post-Rock', 'speziell', { bpm: [92, 60, 140], drums: 'aufbauend', inst: ['Gitarrenflächen', 'Streicher'], mood: 'weit, wachsend', from: 'ab 1992', g: 'cinematic', tweak: { b: 0.45, r: 0.55 }, match: ['post rock', 'postrock'] }),
      s('shoegaze', 'Shoegaze', 'speziell', { bpm: [104, 84, 130], drums: 'weich, verhallt', inst: ['Gitarrenwand'], mood: 'verträumt', from: 'ab 1988', g: 'pop', tweak: { b: 0.5, r: 0.6 }, match: ['shoegaze'] }),
      s('psychedelic', 'Psychedelic', 'speziell', { bpm: [108, 80, 140], drums: 'fließend', inst: ['Orgel', 'Effekte'], mood: 'schwebend', from: 'ab 1966', g: 'pop', tweak: { b: 0.55, r: 0.55 }, match: ['psychedelic', 'psychedelisch'] }),
      s('chillout', 'Chillout', 'speziell', { bpm: [100, 80, 120], drums: 'weich', inst: ['Flächen', 'Klavier'], mood: 'ruhig', from: 'ab 1990', g: 'lofi', tweak: { b: 0.45, r: 0.45 }, match: ['chillout', 'chill out'] }),
      s('meditation', 'Meditation / Klangschale', 'speziell', { bpm: [50, 30, 70], drums: 'keine', inst: ['Klangschalen', 'Flächen'], mood: 'still', from: 'Tradition', g: 'cinematic', tweak: { b: 0.3, r: 0.7 }, match: ['meditation', 'klangschale'] }),
      s('asmr', 'ASMR-Bett', 'speziell', { bpm: [60, 40, 80], drums: 'keine', inst: ['feine Geräusche'], mood: 'beruhigend', from: 'ab 2010', g: 'cinematic', tweak: { b: 0.3, r: 0.5 }, match: ['asmr'] }),
      s('elevator', 'Fahrstuhlmusik', 'speziell', { bpm: [100, 80, 120], drums: 'dezent', inst: ['Rhodes', 'Streicher'], mood: 'neutral', from: 'ab 1960', g: 'lofi', tweak: { b: 0.5, r: 0.4 }, match: ['fahrstuhl', 'easy listening'] }),
      s('spa', 'Wellness / Spa', 'speziell', { bpm: [72, 50, 90], drums: 'keine', inst: ['Flöten', 'Wasserklänge'], mood: 'entspannend', from: 'ab 1990', g: 'cinematic', tweak: { b: 0.35, r: 0.6 }, match: ['spa', 'wellness'] }),
      s('corporate', 'Corporate / Erklärvideo', 'speziell', { bpm: [110, 90, 130], drums: 'sauber', inst: ['Klavier', 'Synth', 'Streicher'], mood: 'freundlich, sachlich', from: 'ab 2000', g: 'pop', tweak: { b: 0.68, r: 0.3 }, match: ['corporate', 'erklärvideo'] }),
      s('tutorial', 'Tutorial-Bett', 'speziell', { bpm: [96, 80, 115], drums: 'leicht', inst: ['Gitarre', 'Rhodes'], mood: 'zugewandt', from: 'ab 2010', g: 'lofi', tweak: { b: 0.55, r: 0.3 }, match: ['tutorial'] }),
      s('8bit', 'Chiptune / 8-Bit', 'speziell', { bpm: [140, 110, 180], drums: 'Rechteck-Kick', inst: ['Pulsweite', 'Rauschen'], mood: 'spielerisch', from: 'ab 1983', g: 'pop', tweak: { b: 0.8, r: 0.05 }, match: ['chiptune', '8-bit', '8bit'] }),
      s('orchestral-trap', 'Orchestral Trap', 'speziell', { bpm: [140, 130, 150], drums: 'Trap', inst: ['Streicher', '808'], mood: 'monumental, hart', from: 'ab 2014', g: 'trap', tweak: { b: 0.6, r: 0.4 }, match: ['orchestral trap'] }),
      s('country-trap', 'Country Trap', 'speziell', { bpm: [132, 120, 145], drums: 'Trap', inst: ['Banjo-artig', '808'], mood: 'rau', from: 'ab 2018', g: 'trap', tweak: { b: 0.62 }, match: ['country trap'] }),
      s('k-pop-ballade', 'Pop-Ballade mit Streichern', 'speziell', { bpm: [72, 60, 86], drums: 'sparsam', inst: ['Klavier', 'Streicher'], mood: 'groß, nah', from: 'ab 1990', g: 'cinematic', tweak: { b: 0.5, r: 0.5 }, match: ['pop ballade'] }),
      s('stadion', 'Stadion-Hymne', 'speziell', { bpm: [124, 110, 140], drums: 'großer Beat, Klatschen', inst: ['Gitarren', 'Chor'], mood: 'mitreißend', from: 'ab 1985', g: 'pop', tweak: { b: 0.72, r: 0.35 }, match: ['stadion', 'hymne', 'anthem'] }),
    ],
  },
  {
    id: 'kirche', name: 'Kirche und Geistliches',
    styles: [
      s('worship', 'Anbetung / Worship', 'kirche', { bpm: [74, 62, 88], drums: 'ruhig, viel Becken', inst: ['Klavier', 'Gitarre mit Hall', 'Streicher'], mood: 'offen, getragen', from: 'ab 1990', g: 'cinematic', tweak: { b: 0.5, r: 0.55 }, match: ['worship', 'anbetung', 'lobpreis'] }),
      s('kirchenchor', 'Kirchenchor (A-cappella)', 'kirche', { bpm: [66, 54, 80], drums: '—', inst: ['Vierstimmiger Chor', 'Orgel stützt'], mood: 'feierlich, warm', from: 'Tradition', g: 'cinematic', tweak: { b: 0.45, r: 0.6 }, match: ['kirchenchor', 'chor a cappella', 'chor'] }),
      s('orgel-choral', 'Orgel und Choral', 'kirche', { bpm: [60, 48, 72], drums: '—', inst: ['Orgel', 'Gemeindegesang'], mood: 'erhaben', from: 'ab 1500', g: 'cinematic', tweak: { b: 0.4, r: 0.7 }, meter: '4/4 oder 3/4', match: ['choral', 'orgel', 'kirchenlied'] }),
      s('gregorianik', 'Gregorianik', 'kirche', { bpm: [56, 44, 70], drums: '—', inst: ['Einstimmiger Männerchor'], mood: 'schlicht, alt', from: 'ab 800', g: 'cinematic', tweak: { b: 0.35, r: 0.75 }, match: ['gregorianik', 'gregorianisch'] }),
      s('taize', 'Taizé / Gebetsgesang', 'kirche', { bpm: [62, 52, 74], drums: '—', inst: ['Chor', 'Sologesang', 'Orgel'], mood: 'ruhig, wiederholend', from: 'ab 1940', g: 'cinematic', tweak: { b: 0.42, r: 0.65 }, match: ['taize', 'gebetsgesang', 'kanon gesang'] }),
      s('spiritual', 'Spiritual', 'kirche', { bpm: [72, 60, 88], drums: 'Handklatschen, Fuß', inst: ['Chor', 'Solo mit Antwort'], mood: 'tief, hoffnungsvoll', from: 'ab 1800 USA', g: 'pop', tweak: { b: 0.5, r: 0.45 }, match: ['spiritual', 'gospel-klassisch'] }),
      s('gospel-deutsch', 'Gospel (deutsch)', 'kirche', { bpm: [86, 72, 104], drums: 'Live-Beat, Hammond-Orgel', inst: ['Chor', 'Orgel', 'Bläser'], mood: 'überschwänglich', from: 'ab 1930 USA', g: 'pop', s: 'major', tweak: { b: 0.62, r: 0.4 }, match: ['gospel deutsch', 'kirchen-gospel'] }),
      s('posaunenchor', 'Posaunenchor', 'kirche', { bpm: [92, 80, 112], drums: 'kleine Trommel möglich', inst: ['Blechbläser', 'Tuba'], mood: 'festlich, hell', from: 'ab 1850 DE', g: 'schlager', s: 'major', tweak: { b: 0.7, r: 0.35 }, match: ['posaunenchor', 'bläserchor'] }),
      s('weihnachtslied', 'Weihnachtslied', 'kirche', { bpm: [100, 84, 120], drums: 'leise Glocken, Besen', inst: ['Streicher', 'Glockenspiel', 'Chor'], mood: 'warm, festlich', from: 'Tradition', g: 'schlager', s: 'major', tweak: { b: 0.66, r: 0.5 }, match: ['weihnachtslied', 'advent', 'festlich still'] }),
      s('trauer-choral', 'Trauermusik / Choral', 'kirche', { bpm: [52, 44, 62], drums: '—', inst: ['Orgel', 'Streichquartett'], mood: 'getragen, still', from: 'Tradition', g: 'cinematic', tweak: { b: 0.3, r: 0.7 }, match: ['trauermusik', 'requiem', 'abschied'] }),
      s('marsch', 'Marsch', 'kirche', { bpm: [116, 104, 132], drums: 'Marschtrommel, gerade', inst: ['Blasorchester', 'Becken'], mood: 'aufrecht, geordnet', from: 'ab 1700', g: 'schlager', s: 'major', meter: '2/4 oder 4/4', match: ['marsch', 'blasmusik marsch'] }),
      s('fanfare', 'Fanfare / Eröffnung', 'kirche', { bpm: [120, 108, 140], drums: 'Pauke, Wirbel', inst: ['Trompeten', 'Hörner'], mood: 'strahlend, kurz', from: 'ab 1500', g: 'cinematic', s: 'major', tweak: { b: 0.78, r: 0.4 }, match: ['fanfare', 'eröffnung', 'intrade'] }),
    ],
  },
  {
    id: 'kinder', name: 'Kinder und Familie',
    styles: [
      s('kinderlied', 'Kinderlied', 'kinder', { bpm: [112, 96, 132], drums: 'einfach, hell', inst: ['Xylophon', 'Klavier', 'Gitarre'], mood: 'fröhlich, schlicht', from: 'immer', g: 'pop', s: 'major', tweak: { b: 0.85, r: 0.25 }, match: ['kinderlied', 'kindermusik'] }),
      s('wiegenlied', 'Wiegenlied / Gute-Nacht', 'kinder', { bpm: [62, 52, 74], drums: '—', inst: ['Klavier', 'Harfe', 'leise Streicher'], mood: 'sanft, müde', from: 'Tradition', g: 'cinematic', s: 'major', tweak: { b: 0.4, r: 0.5 }, meter: '3/4 oder 6/8', match: ['wiegenlied', 'gute nacht', 'schlaf'] }),
      s('lernlied', 'Lernlied (ABC, Zahlen)', 'kinder', { bpm: [116, 100, 132], drums: 'klare Eins, viel Pause', inst: ['Klavier', 'Klangstäbe'], mood: 'lehrreich, klar', from: 'ab 1900', g: 'pop', s: 'major', tweak: { b: 0.8, r: 0.3 }, match: ['lernlied', 'abc', 'zahlen'] }),
      s('bewegungslied', 'Bewegungs- und Spiellied', 'kinder', { bpm: [126, 112, 144], drums: 'Mitklatschen, Stampfen', inst: ['Akkordeon', 'Xylophon'], mood: 'quirlig', from: 'Tradition', g: 'schlager', s: 'major', tweak: { b: 0.88, r: 0.2 }, match: ['bewegungslied', 'spiellied', 'kindergarten'] }),
      s('kinderchor', 'Kinderchor', 'kinder', { bpm: [104, 88, 124], drums: 'leicht', inst: ['Kinderstimmen', 'Klavier'], mood: 'hell, gemeinschaftlich', from: 'Tradition', g: 'pop', s: 'major', tweak: { b: 0.82, r: 0.4 }, match: ['kinderchor', 'kinderstimmen'] }),
      s('hoerspiel-kinder', 'Kinderhörspiel-Bett', 'kinder', { bpm: [92, 80, 116], drums: 'sparsam, neugierig', inst: ['Klarinette', 'Celesta', 'Pizzicato'], mood: 'neugierig, freundlich', from: 'ab 1950', g: 'cinematic', s: 'major', tweak: { b: 0.6, r: 0.45 }, match: ['kinderhörspiel', 'hörspiel kinderbett'] }),
      s('kinderbibel-bett', 'Bibelgeschichte für Kinder (Bett)', 'kinder', { bpm: [76, 64, 92], drums: 'weich, ruhig', inst: ['Harfe', 'Flöte', 'Streicher'], mood: 'warm, erzählend', from: 'ab 1900', g: 'cinematic', s: 'major', tweak: { b: 0.5, r: 0.55 }, match: ['kinderbibel', 'bibelgeschichte kinder'] }),
      s('zirkus', 'Zirkus- und Ulkmusik', 'kinder', { bpm: [132, 118, 152], drums: 'Wirbel, Tusch', inst: ['Trompete', 'Tuba', 'Glockenspiel'], mood: 'schräg, komisch', from: 'ab 1890', g: 'schlager', s: 'major', meter: '2/4 oder 6/8', match: ['zirkus', 'ulk', 'komisch'] }),
    ],
  },
  {
    id: 'szene-neu', name: 'Neuere Szene-Stile',
    styles: [
      s('drift-phonk', 'Drift Phonk', 'szene-neu', { bpm: [150, 130, 170], drums: 'harte Kick, Cowbell', inst: ['Verzerrte 808', 'Vokal-Schnipsel'], mood: 'schnell, hart', from: 'ab 2019', g: 'trap', tweak: { b: 0.55, r: 0.2 }, match: ['drift phonk', 'phonk drift'] }),
      s('amapiano', 'Amapiano', 'szene-neu', { bpm: [112, 104, 120], drums: 'Log-Drum-Bass, Shaker', inst: ['Klavier-Akkorde', 'Piano-Linien'], mood: 'entspannt, tanzend', from: 'ab 2012 Südafrika', g: 'house', tweak: { b: 0.55, r: 0.3 }, match: ['amapiano'] }),
      s('afrobeats', 'Afrobeats (modern)', 'szene-neu', { bpm: [106, 98, 116], drums: 'lockerer Groove, Congas', inst: ['Gitarren-Riff', 'Bass'], mood: 'warm, lässig', from: 'ab 2010 Nigeria', g: 'pop', tweak: { b: 0.6, r: 0.3 }, match: ['afrobeats', 'afro pop'] }),
      s('afrohouse', 'Afro House', 'szene-neu', { bpm: [122, 114, 128], drums: 'Four-on-the-Floor + Percussion', inst: ['Marimba-artig', 'Pad'], mood: 'tief, treibend', from: 'ab 2015', g: 'house', tweak: { b: 0.5, r: 0.4 }, match: ['afro house', 'afrohouse'] }),
      s('hyperpop', 'Hyperpop', 'szene-neu', { bpm: [152, 130, 180], drums: 'schnelle Claps, Stopps', inst: ['Verzerrter Gesang', 'Sirenen'], mood: 'überdreht, hell', from: 'ab 2016', g: 'house', tweak: { b: 0.9, r: 0.2 }, match: ['hyperpop'] }),
      s('digicore', 'Digicore / Glitchcore', 'szene-neu', { bpm: [164, 140, 190], drums: 'zersplittert', inst: ['Sägezahn', 'Granular'], mood: 'nervös, digital', from: 'ab 2019', g: 'trap', tweak: { b: 0.85, r: 0.25 }, match: ['digicore', 'glitchcore'] }),
      s('jersey-club', 'Jersey Club', 'szene-neu', { bpm: [138, 128, 148], drums: 'gestotterte Kick, Dreierklatschen', inst: ['Vokal-Schnipsel', 'Bass'], mood: 'hakend, tanzend', from: 'ab 2000 USA', g: 'house', tweak: { b: 0.65 }, match: ['jersey club'] }),
      s('dembow', 'Dembow', 'szene-neu', { bpm: [118, 108, 128], drums: 'Dembow-Rhythmus', inst: ['Bass', 'Synth-Bläser'], mood: 'heiß, treibend', from: 'ab 1990 Karibik', g: 'house', tweak: { b: 0.68 }, match: ['dembow'] }),
      s('trap-latino', 'Trap Latino', 'szene-neu', { bpm: [140, 128, 150], drums: 'Trap', inst: ['808', 'Gitarre', 'Reggaeton-Percussion'], mood: 'dunkel, tanzend', from: 'ab 2007', g: 'trap', tweak: { b: 0.55 }, match: ['trap latino', 'latin trap'] }),
      s('corridos-tumbados', 'Corridos Tumbados', 'szene-neu', { bpm: [130, 120, 140], drums: 'Trap-Beat über Bläsern', inst: ['Tuba', 'Trompete', '12-Saiten-Gitarre'], mood: 'rau, erzählend', from: 'ab 2015 Mexiko', g: 'trap', tweak: { b: 0.6 }, match: ['corridos', 'tumbados', 'regional mexicano'] }),
      s('uk-drill', 'UK Drill', 'szene-neu', { bpm: [140, 132, 148], drums: 'rutschige 808 mit Sliden', inst: ['Kalte Pads'], mood: 'kalt, angespannt', from: 'ab 2012 London', g: 'trap', tweak: { b: 0.4, r: 0.3 }, match: ['uk drill', 'drill uk'] }),
      s('citypop', 'City Pop', 'szene-neu', { bpm: [106, 96, 118], drums: 'Live-Beat mit Besen', inst: ['E-Piano', 'Slap-Bass', 'Gitarre'], mood: 'leicht, abendlich', from: 'ab 1978 Japan', g: 'pop', s: 'major', tweak: { b: 0.62, r: 0.4 }, match: ['city pop', 'citypop'] }),
      s('future-funk', 'Future Funk', 'szene-neu', { bpm: [116, 108, 126], drums: 'House-Beat, Filter', inst: ['Zerschnittene Discosamples', 'Bass'], mood: 'nostalgisch, tanzend', from: 'ab 2010', g: 'house', s: 'major', tweak: { b: 0.8, r: 0.35 }, match: ['future funk'] }),
      s('phonk-house', 'Phonk House', 'szene-neu', { bpm: [128, 120, 136], drums: 'Four-on-the-Floor mit Phonk-Kick', inst: ['Verzerrter Bass'], mood: 'hart, druckvoll', from: 'ab 2021', g: 'house', tweak: { b: 0.6 }, match: ['phonk house'] }),
      s('hardtekk', 'Hardtekk', 'szene-neu', { bpm: [170, 160, 185], drums: 'harte Kick, offener Klang', inst: ['Verzerrter Bass', 'Sirene'], mood: 'grob, laut', from: 'ab 2015 DE', g: 'trap', tweak: { b: 0.7, r: 0.15 }, match: ['hardtekk', 'tekk'] }),
      s('gqom', 'Gqom', 'szene-neu', { bpm: [124, 118, 132], drums: 'hohle Kick, gebrochen', inst: ['Bass', 'Percussion'], mood: 'roh, düster', from: 'ab 2010 Durban', g: 'house', tweak: { b: 0.45, r: 0.3 }, match: ['gqom'] }),
      s('mahraganat', 'Mahraganat', 'szene-neu', { bpm: [128, 118, 140], drums: 'harter Elektro-Beat', inst: ['Orgel-Riff', 'Autotune-Gesang'], mood: 'laut, direkt', from: 'ab 2006 Ägypten', g: 'house', tweak: { b: 0.72 }, match: ['mahraganat', 'arab electro'] }),
      s('desert-blues', 'Desert Blues', 'szene-neu', { bpm: [96, 84, 110], drums: 'Handtrommeln, treibend', inst: ['E-Gitarre im Wüsten-Tuning', 'Bass'], mood: 'weit, hypnotisch', from: 'ab 1980 Sahara', g: 'pop', tweak: { b: 0.5, r: 0.3 }, match: ['desert blues', 'wüstenblues', 'tinariwen'] }),
    ],
  },
];

const STYLES = FAMILIES.flatMap((f) => f.styles.map((x) => Object.assign({ family_name: f.name }, x)));

function defaults() { return { picks: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['picks', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function find(styleId) {
  const v = String(styleId || '').toLowerCase().trim();
  if (!v) return null;
  const hit = STYLES.find((x) => x.id === v) || STYLES.find((x) => x.name.toLowerCase() === v)
    || STYLES.find((x) => x.id.replace(/-/g, ' ') === v.replace(/-/g, ' '));
  if (hit) return hit;
  return read(styleId);   // freier Text („ich will einen gospel song") wird auch verstanden
}

// Aus einem Wunschtext den Stil lesen (längste Übereinstimmung gewinnt).
function read(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  let best = null, bestLen = 0;
  for (const st of STYLES) for (const kw of st.match) if (t.includes(kw) && kw.length > bestLen) { best = st; bestLen = kw.length; }
  return best;
}

// Ein Stil als fertiger Render-Plan: Gerüst aus dem Renderer + die Werte, die den Stil ausmachen.
function toRender(styleId, extra) {
  const st = find(styleId) || read(styleId);
  if (!st) return { ok: false, error: `Stil unbekannt: „${styleId}“` };
  const p = extra || {};
  const r = st.render || {};
  const t = STYLES.find((x) => x.id === st.id);
  const plan = {
    ok: true, style_id: st.id, style_name: st.name, family: t.family_name,
    render_style: r.g, bpm: Number(p.bpm) || t.bpm[0], scale: p.scale || r.s,
    bars: Number(p.bars) || 8, key: p.key || 'A',
    character: { brightness: r.b !== undefined ? r.b : 0.6, reverb: r.r !== undefined ? r.r : 0.3, swing: r.sw !== undefined ? r.sw : 0 },
    drums_note: st.drums, instruments: st.instruments, mood: st.mood, from: st.from,
    mapping_note: `Der Renderer hat sechs Grundgerüste. „${st.name}“ läuft auf „${r.g}“ mit Tempo ${t.bpm[0]} bpm, Tonleiter ${r.s}, Klangfarbe ${r.b !== undefined ? r.b : 0.6}, Hall ${r.r !== undefined ? r.r : 0.3}${r.sw ? ', Swing ' + r.sw : ''}.`,
    honest: 'Die Tempo- und Instrumentenangaben sind die in der Praxis üblichen Spannen für diesen Stil, keine Messung an einem bestimmten Stück.',
  };
  const d = load();
  d.picks.unshift({ at: new Date().toISOString(), style: st.id, bpm: plan.bpm, render_style: r.g });
  d.picks = d.picks.slice(0, 500);
  save(d);
  return plan;
}

function list(input) {
  const p = input || {};
  const fam = p.family ? String(p.family).toLowerCase() : null;
  const rows = (fam ? STYLES.filter((x) => x.family === fam) : STYLES).map((x) => ({
    id: x.id, name: x.name, family: x.family, family_name: x.family_name,
    bpm: x.bpm, meter: x.meter, drums: x.drums, mood: x.mood, from: x.from,
    render_style: x.render.g, scale: x.render.s,
  }));
  if (fam && !rows.length) return { ok: false, error: `Familie unbekannt. Erlaubt: ${FAMILIES.map((f) => f.id).join(', ')}` };
  return { ok: true, families: FAMILIES.length, styles: STYLES.length, shown: rows.length, rows: p.full === true ? rows : rows.slice(0, 40) };
}

function status() {
  const d = load();
  const byFamily = FAMILIES.map((f) => ({ id: f.id, name: f.name, styles: f.styles.length }));
  const byGrund = STYLES.reduce((a, x) => { a[x.render.g] = (a[x.render.g] || 0) + 1; return a; }, {});
  return {
    area: 'STYLES', module: 'styles_catalog', state: 'live', file: FILE,
    families: FAMILIES.length, styles: STYLES.length, by_family: byFamily, by_renderer: byGrund,
    picks: d.picks.length,
    rules: ['Jeder Stil sagt, worauf er im Renderer abgebildet wird — kein Stil behauptet einen eigenen Klangerzeuger.', 'Tempo und Instrumente sind übliche Spannen, keine Messungen.', 'Der Renderer kennt sechs Grundgerüste; alles Weitere sind Tempo, Tonleiter, Klangfarbe und Hall.', 'Gelesen wird aus dem Wunschtext — die längste Übereinstimmung gewinnt.'],
  };
}

module.exports = {
  meta: { area: 'STYLES', id: 'styles_catalog', name: 'Stilkatalog (jeder gängige Stil mit Zahlen und Renderer-Zuordnung)', state: 'live' },
  actions: {
    status: () => status(),
    list: (p) => list(p || {}),
    families: () => ({ ok: true, families: FAMILIES.map((f) => ({ id: f.id, name: f.name, styles: f.styles.length })) }),
    get: (p) => { const st = find((p || {}).id); return st ? { ok: true, style: st } : { ok: false, error: 'Stil unbekannt' }; },
    read: (p) => { const st = read((p || {}).text); return st ? { ok: true, style: { id: st.id, name: st.name, family: st.family, bpm: st.bpm } } : { ok: false, error: 'kein bekannter Stil im Text' }; },
    to_render: (p) => toRender((p || {}).style || (p || {}).text, p || {}),
    picks: () => { const d = load(); return { ok: true, count: d.picks.length, picks: d.picks.slice(0, 30) }; },
  },
  FAMILIES, STYLES, find, read, toRender, status,
};
