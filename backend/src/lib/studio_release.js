'use strict';
// Studio → Release-Plan: Label-Stufen und Distributoren (DistroKid, TuneCore, CD Baby, Ditto, eigene).
// Nur lesend. Es wird nichts hochgeladen oder veröffentlicht. Jede Veröffentlichung läuft manuell durch einen Menschen.
const label = require('./label_pipeline');
const channels = require('./channel_pipelines');

// Schritte, die nur ein Mensch auslösen oder freigeben darf
const HUMAN_STEPS = new Set(['admin_approved', 'distributed_manual', 'teaser_ready', 'announced']);

function releasePlan({ channelIds = [] } = {}) {
  const all = channels.channels();
  const distro = all.filter((c) => c.kind === 'distribution');
  const wanted = Array.isArray(channelIds) ? channelIds.filter(Boolean) : [];
  const selected = wanted.length ? distro.filter((c) => wanted.includes(c.id)) : distro;
  const unknown = wanted.filter((id) => !all.some((c) => c.id === id));

  return {
    ok: true,
    read_only: true,
    stages: label.STAGES.map((id, i) => ({
      step: i + 1,
      id,
      check: id in label.GATES ? 'automatische Prüfung' : 'manuell',
      human_required: HUMAN_STEPS.has(id),
    })),
    distributors: selected.map((c) => ({
      id: c.id,
      label: c.label,
      publish: c.publish,
      api: c.api,
      rules: c.extra_rules || [],
      note: 'Upload nur manuell durch einen Menschen. Keine automatische Veröffentlichung.',
    })),
    unknown_channels: unknown,
    notes: [
      'Nur eigene Rechte an Musik und Covern hochladen.',
      'Keine Preise und keine Verkaufsversprechen in Texten.',
      'Freigabe durch einen Admin ist vor jeder Veröffentlichung nötig.',
    ],
  };
}

module.exports = { releasePlan, HUMAN_STEPS };
