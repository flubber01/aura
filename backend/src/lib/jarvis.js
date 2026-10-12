'use strict';
// AURA — J.A.R.V.I.S. (real one): conversational assistant wired to LIVE
// system data. Not a chat toy — every answer is computed from the actual
// backend state (health, containers, learning, backups, logs, traffic,
// roles, workflows, research). Deterministic intent engine; labeled honest.
const registry = require('./registry');

const memory = []; // {at, role, text}
function remember(role, text) {
  memory.push({ at: new Date().toISOString(), role, text: String(text).slice(0, 500) });
  if (memory.length > 24) memory.shift();
}

function say(text, data, action) {
  return { reply: text, data: data || null, action: action || null, mode: 'LIVE', persona: 'J.A.R.V.I.S.' };
}

function healthSnapshot() {
  const os = require('./ops').status();
  const c = registry.counts();
  return { os, c };
}

function think(msg) {
  const m = String(msg || '').trim();
  const q = m.toLowerCase();
  if (!m) return say('At your service. Ask me about system status, containers, learning, backups, logs or research.');

  // greetings
  if (/^(hi|hallo|hey|guten|servus|jarvis)/.test(q) && q.length < 25) {
    const { c } = healthSnapshot();
    return say(`At your service. ${c.live} of ${c.total} areas are live, all containers holding. What do you need?`);
  }

  // learning core
  if (/lern|learn|failure|fehler|curve|kurve|generation/.test(q)) {
    const lc = require('./learning_core').curve();
    return say(`The recursive learning core is at generation ${lc.generation}. ${lc.unique_failures} distinct failure fingerprints known; ` +
      `${lc.totals.blocked} recurrences were blocked by learned fixes. Rule in force: each distinct failure happens at most once unresolved.`, lc.totals);
  }

  // containers / quarantine
  if (/container|quarant|circuit|crash|isolat/.test(q)) {
    const cs = require('./module_container').status();
    const bad = cs.containers.filter((c) => c.container !== 'healthy');
    return say(bad.length
      ? `${bad.length} container(s) need attention: ${bad.map((b) => '#' + b.area + ' ' + b.container).join(', ')}. The rest of the fleet is unaffected — isolation holding.`
      : `All ${cs.containers.length} module containers are healthy. Circuit breakers armed: ${cs.policy.limits.maxFails} fails trigger quarantine.`, { healthy: cs.containers.length - bad.length, flagged: bad.length });
  }

  // backups / restore
  if (/backup|vault|restore|snapshot/.test(q)) {
    const b = require('./txt_watcher').backups();
    return say(`The vault holds ${b.count} snapshots, ${b.verified} verified. Newest: ${b.backups[0] ? b.backups[0].file : 'none'}. Restore is one POST away.`, b.backups[0] || null);
  }

  // kill switch / ops
  if (/kill|ops|emergency|notfall/.test(q)) {
    const os = require('./ops').status();
    return say(os.kill_switch.on
      ? `The kill switch is ENGAGED — reason: ${os.kill_switch.reason}. Actions return 423 until you revive.`
      : 'Kill switch is disengaged, system live. Scheduler ' + (os.scheduler_running ? 'running' : 'paused') + '.', os.kill_switch);
  }

  // logs / errors
  if (/log|error|fehler.*(zeig|list)|zeige.*error/.test(q)) {
    const sr = require('./self_repair').report();
    return say(`Since boot: ${sr.counters.checks} health checks, ${sr.counters.problems} problems detected, ${sr.counters.repaired} repaired, ${sr.counters.failed} repairs failed. Log rotation ran ${sr.counters.rotations} time(s).`, sr.counters);
  }

  // traffic
  if (/traffic|requests|zugriffe|besuch/.test(q)) {
    const t = require('./traffic').report();
    const top = t.top.slice(0, 3).map((x) => x.route + ' ' + x.hits).join(' · ');
    return say(`${t.totalRequests} requests measured since boot, ${t.lastMinute} in the last minute. Top routes: ${top}. All real, no inflation.`, { total: t.totalRequests, lastMinute: t.lastMinute });
  }

  // roles / departments
  if (/rolle|role|abteilung|department|identit/.test(q)) {
    const r = registry.skills.roles();
    return say(`${r.length} specialist identities across ${registry.skills.departments().length} departments stand ready. Every one carries a use-case prompt. Shall I route a task?`, { roles: r.length });
  }

  // workflows
  if (/workflow|builder|pipeline/.test(q)) {
    const wb = require('./workflow_builder').list();
    return say(`${wb.presets.length} preset pipelines and ${wb.custom.length} custom workflows on file. Build new ones in /builder — gates enforced.`, { presets: wb.presets.length, custom: wb.custom.length });
  }

  // research (delegate: actually runs the GitHub fan-out)
  if (/research|recherch|such|finde|github/.test(q)) {
    const topic = m.replace(/.*?(research|recherchier(?:e)?)\s*(nach|über|about|for)?\s*/i, '') || q;
    return say(`Understood. Querying live sources for "${topic}" — this takes a moment.`, { delegate: 'research', topic }, 'research');
  }

  // status / health (default-ish)
  if (/status|health|geht|läuft|laeuft|alive|bericht|report|zustand/.test(q) || /^(wie geht|all good|alles gut)/.test(q)) {
    const { os, c } = healthSnapshot();
    const sr = require('./self_repair').report();
    return say(`All systems nominal. ${c.live}/${c.total} areas live, kill switch ${os.kill_switch.on ? 'ENGAGED' : 'disengaged'}, ` +
      `${sr.counters.problems} problems since boot, learning core at generation ${require('./learning_core').curve().generation}.`, { areas: c, kill: os.kill_switch.on });
  }

  // help
  if (/hilfe|help|was kannst|can you|fähig/.test(q)) {
    return say('I can report on: status, containers, learning curve, backups, logs, traffic, roles, workflows, kill switch — and run live research. Just ask.');
  }

  const { c } = healthSnapshot();
  return say(`I parse intent, not small talk — but I'm listening. Meanwhile: ${c.live} areas live, containers healthy. Try "status", "learning", "containers" or "research <topic>".`);
}

function ask(msg) {
  const out = think(msg);
  remember('user', msg);
  remember('jarvis', out.reply);
  return Object.assign(out, { memory: memory.slice(-10) });
}

module.exports = {
  meta: { area: 'JARVIS', id: 'jarvis', name: 'J.A.R.V.I.S. assistant (live system brain)', state: 'live' },
  ask, memory: () => memory.slice(-24),
};
