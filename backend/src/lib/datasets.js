'use strict';
// Shared boot-time datasets (previously inline in server.js). Single source
// for modules/integrations/teams/yellowpages used by catalogs and routes.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', '..', '..', 'extracted', 'AURA-Web-Deploy', 'public');

function safeLoad(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }
  catch (e) { console.error('WARN: data/' + name + ' unreadable at boot (' + e.message + ') — using fallback; watcher will heal it'); return fallback; }
}

module.exports = {
  DATA_DIR, PUBLIC_DIR,
  modules: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'modules.json'), 'utf8')),
  integrations: JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'data', 'integrations.json'), 'utf8')),
  yellowpages: safeLoad('yellowpages.json', { links: [] }),
  teams: safeLoad('teams.json', { teams: [] }),
  safeLoad,
};
