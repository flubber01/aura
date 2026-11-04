'use strict';
(() => {
  const platforms = {
    instagram: { name: 'Instagram', icon: '◎', hosts: ['instagram.com', 'www.instagram.com'], path: /^\/[a-zA-Z0-9._]+\/?$/, example: 'https://www.instagram.com/deinprofil/' },
    tiktok: { name: 'TikTok', icon: '♪', hosts: ['tiktok.com', 'www.tiktok.com'], path: /^\/@[a-zA-Z0-9._]+\/?$/, example: 'https://www.tiktok.com/@deinprofil' },
    youtube: { name: 'YouTube', icon: '▶', hosts: ['youtube.com', 'www.youtube.com'], path: /^\/(?:@[a-zA-Z0-9._-]+|channel\/[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_-]+)\/?$/, example: 'https://www.youtube.com/@deinprofil' },
    spotify: { name: 'Spotify', icon: '◉', hosts: ['open.spotify.com'], path: /^\/artist\/[a-zA-Z0-9]+\/?$/, example: 'https://open.spotify.com/artist/DEINEARTISTID' },
    whatsapp: { name: 'WhatsApp', icon: '↗', hosts: ['wa.me'], path: /^\/[1-9]\d{6,14}\/?$/, example: 'https://wa.me/49DEINENUMMER' },
    suno: { name: 'Suno', icon: 'S', hosts: ['suno.com', 'www.suno.com'], path: /^\/@[a-zA-Z0-9._-]+\/?$/, example: 'https://suno.com/@creedstreetstudios47' }
  };
  const key = 'cs47-social-v1';
  const config = window.CS47_PUBLIC || {};
  let local = {};
  try { local = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { local = {}; }
  function validate(platform, value) {
    try {
      const url = new URL(value), spec = platforms[platform];
      if (!spec || url.protocol !== 'https:' || !spec.hosts.includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !spec.path.test(url.pathname)) return null;
      if (platform === 'instagram' && ['accounts', 'direct', 'explore', 'p', 'reel', 'reels', 'oauth'].includes(url.pathname.split('/')[1].toLowerCase())) return null;
      return url.href;
    } catch { return null; }
  }
  function publicUrl(platform) { return validate(platform, local[platform]) || validate(platform, config[platform]); }
  const toast = document.createElement('div'); toast.className = 'site-toast'; toast.setAttribute('role', 'status'); document.body.append(toast);
  let toastTimer;
  function notify(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 5000); }
  const dialog = document.createElement('dialog'); dialog.id = 'social-dialog'; dialog.setAttribute('aria-labelledby', 'social-title');
  dialog.innerHTML = '<button class="dialog-close" aria-label="Social-Dialog schließen">×</button><div class="eyebrow muted">SOCIAL FAST CONNECT / VORSCHAU</div><h2 id="social-title">Dein Profil.<br><span>Ein direkter Weg.</span></h2><p class="dialog-intro">Nur öffentliche Profil-URLs. Keine Passwörter, kein Login, kein automatischer Versand. Eigene Links bleiben auf diesem Gerät; veröffentlichte Unternehmensprofile werden separat konfiguriert.</p><form id="social-form"><label for="social-platform">Plattform</label><select id="social-platform"></select><label for="social-url">Öffentliche Profil-URL (HTTPS)</label><input id="social-url" type="url" required maxlength="300" autocomplete="off"><button class="button primary" type="submit">Link lokal speichern ↗</button><p id="social-feedback" role="status"></p></form><button class="reset-social" type="button">Lokale Links löschen</button>';
  document.body.append(dialog);
  const select = dialog.querySelector('select'), input = dialog.querySelector('input');
  Object.entries(platforms).forEach(([id, spec]) => { const option = document.createElement('option'); option.value = id; option.textContent = spec.name; select.append(option); });
  function updateInput() { input.value = publicUrl(select.value) || ''; input.placeholder = platforms[select.value].example; input.setCustomValidity(''); dialog.querySelector('#social-feedback').textContent = ''; }
  select.addEventListener('change', updateInput); input.addEventListener('input', () => input.setCustomValidity(''));
  function openSocial(platform = 'instagram') { select.value = platform; updateInput(); dialog.showModal(); }
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  function renderSocial() {
    document.querySelectorAll('.social-inline').forEach(container => {
      container.replaceChildren();
      Object.entries(platforms).forEach(([id, spec]) => {
        const url = publicUrl(id), el = document.createElement(url ? 'a' : 'button');
        el.className = 'social-button' + (url ? ' connected' : '');
        const icon = document.createElement('span'); icon.className = 'social-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = spec.icon;
        el.append(icon, document.createTextNode(spec.name));
        if (url) { el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; el.setAttribute('aria-label', `${spec.name} öffnen (neuer Tab)`); }
        else { el.type = 'button'; el.title = 'Noch kein verifiziertes Profil hinterlegt'; el.addEventListener('click', () => openSocial(id)); el.setAttribute('aria-label', `${spec.name}: Profil verbinden`); }
        container.append(el);
      });
      const edit = document.createElement('button'); edit.className = 'social-edit'; edit.textContent = 'Profile verwalten'; edit.addEventListener('click', () => openSocial()); container.append(edit);
    });
  }
  renderSocial();
  dialog.querySelector('form').addEventListener('submit', e => {
    e.preventDefault(); const url = validate(select.value, input.value.trim());
    if (!url) { input.setCustomValidity('Bitte eine passende öffentliche HTTPS-Profil-URL ohne Parameter eingeben. Beispiel: ' + platforms[select.value].example); input.reportValidity(); return; }
    try {
      const nextLocal = { ...local, [select.value]: url }; localStorage.setItem(key, JSON.stringify(nextLocal)); local = nextLocal;
      renderSocial(); dialog.querySelector('#social-feedback').textContent = 'Auf diesem Gerät gespeichert. Schließe den Dialog und öffne das Profil über den Schnellzugriff. Nicht für andere Besucher veröffentlicht.';
    } catch { dialog.querySelector('#social-feedback').textContent = 'Dein Browser erlaubt hier keine lokale Speicherung. Es wurde kein Link gespeichert.'; }
  });
  function reset() {
    try { localStorage.removeItem(key); local = {}; renderSocial(); updateInput(); notify('Lokale Social-Links gelöscht. Veröffentlichte Profile bleiben unverändert.'); document.querySelectorAll('.local-reset-status').forEach(el => { el.textContent = 'Lokale Social-Links wurden gelöscht.'; }); }
    catch { notify('Lokaler Speicher ist nicht verfügbar. Bitte nutze die Einstellungen deines Browsers.'); }
  }
  dialog.querySelector('.reset-social').addEventListener('click', reset);
  document.querySelectorAll('[data-reset-social]').forEach(button => button.addEventListener('click', reset));
  document.querySelectorAll('[data-share]').forEach(button => button.addEventListener('click', async () => {
    const url = location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); notify('Seitenlink kopiert. Bereit zum Teilen.'); }
      else notify('Kopiere die Adresse aus der Browser-Adresszeile, um diese Seite zu teilen.');
    } catch (error) { if (error.name !== 'AbortError') notify('Teilen nicht verfügbar. Du kannst die Adresse aus der Browser-Adresszeile kopieren.'); }
  }));
  // Local rule-based FAQ guide; no network calls or persisted conversation.
  const toggle = document.createElement('button'); toggle.className = 'chat-toggle'; toggle.setAttribute('aria-controls', 'studio-chat'); toggle.setAttribute('aria-expanded', 'false'); toggle.innerHTML = '<span aria-hidden="true">✳</span><span>Studio-Guide<small>FRAGEN? LET’S TALK.</small></span>'; document.body.append(toggle);
  const panel = document.createElement('section'); panel.id = 'studio-chat'; panel.className = 'chat-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Studio-Guide FAQ-Chat');
  panel.innerHTML = '<div class="chat-heading"><div><span class="status-dot"></span><strong>CreedStreet Guide</strong><small>Lokaler FAQ-Bot · keine Live-Beratung</small></div><button class="chat-close" aria-label="Chat schließen">×</button></div><div class="chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div><div class="chat-suggestions"><button data-question="Studio & Recording">Studio</button><button data-question="Musikvertrieb und Labels">Vertrieb</button><button data-question="Suno Musik hören">Suno-Musik</button><button data-question="Was kostet das?">Preise</button></div><form class="chat-form"><label for="chat-input" class="sr-only">Deine Frage an den FAQ-Guide</label><input id="chat-input" maxlength="400" required placeholder="Was möchtest du wissen?" autocomplete="off"><button type="submit" aria-label="Frage senden">↗</button></form><p class="chat-privacy">Bleibt im Browser · keine KI-Cloud · keine vertraulichen Daten</p>';
  document.body.append(panel);
  const log = panel.querySelector('.chat-messages'), chatInput = panel.querySelector('input');
  function message(text, user = false, link = null) {
    const entry = document.createElement('div'); entry.className = 'chat-message' + (user ? ' user' : '');
    const label = document.createElement('small'); label.textContent = user ? 'DU' : 'STUDIO-GUIDE';
    const body = document.createElement('p'); body.textContent = text; entry.append(label, body);
    if (link) { const a = document.createElement('a'); a.href = link[0]; a.textContent = link[1] + ' ↗'; entry.append(a); }
    log.append(entry); while (log.children.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
  }
  message('Hey! Ich helfe dir mit Studio, Release-Planung, Rechten und dieser Website. Ich bin ein lokaler FAQ-Guide – keine generative KI. Womit starten wir?');
  function openChat(open) { panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); if (open) chatInput.focus(); else toggle.focus(); }
  toggle.addEventListener('click', () => openChat(panel.hidden)); panel.querySelector('.chat-close').addEventListener('click', () => openChat(false));
  document.querySelectorAll('[data-open-chat]').forEach(button => button.addEventListener('click', () => openChat(true)));
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') openChat(false); });
  const answers = [
    [/suno/, 'Unsere Musik findest du auf Suno unter @creedstreetstudios47. Im Sound-Bereich und im Social-Schnellzugriff führt der Link direkt zum Profil. Als Hintergrundmusik nutzt die Website die bereitgestellte Datei Schwarzes Eisen. Automatischer Ton wird versucht; falls der Browser ihn blockiert, nutze den kleinen Sound-an-Schalter.', ['studio.html#sound', 'Zum Suno-Profil']],
    [/preis|kost|budget|buch|termin|offnung|adresse|telefon/, 'Es gibt noch keine bestätigte Preisliste, Buchung oder Betriebsadresse. Umfang, Budget und Zeitplan werden vor einer Zusammenarbeit abgestimmt. Das Briefing ist eine lokale Vorbereitung, kein Versand.', ['kontakt.html', 'Projekt vorbereiten']],
    [/recht|lizenz|sample|masterrecht|vertrag|royalt/, 'Masterrechte, Komposition, Beat- und Sample-Lizenzen, Laufzeit und Abrechnung gehören vor einem Release geklärt. Die genaue Regelung steht im individuellen Vertrag. Ich kann keine Rechtsberatung leisten.', ['vertrieb.html', 'Release-Checkliste']],
    [/adsense|werbung|anzeige/, 'Die AdSense-Fläche ist vorbereitet, aber inaktiv. Ohne bestätigte Publisher-/Slot-IDs, Kontofreigabe und geeignete Einwilligungslösung werden keine Anzeigen geladen.', ['werbung.html', 'Zum Werbebereich']],
    [/social|instagram|tiktok|whatsapp|youtube|verbinden/, 'Über Social Fast Connect kannst du eine öffentliche Profil-URL öffnen oder für deine Vorschau lokal speichern. Kein Passwort, keine Anmeldung, kein automatisches Posten. Site-weite Profile müssen vom Betreiber bestätigt werden.', ['kontakt.html', 'Social-Schnellzugriff']],
    [/beat|drill|audio|sound|musik horen/, 'Für unsere Musik öffne das Suno-Profil @creedstreetstudios47 über den Sound-Bereich. Der alte selbst erzeugte Beat-Player bleibt entfernt. Stattdessen läuft Schwarzes Eisen als dezente Hintergrundmusik. Mit Sound an/aus kannst du sie jederzeit steuern; Browser können den automatischen Start blockieren.', ['studio.html#sound', 'Musik auf Suno entdecken']],
    [/vertrieb|label|release|spotify|distrokid|tunecore|believe|sony|warner|universal/, 'Wir zeigen ein unabhängiges Label- und Release-Planungskonzept aus Duisburg. Die genannten großen Labels und Distributoren sind Branchenbeispiele, keine Partner. Ein direkter Plattform-Upload ist hier noch nicht angebunden.', ['vertrieb.html', 'Label & Vertrieb entdecken']],
    [/studio|record|mix|master|vocal|aufnahme|produktion/, 'Im Studio-Konzept stehen Recording, Vocal Production, Mixing, Mastering und Beat-Entwicklung im Fokus – besonders für Rap, Drill und urbane Musik. Technik, Verfügbarkeit und Leistungen werden vor einer Session bestätigt.', ['studio.html', 'Studio entdecken']],
    [/daten|privat|speicher|ki|chatbot/, 'Deine Chatfragen bleiben im Arbeitsspeicher des Browsers. Kein KI-Dienst, kein Versand, keine dauerhafte Chat-Speicherung. Nur selbst bestätigte öffentliche Social-URLs können lokal gespeichert werden.', ['datenschutz.html', 'Datenschutzhinweise']],
    [/kontakt|mail|anfrage|projekt|hallo|hey|hi\b/, 'Hey! Über das Projektbriefing kannst du deinen Plan als TXT-Datei vorbereiten. Noch wird nichts versendet. Verifizierte Kontaktdaten werden vor dem öffentlichen Launch ergänzt.', ['kontakt.html', 'Zum Kontaktbereich']],
    [/duisburg|ruhr|wer seid|uber euch/, 'CreedStreetStudios47 ist ein Studio- und Independent-Label-Konzept aus Duisburg, mit regionalem Fokus auf das Ruhrgebiet. Artist first, klar in den Absprachen und offen für digitale Möglichkeiten.', ['ueber-uns.html', 'Unsere Vision']]
  ];
  function answer(question) {
    const clean = question.trim().slice(0, 400); if (!clean) return;
    message(clean, true);
    const normalized = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const match = answers.find(([pattern]) => pattern.test(normalized));
    if (match) message(match[1], false, match[2]);
    else message('Das kann mein lokaler FAQ-Katalog noch nicht sicher beantworten. Frag mich nach Studio, Vertrieb, Rechten, Preisen, Social Media oder unserem Suno-Profil. Für individuelle Fragen bereite ein Projektbriefing vor.', false, ['kontakt.html', 'Zum Projektbriefing']);
  }
  panel.querySelector('form').addEventListener('submit', e => { e.preventDefault(); answer(chatInput.value); chatInput.value = ''; chatInput.focus(); });
  panel.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => answer(button.dataset.question)));
})();
