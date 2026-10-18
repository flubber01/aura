'use strict';
// AURA · Sprachen für das Betriebssystem.
//
// Eine Datei, viele Sprachen: jeder Text hat einen Schlüssel, jede Sprache ihren Satz. Fehlt ein Satz,
// fällt die Anzeige auf die Grundsprache zurück — es wird nie ein Schlüssel angezeigt und nie etwas
// erfunden. Rechts-nach-links-Sprachen (Arabisch) sind gekennzeichnet, damit die Seitenrichtung
// mitwandert.
//
// Alle Sätze sind hier selbst geschrieben; keine Fremdtexte, keine Übersetzungsdienste.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_I18N_FILE || path.join(__dirname, '..', 'data', 'i18n.json');

const LANGUAGES = [
  { code: 'de', name: 'Deutsch', native: 'Deutsch', rtl: false, default: true },
  { code: 'en', name: 'Englisch', native: 'English', rtl: false },
  { code: 'es', name: 'Spanisch', native: 'Español', rtl: false },
  { code: 'fr', name: 'Französisch', native: 'Français', rtl: false },
  { code: 'it', name: 'Italienisch', native: 'Italiano', rtl: false },
  { code: 'tr', name: 'Türkisch', native: 'Türkçe', rtl: false },
  { code: 'ru', name: 'Russisch', native: 'Русский', rtl: false },
  { code: 'ar', name: 'Arabisch', native: 'العربية', rtl: true },
];

// Aufbau: Schlüssel → { de, en, … }. Grundsprache ist Deutsch (die Sprache des Projekts).
const TEXTS = {
  'app.name': { de: 'AURA', en: 'AURA' },
  'app.owner': { de: 'Creed Street Studios', en: 'Creed Street Studios' },
  'nav.start': { de: 'Start', en: 'Start', es: 'Inicio', fr: 'Démarrage', it: 'Avvio', tr: 'Başlangıç', ru: 'Старт', ar: 'البداية' },
  'nav.account': { de: 'Konto', en: 'Account', es: 'Cuenta', fr: 'Compte', it: 'Account', tr: 'Hesap', ru: 'Аккаунт', ar: 'الحساب' },
  'nav.studio': { de: 'Tonstudio', en: 'Studio', es: 'Estudio', fr: 'Studio', it: 'Studio', tr: 'Stüdyo', ru: 'Студия', ar: 'الاستوديو' },
  'nav.messenger': { de: 'Nachrichten', en: 'Messages', es: 'Mensajes', fr: 'Messages', it: 'Messaggi', tr: 'Mesajlar', ru: 'Сообщения', ar: 'الرسائل' },
  'nav.analysis': { de: 'Auswertung', en: 'Analytics', es: 'Análisis', fr: 'Analyse', it: 'Analisi', tr: 'Analiz', ru: 'Аналитика', ar: 'التحليلات' },
  'nav.projects': { de: 'Projekte', en: 'Projects', es: 'Proyectos', fr: 'Projets', it: 'Progetti', tr: 'Projeler', ru: 'Проекты', ar: 'المشاريع' },
  'nav.support': { de: 'Support', en: 'Support', es: 'Soporte', fr: 'Assistance', it: 'Supporto', tr: 'Destek', ru: 'Поддержка', ar: 'الدعم' },
  'nav.design': { de: 'Gestaltung', en: 'Design', es: 'Diseño', fr: 'Design', it: 'Design', tr: 'Tasarım', ru: 'Дизайн', ar: 'التصميم' },
  'nav.console': { de: 'Konsole', en: 'Console', es: 'Consola', fr: 'Console', it: 'Console', tr: 'Konsol', ru: 'Консоль', ar: 'الطرفية' },
  'nav.music': { de: 'Musik', en: 'Music', es: 'Música', fr: 'Musique', it: 'Musica', tr: 'Müzik', ru: 'Музыка', ar: 'الموسيقى' },
  'nav.legal': { de: 'Recht', en: 'Legal', es: 'Legal', fr: 'Mentions légales', it: 'Legale', tr: 'Hukuk', ru: 'Правовое', ar: 'قانوني' },
  'nav.newsletter': { de: 'Rundbrief', en: 'Newsletter', es: 'Boletín', fr: 'Lettre', it: 'Notiziario', tr: 'Bülten', ru: 'Рассылка', ar: 'النشرة' },
  'nav.sponsor': { de: 'Fördern', en: 'Sponsor', es: 'Patrocinar', fr: 'Soutenir', it: 'Sostenere', tr: 'Destek ol', ru: 'Поддержать', ar: 'الدعم المالي' },
  'action.save': { de: 'Speichern', en: 'Save', es: 'Guardar', fr: 'Enregistrer', it: 'Salva', tr: 'Kaydet', ru: 'Сохранить', ar: 'حفظ' },
  'action.cancel': { de: 'Abbrechen', en: 'Cancel', es: 'Cancelar', fr: 'Annuler', it: 'Annulla', tr: 'İptal', ru: 'Отмена', ar: 'إلغاء' },
  'action.send': { de: 'Senden', en: 'Send', es: 'Enviar', fr: 'Envoyer', it: 'Invia', tr: 'Gönder', ru: 'Отправить', ar: 'إرسال' },
  'action.close': { de: 'Schließen', en: 'Close', es: 'Cerrar', fr: 'Fermer', it: 'Chiudi', tr: 'Kapat', ru: 'Закрыть', ar: 'إغلاق' },
  'action.skip': { de: 'Überspringen', en: 'Skip', es: 'Omitir', fr: 'Passer', it: 'Salta', tr: 'Atla', ru: 'Пропустить', ar: 'تخطّي' },
  'action.start': { de: 'Starten', en: 'Start', es: 'Comenzar', fr: 'Démarrer', it: 'Avvia', tr: 'Başlat', ru: 'Запустить', ar: 'ابدأ' },
  'state.live': { de: 'LIVE', en: 'LIVE' },
  'state.sim': { de: 'SIMULATION', en: 'SIMULATION', es: 'SIMULACIÓN', fr: 'SIMULATION', it: 'SIMULAZIONE', tr: 'SİMÜLASYON', ru: 'СИМУЛЯЦИЯ', ar: 'محاكاة' },
  'state.not_connected': { de: 'NICHT VERBUNDEN', en: 'NOT CONNECTED', es: 'SIN CONEXIÓN', fr: 'NON CONNECTÉ', it: 'NON COLLEGATO', tr: 'BAĞLI DEĞİL', ru: 'НЕ ПОДКЛЮЧЕНО', ar: 'غير متصل' },
  'state.blocked': { de: 'GESPERRT', en: 'BLOCKED', es: 'BLOQUEADO', fr: 'BLOQUÉ', it: 'BLOCCATO', tr: 'ENGELLİ', ru: 'ЗАБЛОКИРОВАНО', ar: 'محجوب' },
  'human.required': { de: 'Ein Mensch muss zustimmen', en: 'A human must approve', es: 'Una persona debe aprobar', fr: 'Une personne doit approuver', it: 'Una persona deve approvare', tr: 'Bir insan onaylamalı', ru: 'Нужно согласие человека', ar: 'يجب موافقة شخص' },
  'support.contact': { de: 'Kontaktieren Sie unseren Support', en: 'Contact our support', es: 'Contacte con nuestro soporte', fr: 'Contactez notre support', it: 'Contatta il nostro supporto', tr: 'Desteğimizle iletişime geçin', ru: 'Свяжитесь с поддержкой', ar: 'اتصل بالدعم' },
  'support.form.title': { de: 'Was ist passiert?', en: 'What happened?', es: '¿Qué ha pasado?', fr: 'Que s’est-il passé ?', it: 'Cosa è successo?', tr: 'Ne oldu?', ru: 'Что случилось?', ar: 'ماذا حدث؟' },
  'support.ways': { de: 'Wege zum Support', en: 'Ways to reach support', es: 'Vías de soporte', fr: 'Voies de support', it: 'Canali di supporto', tr: 'Destek yolları', ru: 'Способы связи', ar: 'طرق الدعم' },
  'ads.flash': { de: 'Kurzmeldung', en: 'Short notice', es: 'Anuncio breve', fr: 'Annonce courte', it: 'Annuncio breve', tr: 'Kısa duyuru', ru: 'Короткое объявление', ar: 'إعلان قصير' },
  'ads.banner': { de: 'Anzeige', en: 'Advertisement', es: 'Anuncio', fr: 'Publicité', it: 'Pubblicità', tr: 'Reklam', ru: 'Реклама', ar: 'إعلان' },
  'ads.seconds': { de: 'Sekunden', en: 'seconds', es: 'segundos', fr: 'secondes', it: 'secondi', tr: 'saniye', ru: 'секунд', ar: 'ثانية' },
  'referral.title': { de: 'Freund werben, beide profitieren', en: 'Refer a friend, both benefit', es: 'Recomienda y ambos ganan', fr: 'Parrainez, tous deux gagnent', it: 'Invita un amico, entrambi guadagnate', tr: 'Arkadaşını getir, ikiniz kazanın', ru: 'Пригласите друга — выиграют оба', ar: 'ادعُ صديقًا وستربحان' },
  'referral.code': { de: 'Dein Werbecode', en: 'Your referral code', es: 'Tu código', fr: 'Votre code', it: 'Il tuo codice', tr: 'Davet kodun', ru: 'Ваш код', ar: 'رمزك' },
  'sponsor.title': { de: 'Fördern Sie AURA', en: 'Become a sponsor', es: 'Patrocina AURA', fr: 'Devenez sponsor', it: 'Diventa sponsor', tr: 'Sponsor olun', ru: 'Стать спонсором', ar: 'كن راعياً' },
  'sponsor.bottom': { de: 'Förderer und Partner', en: 'Sponsors and partners', es: 'Patrocinadores y socios', fr: 'Sponsors et partenaires', it: 'Sponsor e partner', tr: 'Sponsorlar ve ortaklar', ru: 'Спонсоры и партнёры', ar: 'الرعاة والشركاء' },
  'newsletter.title': { de: 'Rundbrief abonnieren', en: 'Subscribe to the newsletter', es: 'Suscríbete', fr: 'S’abonner', it: 'Iscriviti', tr: 'Abone ol', ru: 'Подписаться', ar: 'اشترك' },
  'newsletter.confirm': { de: 'Bitte E-Mail bestätigen', en: 'Please confirm your e-mail', es: 'Confirma tu correo', fr: 'Confirmez votre e-mail', it: 'Conferma la tua e-mail', tr: 'E-postanı doğrula', ru: 'Подтвердите почту', ar: 'الرجاء تأكيد البريد' },
  'legal.terms': { de: 'Allgemeine Geschäftsbedingungen', en: 'Terms and conditions', es: 'Términos y condiciones', fr: 'Conditions générales', it: 'Condizioni generali', tr: 'Genel şartlar', ru: 'Общие условия', ar: 'الشروط العامة' },
  'legal.privacy': { de: 'Datenschutz', en: 'Privacy', es: 'Privacidad', fr: 'Confidentialité', it: 'Privacy', tr: 'Gizlilik', ru: 'Конфиденциальность', ar: 'الخصوصية' },
  'legal.imprint': { de: 'Impressum', en: 'Imprint', es: 'Aviso legal', fr: 'Mentions légales', it: 'Note legali', tr: 'Künye', ru: 'Выходные данные', ar: 'بيانات الناشر' },
  'legal.withdrawal': { de: 'Widerrufsrecht', en: 'Right of withdrawal', es: 'Derecho de desistimiento', fr: 'Droit de rétractation', it: 'Diritto di recesso', tr: 'Cayma hakkı', ru: 'Право отказа', ar: 'حق الإلغاء' },
  'copyright.line': { de: '© Creed Street Studios 2026 — alle Rechte vorbehalten', en: '© Creed Street Studios 2026 — all rights reserved', es: '© Creed Street Studios 2026 — todos los derechos reservados', fr: '© Creed Street Studios 2026 — tous droits réservés', it: '© Creed Street Studios 2026 — tutti i diritti riservati', tr: '© Creed Street Studios 2026 — tüm hakları saklıdır', ru: '© Creed Street Studios 2026 — все права защищены', ar: '© Creed Street Studios 2026 — جميع الحقوق محفوظة' },
  'music.departments': { de: 'Musik-Abteilungen', en: 'Music departments', es: 'Departamentos musicales', fr: 'Départements musicaux', it: 'Reparti musicali', tr: 'Müzik departmanları', ru: 'Музыкальные отделы', ar: 'أقسام الموسيقى' },
  'music.lyrics': { de: 'Text und Reim', en: 'Lyrics and rhyme', es: 'Letra y rima', fr: 'Paroles et rimes', it: 'Testo e rima', tr: 'Söz ve kafiye', ru: 'Текст и рифма', ar: 'الكلمات والقافية' },
  'music.orchestrator': { de: 'Song-Orchester (Entwurf aus Beschreibung)', en: 'Song orchestrator (plan from a description)', es: 'Orquestador de canciones', fr: 'Orchestrateur de chansons', it: 'Orchestratore di brani', tr: 'Şarkı düzenleyici', ru: 'Оркестратор песни', ar: 'منظّم الأغنية' },
  'boot.starting': { de: 'System startet', en: 'System starting', es: 'El sistema se inicia', fr: 'Le système démarre', it: 'Il sistema si avvia', tr: 'Sistem başlıyor', ru: 'Система запускается', ar: 'النظام يبدأ' },
  'watermark.text': { de: 'Kennzeichnung', en: 'Watermark', es: 'Marca de agua', fr: 'Filigrane', it: 'Filigrana', tr: 'Filigran', ru: 'Водяной знак', ar: 'العلامة المائية' },
  'error.generic': { de: 'Das hat nicht funktioniert', en: 'That did not work', es: 'No funcionó', fr: 'Cela n’a pas fonctionné', it: 'Non ha funzionato', tr: 'İşe yaramadı', ru: 'Не получилось', ar: 'لم ينجح ذلك' },
  'empty.none': { de: 'Noch nichts vorhanden', en: 'Nothing yet', es: 'Nada todavía', fr: 'Rien pour l’instant', it: 'Ancora nulla', tr: 'Henüz bir şey yok', ru: 'Пока ничего', ar: 'لا شيء بعد' },
};

function defaults() { return { default: 'de', overrides: {}, audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    if (!LANGUAGES.some((l) => l.code === raw.default)) raw.default = 'de';
    if (!raw.overrides || typeof raw.overrides !== 'object') raw.overrides = {};
    if (!Array.isArray(raw.audit)) raw.audit = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function isLang(code) { return LANGUAGES.some((l) => l.code === String(code || '').toLowerCase()); }

// Ein Text. Fehlt der Satz in der gewünschten Sprache, kommt die Grundsprache — nie der Schlüssel.
function t(key, lang, vars) {
  const d = load();
  const code = isLang(lang) ? String(lang).toLowerCase() : d.default;
  const row = (d.overrides[key] && Object.keys(d.overrides[key]).length ? d.overrides[key] : null) || TEXTS[key];
  if (!row) return { ok: false, key, text: null, error: `Schlüssel "${key}" gibt es nicht`, languages: LANGUAGES.map((l) => l.code) };
  let text = row[code] || row[d.default] || row.de || null;
  const fallback = !row[code];
  if (text && vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return { ok: true, key, language: row[code] ? code : d.default, fallback, text };
}
function textOf(key, lang, vars) { const r = t(key, lang, vars); return r.ok ? r.text : null; }

// Ganze Seite in einer Sprache: alle Sätze plus Richtung.
function catalog(lang) {
  const d = load();
  const code = isLang(lang) ? String(lang).toLowerCase() : d.default;
  const meta = LANGUAGES.find((l) => l.code === code);
  const items = {};
  let missing = 0;
  for (const key of Object.keys(TEXTS)) {
    const row = (d.overrides[key] && Object.keys(d.overrides[key]).length ? d.overrides[key] : null) || TEXTS[key];
    if (row[code]) items[key] = row[code]; else { items[key] = row[d.default] || row.de; missing++; }
  }
  return { ok: true, language: code, name: meta.name, native: meta.native, rtl: !!meta.rtl, keys: Object.keys(TEXTS).length, own: Object.keys(TEXTS).length - missing, fallback_count: missing, items };
}

function coverage() {
  const rows = LANGUAGES.map((l) => {
    let own = 0;
    for (const key of Object.keys(TEXTS)) if (TEXTS[key][l.code]) own++;
    return { code: l.code, name: l.name, native: l.native, rtl: l.rtl, keys: Object.keys(TEXTS).length, own, percent: Math.round((own / Object.keys(TEXTS).length) * 100) };
  });
  return { ok: true, languages: LANGUAGES.length, keys: Object.keys(TEXTS).length, coverage: rows, note: 'Fehlende Sätze werden in der Grundsprache angezeigt. Es wird nie ein roher Schlüssel sichtbar.' };
}

function setDefault(code, payload) {
  if (!isLang(code)) return { ok: false, error: `Sprache unbekannt. Erlaubt: ${LANGUAGES.map((l) => l.code).join(', ')}` };
  const d = load();
  const alt = d.default;
  d.default = String(code).toLowerCase();
  d.audit.unshift({ at: new Date().toISOString(), action: 'set_default', from: alt, to: d.default, by: String((payload && payload.by) || 'AURA') });
  save(d);
  return { ok: true, default: d.default, from: alt };
}

// Eigene Sätze ergänzen oder überschreiben — ohne die Datei von Hand zu bearbeiten.
function setText(key, code, value, payload) {
  if (!key) return { ok: false, error: 'key fehlt' };
  if (!isLang(code)) return { ok: false, error: 'Sprache unbekannt' };
  const d = load();
  d.overrides[key] = d.overrides[key] || {};
  d.overrides[key][String(code).toLowerCase()] = String(value).slice(0, 400);
  d.audit.unshift({ at: new Date().toISOString(), action: 'set_text', key, language: code, by: String((payload && payload.by) || 'AURA') });
  save(d);
  return { ok: true, key, language: code, text: d.overrides[key][String(code).toLowerCase()], note: 'Gilt ab sofort; die eingebauten Sätze bleiben als Rückfall erhalten.' };
}

function status() {
  const d = load();
  return {
    area: 'I18N', module: 'i18n', state: 'live', file: FILE,
    languages: LANGUAGES.length, default: d.default, keys: Object.keys(TEXTS).length,
    with_right_to_left: LANGUAGES.filter((l) => l.rtl).map((l) => l.code),
    overrides: Object.keys(d.overrides).length,
    rules: ['Grundsprache ist Deutsch; fehlende Sätze fallen darauf zurück.', 'Kein Übersetzungsdienst — alle Sätze stehen hier.', 'Rechts-nach-links wird mitgeliefert, nicht nachträglich gedreht.'],
  };
}

module.exports = {
  meta: { area: 'I18N', id: 'i18n', name: 'Sprachen des Betriebssystems (8 Sprachen, eine Datei)', state: 'live' },
  actions: { status: () => status(), languages: () => ({ ok: true, languages: LANGUAGES }), catalog: (p) => catalog((p || {}).lang), coverage: () => coverage(), translate: (p) => t((p || {}).key, (p || {}).lang, (p || {}).vars), set_default: (p) => setDefault((p || {}).lang, p), set_text: (p) => setText((p || {}).key, (p || {}).lang, (p || {}).value, p) },
  LANGUAGES, TEXTS, t, textOf, catalog, coverage, setDefault, setText, status,
};
