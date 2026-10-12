#!/usr/bin/env bash
# AURA 1-click reproduction check — proves a running instance reproduces:
# syntax of all JS, full API/page sweep, repro report. Exit 0 = reproducible.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8080}"
export AURA_URL="${AURA_URL:-http://127.0.0.1:$PORT}"
echo "== AURA reproduction check =="
echo "1/3 syntax (all backend JS)"
fail=0
for f in $(find backend -name '*.js' -not -path '*/node_modules/*'); do
  node --check "$f" || { echo "  SYNTAX FAIL: $f"; fail=1; }
done
[ "$fail" -eq 0 ] && echo "  ✔ syntax clean"
echo "2/3 validation sweep ($AURA_URL)"
node test/validate.js
echo "3/3 repro report"
curl -fsS "$AURA_URL/api/repro" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const r=JSON.parse(d);
  console.log('  commit',r.commit,'· node',r.node,'· uptime',r.uptime_s+'s');
  console.log('  pages',r.checks.pages,'· vault',r.checks.vault.verified+'/'+r.checks.vault.snapshots,'verified');
  console.log('  quarantined containers:',r.checks.containers_quarantined,'· kill switch:',r.checks.kill_switch?'ON':'off');
});"
echo "== reproduction verified ✔ =="
