'use strict';
// 25 · Synaptic heartbeat bridge — process liveness beacon, keeps last 60 beats.
const beats = [];
const timer = setInterval(() => {
  beats.push({ at: Date.now(), rss_mb: Math.round(process.memoryUsage().rss / 1048576) });
  if (beats.length > 60) beats.shift();
}, 5000);
timer.unref();

module.exports = {
  meta: { area: '25', id: 'synaptic_heartbeat_bridge', name: 'Synaptic heartbeat bridge', state: 'live' },
  status() {
    const last = beats[beats.length - 1];
    return { beats: beats.length, last_beat: last ? new Date(last.at).toISOString() : null, rss_mb: last ? last.rss_mb : null, interval_s: 5 };
  },
  actions: { beats: () => beats.slice(-20), status: () => module.exports.status() },
};
