'use strict';
// 02 · Role registry / department templates — parsed from ingest/identities.txt
// Format per line: role | department | description   (no credentials, ever)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', '..', 'ingest', 'identities.txt');
let roles = [];
try {
  roles = fs.readFileSync(FILE, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [role, department, description] = l.split('|').map((s) => (s || '').trim());
      return { role, department, description };
    });
} catch { roles = []; }

module.exports = {
  meta: { area: '02', id: 'role_registry', name: 'Role registry / department templates', state: 'live' },
  list: () => roles,
  roles: () => roles.map((r) => r.role),
  status() { return { roles: roles.length, source: 'ingest/identities.txt' }; },
  actions: { list: () => roles, status: () => module.exports.status() },
};
