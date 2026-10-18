'use strict';
// Shared, framework-free AURA navigation. Every href below is a live server route.
const TOP_LINKS = [
  { label: 'Hub', href: '/hub' },
  { label: 'Today', href: '/today' },
  { label: 'Intelligence', href: '/intelligence' },
  { label: 'Copilot', href: '/jarvis' },
  { label: 'Reparatur', href: '/repair' },
  { label: 'Ops', href: '/ops' },
  { label: 'Models', href: '/models' },
  { label: 'Studio', href: '/studio-command' },
];

const GROUPS = [
  {
    title: 'Automatisierung & Ablauf',
    links: [
      { label: 'Workflows', href: '/workflows' },
      { label: 'Board', href: '/board' },
      { label: 'Pipelines', href: '/pipelines' },
      { label: 'Console', href: '/console' },
      { label: 'Terminal', href: '/terminal' },
    ],
  },
  {
    title: 'Betrieb & Sicherheit',
    links: [
      { label: 'Logs', href: '/logs' },
      { label: 'Containers', href: '/containers' },
      { label: 'Config', href: '/config' },
      { label: 'Admin', href: '/admin' },
      { label: 'Cluster', href: '/cluster' },
    ],
  },
  {
    title: 'Creator & Wachstum',
    links: [
      { label: 'Creator Passport', href: '/creator-passport' },
      { label: 'Growth Nexus', href: '/growth-nexus' },
      { label: 'Social Control', href: '/social-control' },
      { label: 'Media Newsroom', href: '/media-newsroom' },
      { label: 'Capability Radar', href: '/capability-radar' },
      { label: 'Creator Revenue', href: '/creator-revenue' },
      { label: 'Creator Collaboration', href: '/creator-collaboration' },
      { label: 'Remote Approval', href: '/remote-approval' },
      { label: 'Creator Continuity', href: '/creator-continuity' },
    ],
  },
  {
    title: 'Wissen & Lieferung',
    links: [
      { label: 'Downloads', href: '/downloads' },
      { label: 'Skills', href: '/skills' },
      { label: 'Yellow Pages', href: '/yellowpages' },
      { label: 'Meilensteine', href: '/meilensteine' },
      { label: 'Montage', href: '/montage' },
      { label: 'Research', href: '/research' },
    ],
  },
];

function normalize(href) {
  const path = String(href || '').split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return path || '/';
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function anchor(item, active) {
  const selected = normalize(active) === item.href;
  return `<a href="${escapeHtml(item.href)}"${selected ? ' class="active" aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
}

function html(active) {
  const current = normalize(active);
  const moreActive = GROUPS.some((group) => group.links.some((item) => item.href === current));
  const groups = GROUPS.map((group) => `<section class="aura-nav-group"><h2>${escapeHtml(group.title)}</h2><div>${group.links.map((item) => anchor(item, current)).join('')}</div></section>`).join('');
  return `<style>
.aura-central-nav{position:relative;z-index:1000;display:block;box-sizing:border-box;width:100%;margin:0;padding:8px 12px;background:rgba(5,10,18,.94);border:1px solid rgba(105,190,235,.25);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.18);backdrop-filter:blur(12px);color:#eaf5ff;font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
.aura-central-nav *{box-sizing:border-box}
.aura-central-nav .aura-nav-primary{display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap}
.aura-central-nav .aura-nav-primary>a,.aura-central-nav summary{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:7px 10px;border:1px solid transparent;border-radius:8px;background:transparent;color:#bfd0e4;text-decoration:none;font:700 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}
.aura-central-nav .aura-nav-primary>a:hover,.aura-central-nav summary:hover,.aura-central-nav .aura-nav-primary>a.active,.aura-central-nav summary.active{border-color:rgba(111,221,255,.32);background:rgba(111,221,255,.12);color:#7ce5ff}
.aura-central-nav .aura-nav-more{position:relative}
.aura-central-nav summary{list-style:none}
.aura-central-nav summary::-webkit-details-marker{display:none}
.aura-central-nav summary span{margin-left:5px;color:#7ce5ff}
.aura-central-nav .aura-nav-dropdown{position:absolute;top:calc(100% + 8px);right:0;z-index:1001;display:none;grid-template-columns:repeat(2,minmax(205px,1fr));gap:10px;width:min(760px,94vw);max-height:min(72vh,680px);overflow:auto;padding:14px;border:1px solid rgba(111,221,255,.3);border-radius:12px;background:rgba(5,11,21,.98);box-shadow:0 18px 60px rgba(0,0,0,.55)}
.aura-central-nav details[open]>.aura-nav-dropdown{display:grid}
.aura-central-nav .aura-nav-group{min-width:0;padding:9px;border:1px solid rgba(111,221,255,.13);border-radius:9px;background:rgba(12,24,41,.75)}
.aura-central-nav .aura-nav-group h2{margin:0 0 7px;color:#7ce5ff;font:800 10px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.1em;text-transform:uppercase}
.aura-central-nav .aura-nav-group>div{display:flex;flex-wrap:wrap;gap:3px}
.aura-central-nav .aura-nav-group a{display:inline-flex;align-items:center;padding:5px 7px;border-radius:6px;color:#c2d1e2;text-decoration:none;font:500 11px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif}
.aura-central-nav .aura-nav-group a:hover,.aura-central-nav .aura-nav-group a.active{background:rgba(176,140,255,.16);color:#d4bcff}
@media(max-width:760px){
  .aura-central-nav{padding:7px}
  .aura-central-nav .aura-nav-primary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
  .aura-central-nav .aura-nav-primary>a,.aura-central-nav summary{width:100%;padding:8px 5px;white-space:normal;text-align:center}
  .aura-central-nav .aura-nav-more{grid-column:1/-1}
  .aura-central-nav .aura-nav-dropdown{position:static;width:100%;max-height:62vh;margin-top:6px;grid-template-columns:minmax(0,1fr);padding:8px}
  .aura-central-nav .aura-nav-group{padding:8px}
}
</style><nav class="aura-central-nav" aria-label="AURA-Hauptnavigation"><div class="aura-nav-primary">${TOP_LINKS.map((item) => anchor(item, current)).join('')}<details class="aura-nav-more"><summary${moreActive ? ' class="active" aria-current="location"' : ''}>Mehr <span aria-hidden="true">▾</span></summary><div class="aura-nav-dropdown">${groups}</div></details></div></nav>`;
}

function hrefs() {
  return [...TOP_LINKS, ...GROUPS.flatMap((group) => group.links)].map((item) => item.href);
}

module.exports = { html, hrefs, TOP_LINKS, GROUPS };
