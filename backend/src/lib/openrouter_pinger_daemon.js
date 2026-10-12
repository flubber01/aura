'use strict';
// 06 · OpenRouter provider pinger — configuration probe ONLY.
// This sandbox has no external network egress, so no live provider calls are
// made. In deployment: set OPENROUTER_API_KEY in a secret manager and enable
// probing against the official OpenRouter models endpoint server-side.
function status() {
  const configured = Boolean(process.env.OPENROUTER_API_KEY);
  return {
    provider: 'openrouter',
    api_key_configured: configured,
    egress_attempted: false,
    egress_policy: 'sandbox blocks outbound calls; provider health must be probed from an authorized backend',
    next_steps: configured
      ? ['enable probing flag', 'add latency/error/budget metrics', 'wire failover priority']
      : ['store API key in secret manager (never in public/ or client code)', 'set OPENROUTER_API_KEY', 'enable probing flag'],
  };
}
module.exports = {
  meta: { area: '06', id: 'openrouter_pinger_daemon', name: 'OpenRouter provider pinger', state: 'live' },
  status,
  actions: { status, probe: () => ({ skipped: true, reason: 'external egress disabled by policy in this environment' }) },
};
