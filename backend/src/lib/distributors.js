'use strict';
// AURA · Verteiler (Distributoren) — mit den **originalen Adressen**, damit jeder nachsehen kann.
//
// Der gerade Weg steht hier im Mittelpunkt:
//   · Podcast/Audiobibel  → **eine** RSS-Adresse, die Verzeichnisse holen sich die Folge selbst (kein Upload je Haus)
//   · Musik/Hörbuch       → Master + Kennungen (ISRC/UPC) → Verteiler → Läden → Abrechnung
//   · Video/Print         → Plattform bzw. Dienst, jeweils mit Mensch als letzter Instanz
//
// Zu jedem Eintrag: Original-Adresse, wie man hineinkommt, wie abgerechnet wird, was AURA braucht und
// ob Automatik möglich ist. „Automatik" heißt hier nicht „wir machen es heimlich", sondern: gibt es
// einen offenen Weg (RSS) oder braucht es ein Konto mit Schlüssel.
//
// Ehrlich: Von diesen Häusern ist hier **keines** verbunden. Ohne Konto/Schlüssel bleibt es bei Plan
// und Paket. Nichts wird hochgeladen, nichts wird angemeldet, keine Adresse erfunden.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_DISTRIBUTORS_FILE || path.join(__dirname, '..', 'data', 'distributors.json');

const D = (id, name, kind, link, a) => ({
  id, name, kind, link,
  model: a.model || '',
  admission: a.admission || 'Konto nötig',
  automation: a.automation || 'MANUELL',
  takes: a.takes || '',
  needs: a.needs || [],
  note: a.note || '',
  region: a.region || 'weltweit',
});

const DISTRIBUTORS = [
  // ---------------------------------------------------------------- Podcast (RSS wird abgeholt)
  D('spotify-podcasters', 'Spotify for Podcasters', 'podcast', 'https://podcasters.spotify.com', { model: 'kostenlos, Werbung optional', admission: 'Konto, Feed einreichen', automation: 'RSS-ABO', takes: 'Verzeichnis + Auswertung', needs: ['RSS-Feed', 'Konto'], note: 'Zieht die Folge selbst aus dem Feed. Danach nie wieder etwas hochladen.' }),
  D('apple-podcasts', 'Apple Podcasts Connect', 'podcast', 'https://podcastsconnect.apple.com', { model: 'kostenlos', admission: 'Apple-ID, Feed einreichen', automation: 'RSS-ABO', takes: 'größtes Verzeichnis', needs: ['RSS-Feed', 'Apple-ID'] }),
  D('amazon-music-podcasts', 'Amazon Music for Podcasters', 'podcast', 'https://podcasters.amazon.com', { model: 'kostenlos', admission: 'Amazon-Konto', automation: 'RSS-ABO', takes: 'Amazon Music + Audible-Podcasts', needs: ['RSS-Feed', 'Amazon-Konto'] }),
  D('youtube-podcasts', 'YouTube Studio (Podcasts)', 'podcast', 'https://studio.youtube.com', { model: 'Werbung/Abos', admission: 'Google-Konto', automation: 'MANUELL', takes: 'Video- und Audio-Folgen, größte Reichweite', needs: ['Konto', 'Videodatei oder Feed'] }),
  D('deezer-creators', 'Deezer for Creators', 'podcast', 'https://creators.deezer.com', { model: 'kostenlos', admission: 'Konto', automation: 'RSS-ABO', takes: 'Deezer-Verzeichnis', needs: ['RSS-Feed', 'Konto'] }),
  D('tunein', 'TuneIn Broadcasters', 'podcast', 'https://tunein.com/broadcasters/', { model: 'kostenlos / Werbung', admission: 'Konto', automation: 'RSS-ABO', takes: 'Radio- und Podcast-Verzeichnis', needs: ['RSS-Feed', 'Konto'] }),
  D('iheart-podcasters', 'iHeartRadio Podcasters', 'podcast', 'https://podcasters.iheart.com', { model: 'kostenlos', admission: 'Konto', automation: 'RSS-ABO', takes: 'US-Verzeichnis', needs: ['RSS-Feed', 'Konto'], region: 'USA' }),
  D('pandora-podcasters', 'Pandora for Podcasters', 'podcast', 'https://podcasters.pandora.com', { model: 'kostenlos', admission: 'Konto', automation: 'RSS-ABO', takes: 'US-Verzeichnis', needs: ['RSS-Feed', 'Konto'], region: 'USA' }),
  D('podcastindex', 'Podcast Index', 'podcast', 'https://podcastindex.org', { model: 'offen, keine Anmeldung', admission: 'offen', automation: 'RSS-ABO', takes: 'offenes Verzeichnis, wird von vielen Apps gelesen', needs: ['RSS-Feed'], note: 'Der offene Weg: kein Konto, kein Vertrag. Viele Apps lesen von hier.' }),
  D('fyyd', 'fyyd', 'podcast', 'https://fyyd.de', { model: 'offen', admission: 'offene Anmeldung', automation: 'RSS-ABO', takes: 'deutsches Verzeichnis', needs: ['RSS-Feed'], region: 'DE/AT/CH' }),
  D('podigee', 'Podigee', 'podcast', 'https://www.podigee.com', { model: 'Abo je nach Volumen', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting + Verzeichnisse', needs: ['Konto'], region: 'DE' }),
  D('podbean', 'Podbean', 'podcast', 'https://www.podbean.com', { model: 'kostenlos / Abo', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting + Verzeichnis', needs: ['Konto'] }),
  D('buzzsprout', 'Buzzsprout', 'podcast', 'https://www.buzzsprout.com', { model: 'kostenlos / Abo', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting + Verzeichnis', needs: ['Konto'] }),
  D('libsyn', 'Libsyn', 'podcast', 'https://libsyn.com', { model: 'Abo', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting + Verzeichnis', needs: ['Konto'] }),
  D('blubrry', 'Blubrry', 'podcast', 'https://blubrry.com', { model: 'Abo', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting + Statistik', needs: ['Konto'] }),
  D('transistor', 'Transistor', 'podcast', 'https://transistor.fm', { model: 'Abo', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting für mehrere Shows', needs: ['Konto'] }),
  D('acast', 'Acast', 'podcast', 'https://www.acast.com', { model: 'kostenlos / Werbung', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting + Vermarktung', needs: ['Konto'] }),
  D('castbox-creator', 'Castbox Creator', 'podcast', 'https://castbox.fm/creator', { model: 'kostenlos', admission: 'Konto', automation: 'RSS-ABO', takes: 'asiatischer Markt', needs: ['RSS-Feed', 'Konto'] }),
  D('rss-com', 'RSS.com', 'podcast', 'https://rss.com', { model: 'kostenlos / Abo', admission: 'Konto', automation: 'RSS-ABO', takes: 'Hosting', needs: ['Konto'] }),
  D('auphonic', 'Auphonic', 'podcast', 'https://auphonic.com', { model: 'Freiminuten, dann Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Pegel, Rauschen, Lautheit, Kapitelmarken', needs: ['Konto', 'API-Token'], note: 'Nachbearbeitung. Läuft auch ohne — unser eigener Pegel-Rechner kann viel davon.' }),
  D('podlove', 'Podlove Publisher', 'podcast', 'https://podlove.org', { model: 'frei (Open Source)', admission: 'offen', automation: 'RSS-ABO', takes: 'Feed mit Kapitelmarken und Transkript', needs: [], note: 'Wir bauen den Feed selbst — das ist die Vorlage dafür, was in einem guten Feed steht.' }),
  D('antennapod', 'AntennaPod', 'podcast', 'https://antennapod.org', { model: 'frei', admission: 'offen', automation: 'RSS-ABO', takes: 'Abspieler, liest offene Verzeichnisse', needs: [], note: 'Prüfweg: wenn diese App den Feed liest, liest ihn jedes Verzeichnis.' }),

  // ---------------------------------------------------------------- Hörbuch
  D('acx', 'ACX (Audible)', 'hoerbuch', 'https://www.acx.com', { model: 'Beteiligung oder Einmalkauf', admission: 'Konto, Titelprüfung', automation: 'MANUELL', takes: 'Audible US/UK/DE', needs: ['Konto', 'Steuerdaten', 'Ton in Studioqualität'], note: 'Strenge Tonvorgaben (Lautheit, Rauschen). Unser Master-Prüflauf liefert die Zahlen dazu.' }),
  D('audible-de', 'Audible (DE) Autorenseite', 'hoerbuch', 'https://www.audible.de', { model: 'Beteiligung', admission: 'Konto', automation: 'MANUELL', takes: 'deutscher Markt', needs: ['Konto'], region: 'DE' }),
  D('apple-books-authors', 'Apple Books for Authors', 'hoerbuch', 'https://authors.apple.com', { model: '70 %', admission: 'Apple-ID', automation: 'MANUELL', takes: 'Apple Books (Hörbuch + eBook)', needs: ['Apple-ID', 'UPC'], note: 'Braucht eine UPC (unsere Rechnung liefert eine gültige EAN-13 mit Prüfziffer).' }),
  D('google-play-books', 'Google Play Books Partner Center', 'hoerbuch', 'https://play.google.com/books/publish', { model: '70 % / 45 %', admission: 'Konto', automation: 'MANUELL', takes: 'Google Play Bücher', needs: ['Konto', 'UPC'] }),
  D('kobo-writinglife', 'Kobo Writing Life', 'hoerbuch', 'https://www.kobo.com/writinglife', { model: '70 %', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Kobo, Bibliotheken', needs: ['Konto'] }),
  D('findaway-voices', 'Findaway Voices (Spotify)', 'hoerbuch', 'https://findawayvoices.com', { model: 'Beteiligung', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Spotify, Bibliotheken, viele Läden', needs: ['Konto', 'UPC'] }),
  D('draft2digital', 'Draft2Digital', 'hoerbuch', 'https://www.draft2digital.com', { model: 'Beteiligung', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'eBook + Hörbuch über Partner', needs: ['Konto'] }),
  D('bookwire', 'Bookwire', 'hoerbuch', 'https://www.bookwire.de', { model: 'Verteiler-Beteiligung', admission: 'Vertrag', automation: 'PARTNER', takes: 'Hörbuch und eBook an viele Läden und Bibliotheken', needs: ['Vertrag', 'UPC'], region: 'DE/EU', note: 'Der deutsche Weg für Verlage. Vertrag nötig — das entscheidet ein Mensch.' }),
  D('zebralution', 'Zebralution', 'hoerbuch', 'https://www.zebralution.com', { model: 'Beteiligung', admission: 'Vertrag', automation: 'PARTNER', takes: 'Musik und Hörbuch weltweit', needs: ['Vertrag'], region: 'DE' }),
  D('feiyr', 'Feiyr', 'hoerbuch', 'https://www.feiyr.com', { model: 'je Titel oder Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Musik, Hörbuch, Video an viele Läden', needs: ['Konto'], region: 'DE' }),
  D('storytel', 'Storytel', 'hoerbuch', 'https://www.storytel.com', { model: 'Beteiligung über Verteiler', admission: 'über Verteiler', automation: 'PARTNER', takes: 'Abo-Hörbuch Nordeuropa/EU', needs: ['Verteiler'], region: 'Nordeuropa/EU' }),
  D('bookmate', 'Bookmate', 'hoerbuch', 'https://bookmate.com', { model: 'Beteiligung', admission: 'über Verteiler', automation: 'PARTNER', takes: 'Abo-Modell, Osteuropa', needs: ['Verteiler'] }),
  D('overdrive', 'OverDrive / Libby', 'hoerbuch', 'https://www.overdrive.com', { model: 'Bibliothekslizenz', admission: 'über Verteiler', automation: 'PARTNER', takes: 'öffentliche Bibliotheken', needs: ['Verteiler'] }),
  D('hoopla', 'hoopla digital', 'hoerbuch', 'https://www.hoopladigital.com', { model: 'Bibliothekslizenz', admission: 'über Verteiler', automation: 'PARTNER', takes: 'Bibliotheken', needs: ['Verteiler'] }),
  D('libro-fm', 'Libro.fm', 'hoerbuch', 'https://libro.fm', { model: 'Beteiligung, Buchläden', admission: 'über Verteiler', automation: 'PARTNER', takes: 'unabhängige Buchläden', needs: ['Verteiler'] }),
  D('chirp', 'Chirp', 'hoerbuch', 'https://www.chirpbooks.com', { model: 'Aktionspreise', admission: 'über Verteiler', automation: 'PARTNER', takes: 'Sonderaktionen', needs: ['Verteiler'] }),
  D('thalia', 'Thalia', 'hoerbuch', 'https://www.thalia.de', { model: 'Beteiligung', admission: 'über Verteiler', automation: 'PARTNER', takes: 'deutscher Handel', needs: ['Verteiler'], region: 'DE' }),
  D('sprecherverband', 'Verband der Sprecher (VDS)', 'hoerbuch', 'https://www.sprecherverband.de', { model: '—', admission: '—', automation: 'MANUELL', takes: 'Fachwissen, Sprecherlisten, Standards', needs: [], note: 'Für die Frage, wie eine Sprecher-Aufnahme abgesichert wird. Kein Vertrieb.' }),

  // ---------------------------------------------------------------- Musik
  D('distrokid', 'DistroKid', 'musik', 'https://distrokid.com', { model: 'Jahresabo, 100 % bleiben', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'alle großen Läden, Content ID', needs: ['Konto', 'UPC/ISRC'] }),
  D('tunecore', 'TuneCore', 'musik', 'https://www.tunecore.com', { model: 'je Titel / Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Läden + Publishing-Verwaltung', needs: ['Konto'] }),
  D('cdbaby', 'CD Baby', 'musik', 'https://cdbaby.com', { model: 'Einmalgebühr je Titel', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Läden, Sync-Vermittlung', needs: ['Konto'] }),
  D('amuse', 'Amuse', 'musik', 'https://www.amuse.io', { model: 'kostenlos / Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Läden', needs: ['Konto'] }),
  D('routenote', 'RouteNote', 'musik', 'https://routenote.com', { model: 'kostenlos, 85 %', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Läden', needs: ['Konto'] }),
  D('landr', 'LANDR', 'musik', 'https://www.landr.com', { model: 'Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Mastering + Vertrieb', needs: ['Konto'] }),
  D('ditto', 'Ditto Music', 'musik', 'https://dittomusic.com', { model: 'Jahresabo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Läden, Labeldienste', needs: ['Konto'] }),
  D('symphonic', 'Symphonic Distribution', 'musik', 'https://symphonicdistribution.com', { model: 'Beteiligung', admission: 'Konto/Prüfung', automation: 'PARTNER', takes: 'Läden, Sync', needs: ['Konto'] }),
  D('toolost', 'Too Lost', 'musik', 'https://www.toolost.com', { model: 'Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Läden, Publishing', needs: ['Konto'] }),
  D('unitedmasters', 'UnitedMasters', 'musik', 'https://unitedmasters.com', { model: 'Abo / Beteiligung', admission: 'Konto', automation: 'PARTNER', takes: 'Läden + Marken-Deals', needs: ['Konto'], region: 'USA' }),
  D('vydia', 'Vydia', 'musik', 'https://vydia.com', { model: 'Vertrag', admission: 'Bewerbung', automation: 'PARTNER', takes: 'Labeldienste', needs: ['Vertrag'] }),
  D('believe', 'Believe', 'musik', 'https://www.believe.com', { model: 'Vertrag', admission: 'Bewerbung', automation: 'PARTNER', takes: 'große Verteilung', needs: ['Vertrag'] }),
  D('orchard', 'The Orchard', 'musik', 'https://www.theorchard.com', { model: 'Vertrag', admission: 'Bewerbung', automation: 'PARTNER', takes: 'Labeldienste', needs: ['Vertrag'] }),
  D('label-worx', 'Label Worx', 'musik', 'https://www.label-worx.com', { model: 'Beteiligung', admission: 'Bewerbung', automation: 'PARTNER', takes: 'elektronische Musik, Beatport/Traxsource', needs: ['Konto'] }),
  D('bandcamp', 'Bandcamp', 'musik', 'https://bandcamp.com', { model: 'direkt, 82–90 %', admission: 'Konto', automation: 'MANUELL', takes: 'Direktverkauf, eigene Hörer', needs: ['Konto'], note: 'Der ehrlichste Weg: die Leute kaufen direkt. Kein Verteiler dazwischen.' }),
  D('soundcloud', 'SoundCloud', 'musik', 'https://soundcloud.com', { model: 'Abo für Monetarisierung', admission: 'Konto', automation: 'MANUELL', takes: 'Community', needs: ['Konto'] }),
  D('audiomack', 'Audiomack', 'musik', 'https://audiomack.com', { model: 'kostenlos / Programm', admission: 'Konto', automation: 'MANUELL', takes: 'Hip-Hop-Publikum', needs: ['Konto'] }),
  D('jamendo', 'Jamendo Licensing', 'musik', 'https://www.jamendo.com', { model: 'Lizenzverkauf', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Musik für Werbung/Film', needs: ['Konto'], note: 'Für Verwertung, nicht für Streaming-Reichweite.' }),
  D('spotify-for-artists', 'Spotify for Artists', 'musik', 'https://artists.spotify.com', { model: 'über Verteiler', admission: 'Verteiler nötig', automation: 'MANUELL', takes: 'Profil, Pitch an Redaktionen', needs: ['Verteiler', 'Spotify-Konto'], note: 'Nicht zum Hochladen — zum Pflegen und Pitchen.' }),
  D('apple-music-artists', 'Apple Music for Artists', 'musik', 'https://artists.apple.com', { model: 'über Verteiler', admission: 'Verteiler nötig', automation: 'MANUELL', takes: 'Profil, Auswertung', needs: ['Verteiler', 'Apple-ID'] }),
  D('amazon-artists', 'Amazon Music for Artists', 'musik', 'https://artists.amazonmusic.com', { model: 'über Verteiler', admission: 'Verteiler nötig', automation: 'MANUELL', takes: 'Profil, Auswertung', needs: ['Verteiler', 'Amazon-Konto'] }),
  D('beatport', 'Beatport', 'musik', 'https://www.beatport.com', { model: 'über Verteiler', admission: 'Verteiler nötig', automation: 'PARTNER', takes: 'DJ-Markt', needs: ['Verteiler'], note: 'Wird über Label Worx & Co. bespielt, nicht direkt.' }),
  D('traxsource', 'Traxsource', 'musik', 'https://www.traxsource.com', { model: 'über Verteiler', admission: 'Verteiler nötig', automation: 'PARTNER', takes: 'House/Techno-Markt', needs: ['Verteiler'] }),
  D('qobuz', 'Qobuz', 'musik', 'https://www.qobuz.com', { model: 'über Verteiler', admission: 'Verteiler nötig', automation: 'PARTNER', takes: 'hochauflösend, Frankreich/EU', needs: ['Verteiler'] }),
  D('tidal', 'TIDAL', 'musik', 'https://tidal.com', { model: 'über Verteiler', admission: 'Verteiler nötig', automation: 'PARTNER', takes: 'Streaming', needs: ['Verteiler'] }),

  // ---------------------------------------------------------------- Verwertung und Rechte
  D('gema', 'GEMA', 'verwertung', 'https://www.gema.de', { model: 'Beteiligung an Aufführungen', admission: 'Anmeldung, Prüfung', automation: 'MANUELL', takes: 'Aufführungs- und Senderechte', needs: ['Vertrag', 'Werkdaten'], region: 'DE', note: 'Die Werkmeldung ist Papierarbeit mit Fristen. Unser Rechte-Baustein hält die Werke samt ISRC bereit.' }),
  D('gvl', 'GVL', 'verwertung', 'https://www.gvl.de', { model: 'Vergütungen', admission: 'Anmeldung', automation: 'MANUELL', takes: 'Leistungsschutzrechte der Ausübenden und Produzenten', needs: ['Vertrag'], region: 'DE' }),
  D('suisa', 'SUISA', 'verwertung', 'https://www.suisa.ch', { model: 'Beteiligung', admission: 'Anmeldung', automation: 'MANUELL', takes: 'Schweiz', needs: ['Vertrag'], region: 'CH' }),
  D('akm', 'AKM', 'verwertung', 'https://www.akm.at', { model: 'Beteiligung', admission: 'Anmeldung', automation: 'MANUELL', takes: 'Österreich', needs: ['Vertrag'], region: 'AT' }),
  D('songtrust', 'Songtrust', 'verwertung', 'https://www.songtrust.com', { model: 'Beteiligung', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Publishing-Verwaltung weltweit', needs: ['Konto'] }),
  D('sentric', 'Sentric Music', 'verwertung', 'https://sentricmusic.com', { model: 'Beteiligung', admission: 'Bewerbung', automation: 'MANUELL', takes: 'Publishing', needs: ['Vertrag'] }),
  D('songtradr', 'Songtradr', 'verwertung', 'https://www.songtradr.com', { model: 'Beteiligung beim Lizenzverkauf', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Sync-Lizenzen für Werbung/Film', needs: ['Konto'] }),
  D('musicvine', 'Music Vine', 'verwertung', 'https://www.musicvine.com', { model: 'je Lizenz', admission: 'Bewerbung', automation: 'MANUELL', takes: 'Filmmusik-Lizenzen', needs: ['Konto'] }),
  D('musicbed', 'Musicbed', 'verwertung', 'https://www.musicbed.com', { model: 'je Lizenz', admission: 'Bewerbung (kuratiert)', automation: 'MANUELL', takes: 'hochwertige Werbelizenzen', needs: ['Konto'] }),
  D('artlist', 'Artlist', 'verwertung', 'https://artlist.io', { model: 'Abo für Nutzer', admission: 'Bewerbung', automation: 'MANUELL', takes: 'Abo-Lizenzen', needs: ['Konto'] }),
  D('epidemic', 'Epidemic Sound', 'verwertung', 'https://www.epidemicsound.com', { model: 'Abo für Nutzer', admission: 'Bewerbung', automation: 'MANUELL', takes: 'Abo-Lizenzen', needs: ['Konto'] }),
  D('pond5', 'Pond5', 'verwertung', 'https://www.pond5.com', { model: 'je Lizenz', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Medien-Marktplatz', needs: ['Konto'] }),
  D('taxi', 'TAXI', 'verwertung', 'https://www.taxi.com', { model: 'Jahresbeitrag', admission: 'Konto', automation: 'MANUELL', takes: 'Ausschreibungen für Film/TV', needs: ['Konto'] }),

  // ---------------------------------------------------------------- Video
  D('youtube', 'YouTube Studio', 'video', 'https://studio.youtube.com', { model: 'Werbung, Abos', admission: 'Google-Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'größte Videoreichweite, Shorts', needs: ['Konto', 'ggf. API-Zugang'] }),
  D('vimeo', 'Vimeo', 'video', 'https://vimeo.com', { model: 'Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'hochwertige Wiedergabe, Kunden', needs: ['Konto'] }),
  D('dailymotion', 'Dailymotion Partner', 'video', 'https://www.dailymotion.com/partner', { model: 'Werbung', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Video-Plattform', needs: ['Konto'] }),
  D('tiktok', 'TikTok Creator', 'video', 'https://www.tiktok.com/creator', { model: 'Creator-Fonds', admission: 'Konto', automation: 'MANUELL', takes: 'Kurzvideos', needs: ['Konto'] }),
  D('instagram', 'Instagram', 'video', 'https://www.instagram.com', { model: 'Werbung/Abos', admission: 'Konto', automation: 'MANUELL', takes: 'Reels, Stories', needs: ['Konto'] }),
  D('facebook', 'Facebook Creators', 'video', 'https://www.facebook.com/creators', { model: 'Werbung', admission: 'Konto', automation: 'MANUELL', takes: 'Videos, Live', needs: ['Konto'] }),
  D('twitch', 'Twitch', 'video', 'https://dashboard.twitch.tv', { model: 'Abos, Spenden', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Livestream', needs: ['Konto'] }),
  D('rumble', 'Rumble', 'video', 'https://rumble.com', { model: 'Werbung', admission: 'Konto', automation: 'MANUELL', takes: 'Video-Plattform', needs: ['Konto'] }),
  D('odysee', 'Odysee', 'video', 'https://odysee.com', { model: 'Krypto-Anreize', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'dezentrale Plattform', needs: ['Konto'] }),
  D('peertube', 'PeerTube', 'video', 'https://joinpeertube.org', { model: 'eigener Server', admission: 'selbst hosten', automation: 'RSS-ABO', takes: 'eigene Videoplattform ohne Fremdkonzern', needs: ['eigener Server'], note: 'Der konsequente Weg für „eigene Plattform": Feed und Abspieler kommen mit.' }),
  D('archive-org', 'Internet Archive', 'video', 'https://archive.org', { model: 'kostenlos', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'dauerhafte Ablage', needs: ['Konto'], note: 'Als Langzeitablage: unser Speicher legt Originale, hier liegt die Kopie für die Ewigkeit.' }),

  // ---------------------------------------------------------------- Buch und Handel
  D('kdp', 'Amazon KDP', 'buch', 'https://kdp.amazon.com', { model: '70 % eBook / 60 % Taschenbuch', admission: 'Konto, Steuerdaten', automation: 'MANUELL', takes: 'Kindle + Print on Demand weltweit', needs: ['Konto', 'ISBN oder unsere EAN-13'] }),
  D('ingramspark', 'IngramSpark', 'buch', 'https://www.ingramspark.com', { model: 'Beteiligung', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Buchhandel, Bibliotheken', needs: ['Konto', 'ISBN'] }),
  D('lulu', 'Lulu', 'buch', 'https://www.lulu.com', { model: 'je Buch', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Druck on Demand', needs: ['Konto'] }),
  D('bod', 'BoD (Books on Demand)', 'buch', 'https://www.bod.de', { model: 'je Buch', admission: 'Konto', automation: 'MANUELL', takes: 'Druck + Handel Deutschland', needs: ['Konto', 'ISBN'], region: 'DE' }),
  D('vlb', 'VLB (Buchhandel)', 'buch', 'https://www.vlb.de', { model: '—', admission: 'über Verlag', automation: 'MANUELL', takes: 'Verzeichnis lieferbarer Bücher', needs: ['Verlag'], region: 'DE' }),
  D('spreadshop', 'Spreadshop', 'buch', 'https://www.spreadshop.com', { model: 'Beteiligung', admission: 'Konto', automation: 'MANUELL', takes: 'Merch ohne Lager', needs: ['Konto', 'Motive'] }),
  D('printful', 'Printful', 'buch', 'https://www.printful.com', { model: 'je Stück', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Merch-Druck + Versand', needs: ['Konto'] }),
  D('amazon-merch', 'Amazon Merch on Demand', 'buch', 'https://merch.amazon.com', { model: 'Beteiligung', admission: 'Bewerbung/Warteliste', automation: 'MANUELL', takes: 'T-Shirts über Amazon', needs: ['Konto'] }),
  D('shopify', 'Shopify', 'buch', 'https://www.shopify.com', { model: 'Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'eigener Laden', needs: ['Konto'] }),
  D('woocommerce', 'WooCommerce', 'buch', 'https://woocommerce.com', { model: 'frei (Open Source)', admission: 'selbst hosten', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'eigener Laden auf WordPress', needs: ['WordPress'] }),
  D('etsy', 'Etsy', 'buch', 'https://www.etsy.com/sell', { model: 'Gebühren je Verkauf', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Handgemachtes', needs: ['Konto'] }),
  D('redbubble', 'Redbubble', 'buch', 'https://www.redbubble.com', { model: 'Beteiligung', admission: 'Konto', automation: 'MANUELL', takes: 'Print on Demand', needs: ['Konto'] }),

  // ---------------------------------------------------------------- Web und Suche
  D('search-console', 'Google Search Console', 'web', 'https://search.google.com/search-console', { model: 'kostenlos', admission: 'Google-Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Sichtbarkeit, Sitemaps, Fehler', needs: ['Konto', 'eigene Domain'] }),
  D('bing-webmaster', 'Bing Webmaster Tools', 'web', 'https://www.bing.com/webmasters', { model: 'kostenlos', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Sitemaps, Indexierung', needs: ['Konto'] }),
  D('cloudflare', 'Cloudflare', 'web', 'https://dash.cloudflare.com', { model: 'kostenlos / Abo', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'DNS, Schutz, TLS', needs: ['Konto', 'Domain'] }),
  D('letsencrypt', 'Let’s Encrypt', 'web', 'https://letsencrypt.org', { model: 'kostenlos', admission: 'offen', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'TLS-Zertifikate', needs: ['Domain', 'Server'], note: 'Der Grund, warum „TLS fehlt" kein Dauerzustand bleiben muss.' }),
  D('matomo', 'Matomo', 'web', 'https://matomo.org', { model: 'frei (selbst hosten)', admission: 'offen', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'Auswertung ohne Datenabfluss', needs: ['eigener Server'], note: 'Passt zu unseren Messwerten: keine Cookies, keine Weitergabe.' }),
  D('plausible', 'Plausible', 'web', 'https://plausible.io', { model: 'Abo oder selbst hosten', admission: 'Konto', automation: 'SCHNITTSTELLE (Zugang nötig)', takes: 'schlanke Auswertung', needs: ['Konto'] }),
];

const KINDS = ['podcast', 'hoerbuch', 'musik', 'verwertung', 'video', 'buch', 'web'];

function defaults() { return { sent: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['sent', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function list(input) {
  const p = input || {};
  const kind = p.kind ? String(p.kind).toLowerCase() : null;
  if (kind && !KINDS.includes(kind)) return { ok: false, error: `Art unbekannt. Erlaubt: ${KINDS.join(', ')}` };
  const rows = kind ? DISTRIBUTORS.filter((x) => x.kind === kind) : DISTRIBUTORS;
  const byKind = KINDS.map((k) => ({ kind: k, count: DISTRIBUTORS.filter((x) => x.kind === k).length }));
  return {
    ok: true, total: DISTRIBUTORS.length, shown: rows.length, by_kind: byKind, rows: p.full === true ? rows : rows.slice(0, 30),
    honesty: 'Adressen sind die originalen Seiten der Anbieter. Keines dieser Häuser ist von hier aus verbunden — ohne Konto und Schlüssel bleibt es beim Plan.',
  };
}

// Alle originalen Adressen auf einen Blick — zum Nachsehen, nicht zum Anklicken im Namen des Nutzers.
function links(input) {
  const p = input || {};
  const kind = p.kind ? String(p.kind).toLowerCase() : null;
  const rows = (kind ? DISTRIBUTORS.filter((x) => x.kind === kind) : DISTRIBUTORS).map((x) => ({ name: x.name, kind: x.kind, link: x.link, automation: x.automation }));
  return { ok: true, count: rows.length, links: rows, note: 'Original-Adressen der Anbieter. AURA öffnet nichts von selbst — der Mensch klickt.' };
}

// Der gerade Weg: ein Feed, viele Verzeichnisse — oder Master, Kennungen, Verteiler, Läden.
function straightLine(kind) {
  const k = String(kind || 'podcast').toLowerCase();
  if (k === 'podcast' || k === 'audiobibel' || k === 'hoerbuch-feed') {
    const rss = DISTRIBUTORS.filter((x) => x.kind === 'podcast' && x.automation === 'RSS-ABO');
    return {
      ok: true, kind: 'podcast', steps: [
        '1. Folge bauen: Aufnahme oder Sprachplan, Kapitelmarken, Transkript, Pegel und Lautheit prüfen.',
        '2. Einen RSS-Feed erzeugen (unsere Seite liefert ihn fertig aus: Titel, Beschreibung, Dauer, Kapitel, Bild).',
        '3. Diesen einen Feed bei den Verzeichnissen einreichen — danach holt sich jedes neue Folge selbst.',
        '4. Prüfen: Feed über den offenen Weg (Podcast Index, AntennaPod) lesen lassen. Erst dann gilt er als gültig.',
        '5. Messen: Abrufe im eigenen Protokoll (ohne Cookies), nicht beim Fremdanbieter.',
      ],
      directories: rss.map((x) => ({ name: x.name, link: x.link })),
      manual: DISTRIBUTORS.filter((x) => x.kind === 'podcast' && x.automation !== 'RSS-ABO').map((x) => ({ name: x.name, link: x.link, why: 'braucht Konto/Video, kein reiner Feed' })),
      straight: `Ein Feed genügt für ${rss.length} Verzeichnisse. Kein Upload je Haus, kein zweiter Arbeitsgang.`,
      human_gate: 'Das Einreichen bei einem Verzeichnis ist eine Außenhandlung — die macht ein Mensch einmal, danach läuft es über den Feed.',
    };
  }
  if (k === 'musik') {
    return {
      ok: true, kind: 'musik', steps: [
        '1. Fertiger Master (unsere Prüfung nennt Lautheit, Länge, Dateigröße, Prüfsumme).',
        '2. Kennungen: ISRC je Aufnahme, UPC/EAN-13 für die Veröffentlichung — wir rechnen die Prüfziffer.',
        '3. Cover und Text: Titel, Mitwirkende, Sprache, Erscheinungsdatum.',
        '4. Einen Verteiler wählen (Liste unten) und den Titel einreichen. Ab hier ist der Verteiler die Schnittstelle zu den Läden.',
        '5. Läden pflegen (Spotify for Artists usw.) und Abrechnung im eigenen Protokoll gegenprüfen.',
      ],
      distributors: DISTRIBUTORS.filter((x) => x.kind === 'musik').map((x) => ({ name: x.name, link: x.link, model: x.model, automation: x.automation })),
      straight: 'Ein Master + zwei Kennungen + ein Verteiler = alle Läden. Der zweite Weg (Bandcamp, Direktverkauf) bleibt daneben offen.',
      human_gate: 'Einreichen und Vertrag unterschreiben: immer ein Mensch.',
    };
  }
  if (k === 'hoerbuch') {
    return {
      ok: true, kind: 'hoerbuch', steps: [
        '1. Text zerlegen: Teile, Kapitel, Abschnitte (unsere Hörbuch-Funktion zählt Zeichen, Wörter und Lesezeit).',
        '2. Aufnahme oder Sprachplan je Kapitel, Lautheit auf Hörbuch-Norm, Rauschen geprüft.',
        '3. Kennungen: UPC/EAN-13 je Titel (Prüfziffer rechnen wir), ISBN falls Print dabei ist.',
        '4. Verteiler oder direktes Haus wählen (ACX/Audible, Apple Books, Google Play, Kobo, Findaway, Bookwire).',
        '5. Bibliotheken und Abo-Dienste kommen über die Verteiler mit — nicht einzeln anmelden.',
      ],
      distributors: DISTRIBUTORS.filter((x) => x.kind === 'hoerbuch').map((x) => ({ name: x.name, link: x.link, model: x.model, automation: x.automation })),
      straight: 'Ein Master je Kapitel + Kapitelmarken + UPC = alle Hörbuch-Läden über einen Verteiler.',
      human_gate: 'Tonabnahme und Einreichung: ein Mensch hört und gibt frei.',
    };
  }
  if (k === 'video') {
    return {
      ok: true, kind: 'video', steps: [
        '1. Drehbuch und Storyboard (unsere Kamera-Funktion liefert Einstellungen, Bewegungen, Brennweiten, Licht).',
        '2. Schnitt, Effekte, Ton: Filterketten werden als Befehl ausgegeben und geprüft.',
        '3. Kennzeichnung (Wasserzeichen) und Beschreibung, Kapitelmarken für lange Videos.',
        '4. Hochladen je Plattform — bei YouTube und Vimeo gibt es Schnittstellen, soziale Netze meist nicht.',
        '5. Auswertung im eigenen Protokoll, nicht in der Plattform-Blase.',
      ],
      distributors: DISTRIBUTORS.filter((x) => x.kind === 'video').map((x) => ({ name: x.name, link: x.link, automation: x.automation })),
      straight: 'Ein fertiger Schnitt + je Plattform Länge und Format = vier Netze mit einem Master. PeerTube und Archive tragen den Rest.',
      human_gate: 'Veröffentlichen: ein Mensch drückt den Knopf.',
    };
  }
  return { ok: false, error: `Für „${k}" gibt es keinen festen Weg. Erlaubt: podcast, musik, hoerbuch, video.` };
}

// Kennungen: UPC/EAN-13 mit richtiger Prüfziffer, ISRC-Aufbau für eigene Aufnahmen.
function ean13(prefix, number) {
  const p = String(prefix || '426').replace(/\D/g, '').padStart(3, '0').slice(0, 3);
  const n = String(number || '').replace(/\D/g, '').padStart(9, '0').slice(0, 9);
  const body = p + n;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return { ok: true, ean13: body + check, check_digit: check, prefix: p, body, note: 'Gewichtet 1-3, Prüfziffer so, dass die Summe durch 10 teilbar ist. 426 ist der deutsche Bereich für eigene Vergaben — echte Präfixe vergibt die GS1.' };
}

function isrc(input) {
  const p = input || {};
  const country = String(p.country || 'DE').toUpperCase().slice(0, 2);
  const registrant = String(p.registrant || 'CSX').toUpperCase().replace(/[^A-Z0-9]/g, '').padStart(3, '0').slice(0, 3);
  const year = String(p.year || '26').replace(/\D/g, '').padStart(2, '0').slice(-2);
  const design = String(Number(p.number) || 1).padStart(5, '0');
  return {
    ok: true, isrc: `${country}-${registrant}-${year}-${design}`,
    parts: { country, registrant, year, designation: design },
    note: 'Aufbau nach ISO 3901. Der Registrant-Code ist nicht frei wählbar — den vergibt die nationale Stelle (in Deutschland die GEMA bzw. das DSRA). Hier steht der Platzhalter CSX.',
    honest: 'Diese Kennung ist nicht telekommunikativ: sie zeigt den Aufbau, sie ersetzt keine Registrierung.',
  };
}

function status() {
  const d = load();
  const byKind = KINDS.map((k) => ({ kind: k, count: DISTRIBUTORS.filter((x) => x.kind === k).length }));
  const automatik = DISTRIBUTORS.reduce((a, x) => { a[x.automation] = (a[x.automation] || 0) + 1; return a; }, {});
  return {
    area: 'DIST', module: 'distributors', state: 'live', file: FILE,
    total: DISTRIBUTORS.length, by_kind: byKind, by_automation: automatik,
    prepared: d.sent.length,
    rules: ['Zu jedem Haus steht die originale Adresse — zum Nachsehen, nicht zum Anklicken durch AURA.', 'Keines dieser Häuser ist verbunden: ohne Konto und Schlüssel bleibt es beim Plan.', 'Automatik heißt hier: offener Feed (RSS) oder Schnittstelle mit Zugang — nichts wird heimlich übermittelt.', 'Einreichen, Verträge, Tonabnahme: immer ein Mensch.'],
    straight_lines: ['Podcast: ein RSS-Feed → alle Verzeichnisse', 'Musik: Master + ISRC + UPC → ein Verteiler → alle Läden', 'Hörbuch: Kapitel + UPC → ein Verteiler (oder ACX/Apple/Google direkt)', 'Video: ein Schnitt → vier Netze, PeerTube und Archive als eigene Wege'],
  };
}

function statusOf(id) {
  const x = DISTRIBUTORS.find((y) => y.id === String(id || '').toLowerCase());
  return x ? { ok: true, distributor: x } : { ok: false, error: 'Haus unbekannt' };
}

module.exports = {
  meta: { area: 'DIST', id: 'distributors', name: 'Verteiler (Original-Adressen, Wege und Kennungen)', state: 'live' },
  actions: {
    status: () => status(),
    list: (p) => list(p || {}),
    links: (p) => links(p || {}),
    get: (p) => statusOf((p || {}).id),
    straight: (p) => straightLine((p || {}).kind),
    straight_lines: () => ({ ok: true, kinds: ['podcast', 'musik', 'hoerbuch', 'video'].map((k) => ({ kind: k, straight: straightLine(k).straight })) }),
    ean: (p) => ean13((p || {}).prefix, (p || {}).number),
    isrc: (p) => isrc(p || {}),
    kinds: () => ({ ok: true, kinds: KINDS, counts: KINDS.map((k) => ({ kind: k, count: DISTRIBUTORS.filter((x) => x.kind === k).length })) }),
  },
  DISTRIBUTORS, KINDS, list, links, straightLine, ean13, isrc, status,
};
