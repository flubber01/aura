'use strict';
document.documentElement.classList.add('js');
document.getElementById('year').textContent = new Date().getFullYear();
const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
}), { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
const menu = document.querySelector('.menu-toggle');
const navigation = document.getElementById('navigation');
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  navigation.classList.toggle('open', open);
});
navigation.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navigation.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menü öffnen');
}));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { navigation.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menü öffnen'); } });
const projectDialog = document.getElementById('project-dialog');
document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.project) document.getElementById('service').value = button.dataset.project;
  document.getElementById('form-status').textContent = '';
  projectDialog.showModal();
}));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) { const rect = dialog.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close(); } });
});
document.getElementById('project-form').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const text = `CREEDSTREETSTUDIOS47 — PROJEKTBRIEFING\n${'='.repeat(42)}\n\nErstellt: ${new Date().toLocaleDateString('de-DE')}\nArtist / Name: ${data.get('artist')}\nE-Mail: ${data.get('email')}\nBereich: ${data.get('service')}\n\nDEINE IDEE\n${data.get('idea')}\n\nDieses Briefing wurde lokal erstellt und nicht versendet.\nEine verifizierte Kontaktadresse wird vor dem Launch ergänzt.\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'CreedStreet47-Projektbriefing.txt'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  document.getElementById('form-status').textContent = 'Dein Briefing wurde zum Download vorbereitet. Es wurde keine Anfrage versendet. Bewahre die Datei für das erste Gespräch auf.';
});
const lightbox = document.getElementById('lightbox-dialog');
document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
  const image = document.getElementById('lightbox-image');
  image.src = button.dataset.image; image.alt = button.dataset.caption;
  document.getElementById('lightbox-caption').textContent = button.dataset.caption;
  lightbox.showModal();
}));
