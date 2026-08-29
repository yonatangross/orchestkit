#!/usr/bin/env bash
# --restricted smoke lane (#3774). See README.md next to this file.
#
# Usage: bash tests/ci/restricted-smoke/run-restricted-smoke.sh [plugin-dir]
# Env:   CLAUDE_BIN (default: claude), SMOKE_KEEP=1 keeps the scratch dir.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
PLUGIN_DIR="${1:-$REPO_ROOT/plugins/ork}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
EXPECTED="$HERE/expected-hook-failures.txt"

[ -f "$PLUGIN_DIR/.claude-plugin/plugin.json" ] || { echo "FAIL: no plugin at $PLUGIN_DIR"; exit 2; }
command -v "$CLAUDE_BIN" >/dev/null || { echo "FAIL: $CLAUDE_BIN not on PATH"; exit 2; }

SCRATCH="$(mktemp -d -t restricted-smoke)"
cleanup() {
  [ -n "${STUB_PID:-}" ] && kill "$STUB_PID" 2>/dev/null || true
  [ "${SMOKE_KEEP:-0}" = "1" ] || rm -rf "$SCRATCH"
}
trap cleanup EXIT

# 1. stub API: zero spend, logs every request
STUB_LOG="$SCRATCH/requests.jsonl" STUB_PORT_FILE="$SCRATCH/port" \
  node "$HERE/stub-anthropic-api.mjs" > "$SCRATCH/stub.log" 2>&1 &
STUB_PID=$!
for _ in $(seq 1 50); do [ -s "$SCRATCH/port" ] && break; sleep 0.1; done
[ -s "$SCRATCH/port" ] || { echo "FAIL: stub did not start"; cat "$SCRATCH/stub.log"; exit 2; }
PORT="$(cat "$SCRATCH/port")"

# 2. a private HOME: the hooks runner writes analytics under $HOME/.claude, so a
#    fresh HOME makes the hook enumeration exact (no other session can write here),
#    and --restricted ignores user settings anyway. Auth is the stub key.
FAKE_HOME="$SCRATCH/home"; mkdir -p "$FAKE_HOME"
echo "claude: $("$CLAUDE_BIN" --version 2>/dev/null || echo unknown)"
echo "plugin: $PLUGIN_DIR"
echo "stub:   http://127.0.0.1:$PORT"

set +e
env -u CLAUDECODE -u CLAUDE_CODE_OAUTH_TOKEN -u CLAUDE_CONFIG_DIR \
  HOME="$FAKE_HOME" ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" ANTHROPIC_API_KEY="restricted-smoke-stub" \
  DISABLE_TELEMETRY=1 DISABLE_ERROR_REPORTING=1 CLAUDE_PROJECT_DIR="$REPO_ROOT" \
  "$CLAUDE_BIN" -p "reply ok" --restricted --plugin-dir "$PLUGIN_DIR" \
    --output-format json --max-turns 1 \
    > "$SCRATCH/result.json" 2> "$SCRATCH/stderr.txt" < /dev/null
RC=$?
set -e
# Stop/SessionEnd hooks flush asynchronously after the process exits.
sleep 3

FAILS=0
fail() { echo "FAIL: $1"; FAILS=$((FAILS + 1)); }
pass() { echo "PASS: $1"; }

# Assertion 1: the run completed and answered
if [ "$RC" -ne 0 ]; then fail "claude exited $RC"; head -c 2000 "$SCRATCH/stderr.txt"; fi
RESULT="$(node -e 'try{const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(r.is_error===false&&/\bok\b/i.test(String(r.result))))}catch{process.stdout.write("false")}' "$SCRATCH/result.json")"
[ "$RESULT" = "true" ] && pass "run completed with result ok, is_error false" || { fail "result envelope: $(head -c 400 "$SCRATCH/result.json")"; }

# Assertion 2: the process really was restricted (no Bash, no WebFetch offered)
TOOLS="$(node -e 'const fs=require("fs");const L=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(l=>JSON.parse(l)).filter(r=>r.method==="POST"&&/\/v1\/messages/.test(r.path)&&Array.isArray(r.tools)&&r.tools.length>5);process.stdout.write(L.length?L[0].tools.join(","):"")' "$SCRATCH/requests.jsonl")"
if [ -z "$TOOLS" ]; then fail "stub saw no /v1/messages request with a tool list"; else
  if grep -qE '(^|,)(Bash|WebFetch)(,|$)' <<< "$TOOLS"; then fail "tool list still offers Bash/WebFetch: $TOOLS"; else pass "restricted proven: tool list has no Bash/WebFetch ($(tr ',' '\n' <<< "$TOOLS" | wc -l | tr -d ' ') tools)"; fi
fi

# Assertion 3 + 4: plugin hooks fired, and the failing set matches the accepted list
TIMING="$FAKE_HOME/.claude/analytics/hook-timing.jsonl"
if [ ! -s "$TIMING" ]; then fail "no plugin hook wrote $TIMING: hooks did not run under --restricted"; else
  node - "$TIMING" "$EXPECTED" <<'JS'
const fs = require('fs');
const [timing, expectedFile] = process.argv.slice(2);
const rows = fs.readFileSync(timing, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const ran = [...new Set(rows.map((r) => r.hook))].sort();
const failed = [...new Set(rows.filter((r) => r.ok === false).map((r) => r.hook))].sort();
const expected = fs.readFileSync(expectedFile, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')).sort();
console.log(`PASS: ${ran.length} distinct plugin hooks fired under --restricted (${rows.length} entries)`);
console.log('hooks: ' + ran.join(' '));
const same = JSON.stringify(failed) === JSON.stringify(expected);
if (same) { console.log(`PASS: failing-hook set matches expected-hook-failures.txt (${failed.length})`); }
else { console.log(`FAIL: failing hooks ${JSON.stringify(failed)} != expected ${JSON.stringify(expected)}`); process.exit(1); }
JS
  [ $? -eq 0 ] || FAILS=$((FAILS + 1))
fi

echo "requests seen by stub: $(wc -l < "$SCRATCH/requests.jsonl" | tr -d ' ')"
if [ "$FAILS" -gt 0 ]; then echo "restricted smoke: $FAILS assertion(s) failed"; exit 1; fi
echo "restricted smoke: all assertions passed"
