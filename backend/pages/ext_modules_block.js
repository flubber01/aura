'use strict';
// Liefert den HTML-Block „Erweiterungsmodule“ für die bestehende Konsole (/).
// Kein eigener Seitenaufbau: der Block wird in die vorhandene Seite eingesetzt.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'ext_modules.fragment.html');

module.exports = function extModulesBlock() {
  try { return fs.readFileSync(FILE, 'utf8'); }
  catch (e) { return '<p class="sub">Modulblock nicht ladbar: ' + String(e.message).replace(/</g, '&lt;') + '</p>'; }
};
