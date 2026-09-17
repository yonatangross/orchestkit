#!/usr/bin/env bash
# tests/unit/test-expect-jev-shadow.sh
#
# Covers the opt-in Jev shadow step of /ork:expect
# (src/skills/expect/scripts/jev-shadow.sh + jev_shadow.py,
# references/jev-shadow.md).
#
# Cases:
#   1. flag off (unset)   -> no stdout, zero requests at the mock
#   2. flag off (=0)      -> same
#   3. unambiguous goal   -> Jev pick beside model pick, agree=true, in budget
#   4. disagreement       -> agree=false, Jev pick still logged
#   5. payload hygiene    -> planted cookie/token/bearer values never reach
#                            the wire, in raw AND JSON-escaped encodings;
#                            page text beyond names neither
#   6. element cap        -> comes from the skill config, not a constant
#   7. report.sh          -> JEV_SHADOW folds into the JSON report
#
# tests/fixtures/expect/mock_jev.py stands in for the Jev endpoint;
# nothing here touches the real network.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SH="$PROJECT_ROOT/src/skills/expect/scripts/jev-shadow.sh"
REPORT_SH="$PROJECT_ROOT/src/skills/expect/scripts/report.sh"
FIX="$PROJECT_ROOT/tests/fixtures/expect"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; NC=$'\033[0m'
PASS=0; FAIL=0
ok()  { echo "  ${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
bad() { echo "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/jev-shadow-test.XXXXXX")"
REQ_LOG="$TMP/requests.log"
RESP_FILE="$TMP/response.json"
MOCK_PID=""
cleanup() { [[ -n "$MOCK_PID" ]] && kill "$MOCK_PID" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

cp "$FIX/jev-response-agree.json" "$RESP_FILE"

PORT="$(python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()")"
ENDPOINT="http://127.0.0.1:$PORT/v1/systemone"

MOCK_LOG="$REQ_LOG" MOCK_RESPONSE="$RESP_FILE" python3 "$FIX/mock_jev.py" "$PORT" &
MOCK_PID=$!

READY=0
for _ in $(seq 1 100); do
  if curl -sf "http://127.0.0.1:$PORT/" -o /dev/null 2>&1; then READY=1; break; fi
  sleep 0.05
done
[[ "$READY" == "1" ]] || { bad "mock server did not start"; echo "1 failed"; exit 1; }

echo "=========================================="
echo "  expect Jev shadow"
echo "=========================================="

run_shadow() {
  ORK_EXPECT_JEV_SHADOW=1 ORK_TYPESAFE_API_KEY=test-key \
  ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" \
  bash "$SH" --step-id login-2 \
    --goal "Click the Sign in button" \
    --last-verify "Page loaded, login form visible" \
    --model-action "click @e3" \
    --snapshot-file "$FIX/aria-login.txt" "$@"
}

# ── 1/2: flag off = no output, zero requests ─────────────────
OUT="$(env -u ORK_EXPECT_JEV_SHADOW ORK_TYPESAFE_API_KEY=test-key \
       ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" \
       --step-id x --goal g --last-verify v --model-action 'click @e3' \
       --snapshot-file "$FIX/aria-login.txt")"
[[ -z "$OUT" ]] && ok "flag unset: no output" || bad "flag unset produced output: $OUT"

OUT="$(env ORK_EXPECT_JEV_SHADOW=0 ORK_TYPESAFE_API_KEY=test-key \
       ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" \
       --step-id x --goal g --last-verify v --model-action 'click @e3' \
       --snapshot-file "$FIX/aria-login.txt")"
[[ -z "$OUT" ]] && ok "flag=0: no output" || bad "flag=0 produced output: $OUT"

COUNT="$(curl -sf "http://127.0.0.1:$PORT/")"
[[ "$COUNT" == "0" ]] && ok "flag off: zero network (mock saw 0 requests)" \
  || bad "flag off hit the network ($COUNT requests)"

# ── 3: unambiguous goal, agreement, latency budget ───────────
LINE="$(run_shadow)"
if [[ "$LINE" == JEV_SHADOW\|login-2\|* ]]; then
  ok "emits JEV_SHADOW|<step>|<json>"
else
  bad "bad line shape: $LINE"
fi
REC="$(printf '%s' "$LINE" | cut -d'|' -f3-)"

VERDICT="$(python3 -c "
import json, sys
r = json.loads(sys.argv[1])
want_nouls = {'goal_reached', 'page_changed_as_expected', 'blocked'}
checks = [
    r.get('jev_action') == 'click:@e3',
    r.get('model_action_key') == 'click:@e3',
    r.get('agree') is True,
    isinstance(r.get('latency_ms'), int) and r['latency_ms'] < 400,
    r.get('latency_budget_ms') == 400,
    set(r.get('nouls', {})) == want_nouls,
    bool(r.get('probabilities')),
    r.get('error') is None,
]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:400])
" "$REC")"
[[ "$VERDICT" == "OK" ]] && ok "record: jev pick beside model pick, agree=true, latency in budget" \
  || bad "record: $VERDICT"

BODY="$(tail -1 "$REQ_LOG")"
SHAPE="$(python3 -c "
import json, sys
b = json.loads(sys.stdin.read())
els = b['state']['interactive_elements']
keys = sorted({k for e in els for k in e})
qs = sorted(b['questions'].keys())
print(len(els), keys, qs, repr(b['state'].get('step_goal')))
" <<< "$BODY")"
if [[ "$SHAPE" == *"['name', 'ref', 'role']"* ]]; then
  ok "request: elements are ref/role/name triples only"
else
  bad "element shape: $SHAPE"
fi
[[ "$SHAPE" == *"['blocked', 'goal_reached', 'next_action', 'page_changed_as_expected']"* ]] \
  && ok "request: one Choice + three Nouls in a single call" \
  || bad "questions shape: $SHAPE"
[[ "$BODY" != *UNRELATED_PAGE_TEXT_7x9q* ]] && ok "no page text beyond names leaves" \
  || bad "non-name page text leaked into payload"

# ── 4: disagreement ──────────────────────────────────────────
cp "$FIX/jev-response-disagree.json" "$RESP_FILE"
: > "$REQ_LOG"
LINE="$(run_shadow)"
REC="$(printf '%s' "$LINE" | cut -d'|' -f3-)"
VERDICT="$(python3 -c "
import json, sys
r = json.loads(sys.argv[1])
checks = [
    r.get('jev_action') == 'click:@e7',
    r.get('model_action_key') == 'click:@e3',
    r.get('agree') is False,
    r.get('nouls', {}).get('blocked') == 0.8,
    r.get('flags', {}).get('blocked') is True,
]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:400])
" "$REC")"
[[ "$VERDICT" == "OK" ]] && ok "disagreement logged: agree=false, Jev pick kept, blocked flag raised" \
  || bad "disagreement: $VERDICT"

# ── 5: payload hygiene (planted secrets) ─────────────────────
: > "$REQ_LOG"
ORK_EXPECT_JEV_SHADOW=1 ORK_TYPESAFE_API_KEY=test-key \
ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" \
bash "$SH" --step-id sec-1 --goal "Continue" --last-verify "form shown" \
  --model-action "click @e3" --snapshot-file "$FIX/aria-secret.txt" >/dev/null
BODY="$(tail -1 "$REQ_LOG")"
LEAK=0
# raw-encoding plants
for planted in PLANTED_TOKEN_9f8e7d6c5b PLANTED_COOKIE_a1b2c3d4e5 PLANTED_BEARER_z9y8x7w6v5; do
  [[ "$BODY" == *"$planted"* ]] && LEAK=1
done
[[ "$LEAK" == "0" ]] && ok "no cookie/token/bearer value in the payload (raw encoding)" \
  || bad "secret leaked: $BODY"
# JSON-escaped plants: the fixture carries cookie\u003d<val> and Bearer\u0020<val>;
# neither the planted value nor its escaped carrier may survive to the wire.
ESC_LEAK=0
for planted in PLANTED_ESCTOKEN_c1d2e3f4 PLANTED_ESCBEARER_x9y8z7 'cookie\\u003d' 'Bearer\\u0020'; do
  [[ "$BODY" == *"$planted"* ]] && ESC_LEAK=1
done
[[ "$ESC_LEAK" == "0" ]] && ok "no cookie/token/bearer value in the payload (JSON-escaped encoding)" \
  || bad "escaped secret leaked: $BODY"
[[ "$BODY" == *"[redacted]"* ]] && ok "secret spans redacted in payload" \
  || bad "no redaction marker found: $BODY"

# ── 6: element cap comes from config ─────────────────────────
: > "$REQ_LOG"
run_shadow --config "$FIX/jev-shadow-config-cap3.yaml" >/dev/null
BODY="$(tail -1 "$REQ_LOG")"
SHAPE="$(python3 -c "
import json, sys
b = json.loads(sys.stdin.read())
print(len(b['state']['interactive_elements']), b['model'])
" <<< "$BODY")"
[[ "$SHAPE" == "3 jev-test-cap" ]] && ok "element_cap=3 and model come from skill config" \
  || bad "config not honored: $SHAPE"

# ── 7: report.sh folds JEV_SHADOW into the JSON report ───────
JEV_LINE='JEV_SHADOW|s1|{"step_id":"s1","jev_action":"click:@e3","model_action_key":"click:@e3","agree":true,"latency_ms":120,"error":null}'
REPORT_OUT="$(printf 'STEP_START|s1|t\n%s\nSTEP_DONE|s1|ok\nRUN_COMPLETED|passed|1 passed\n' "$JEV_LINE" \
  | bash "$REPORT_SH" --json)"
[[ "$REPORT_OUT" == *"JEV_SHADOW|s1|"* ]] && ok "report.sh passes JEV_SHADOW through" \
  || bad "JEV_SHADOW line lost: $REPORT_OUT"
VERDICT="$(python3 -c "
import json, sys
doc = json.loads(sys.stdin.read())
s = doc['jev_shadow']
st = doc['steps'][0]
checks = [
    s['recorded'] == 1, s['agreed'] == 1, s['disagreed'] == 0,
    st.get('jev_shadow', {}).get('jev_action') == 'click:@e3',
    st.get('jev_shadow', {}).get('agree') is True,
]
print('OK' if all(checks) else 'FAIL ' + repr(checks))
" <<< "$(printf '%s' "$REPORT_OUT" | sed -n '/^{/,$p')")"
[[ "$VERDICT" == "OK" ]] && ok "JSON report: per-step jev_shadow + run summary" \
  || bad "report json: $VERDICT"

echo ""
echo "=========================================="
echo "  $PASS passed, $FAIL failed"
echo "=========================================="
[[ "$FAIL" -eq 0 ]]
