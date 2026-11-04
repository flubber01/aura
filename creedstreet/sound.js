'use strict';
// The owner's supplied MP3, same-origin only. No Suno iframe or old beat player.
(() => {
  const audio = document.getElementById('background-sound');
  const button = document.getElementById('sound-toggle');
  const label = document.getElementById('sound-label');
  const notice = document.getElementById('sound-notice');
  if (!audio || !button) return;
  const key = 'cs47-sound-v1';
  let choice = null, starting = false, attempt = 0, loadedPosition = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && typeof saved.enabled === 'boolean') choice = { enabled: saved.enabled, time: Number.isFinite(saved.time) ? Math.max(0, saved.time) : 0 };
  } catch { /* Session storage is optional. */ }
  audio.volume = 0.32;
  function save() {
    // Store only after an explicit sound choice; no new session entry on autoplay.
    if (!choice) return;
    try { sessionStorage.setItem(key, JSON.stringify({ enabled: choice.enabled, time: loadedPosition ? (audio.currentTime || 0) : (choice.time || 0) })); } catch {}
  }
  function display(playing) {
    button.classList.toggle('is-on', playing);
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', playing ? 'Schwarzes Eisen: Hintergrundmusik ausschalten' : 'Schwarzes Eisen: Hintergrundmusik einschalten');
    label.textContent = playing ? 'Sound aus' : (starting ? 'Lädt …' : 'Sound an');
  }
  function restorePosition() {
    if (loadedPosition || !Number.isFinite(audio.duration)) return;
    loadedPosition = true;
    if (choice?.time && choice.time < audio.duration) audio.currentTime = choice.time;
  }
  async function start(manual = false) {
    const version = ++attempt;
    starting = true;
    if (manual) { choice = { enabled: true, time: loadedPosition ? (audio.currentTime || 0) : (choice?.time || 0) }; save(); }
    display(false);
    try {
      audio.preload = 'auto';
      await audio.play();
      if (version !== attempt) return;
      notice.textContent = 'Schwarzes Eisen läuft als Hintergrundmusik. Über Sound aus kannst du sie ausschalten.';
    } catch (error) {
      if (version !== attempt) return;
      notice.textContent = error.name === 'NotAllowedError'
        ? 'Der Browser blockiert automatischen Ton. Klicke auf Sound an, um Schwarzes Eisen zu starten.'
        : 'Die Musik konnte nicht gestartet werden. Versuche es über Sound an erneut.';
    } finally {
      if (version === attempt) { starting = false; display(!audio.paused); }
    }
  }
  function stop(manual = false) {
    attempt++; starting = false; audio.pause();
    if (manual) { choice = { enabled: false, time: audio.currentTime || 0 }; save(); }
    display(false);
    notice.textContent = 'Hintergrundmusik ausgeschaltet.';
  }
  button.addEventListener('click', () => { if (starting || !audio.paused) stop(true); else start(true); });
  audio.addEventListener('loadedmetadata', restorePosition);
  audio.addEventListener('playing', () => { if (!starting || !audio.paused) display(true); });
  audio.addEventListener('pause', () => display(false));
  audio.addEventListener('error', () => { starting = false; display(false); notice.textContent = 'Hintergrundmusik derzeit nicht verfügbar.'; });
  audio.addEventListener('timeupdate', save);
  window.addEventListener('pagehide', () => { save(); audio.pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  // Avoid two sound sources when the visitor explicitly opens Suno.
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    try { if (['suno.com', 'www.suno.com'].includes(new URL(anchor.href).hostname)) stop(true); } catch {}
  });
  display(false);
  if (choice?.enabled !== false) start();
})();
