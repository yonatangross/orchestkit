#!/usr/bin/env bash
# tests/unit/test-expect-jev-shadow.sh
#
# Covers the opt-in Jev step judge of /ork:expect
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
#   8. act mode           -> executed_action is the Jev pick, path=jev
#   9. act fallbacks      -> every failure path returns the incumbent pick
#  10. shadow unchanged   -> ORK_EXPECT_JEV=shadow keeps the shadow record
#  11. mode off           -> ORK_EXPECT_JEV unset/0 emits nothing
#  12. act-mode egress    -> same payload hygiene under act
#  13. run summary        -> JEV_RUN line + JSON steps/picks/fallbacks/rate
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
STATUS_FILE="$TMP/status.txt"
DELAY_FILE="$TMP/delay.txt"
MOCK_PID=""
cleanup() { [[ -n "$MOCK_PID" ]] && kill "$MOCK_PID" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

cp "$FIX/jev-response-agree.json" "$RESP_FILE"
echo 200 > "$STATUS_FILE"; echo 0 > "$DELAY_FILE"

PORT="$(python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()")"
DEADPORT="$(python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()")"
ENDPOINT="http://127.0.0.1:$PORT/v1/systemone"
DEAD_ENDPOINT="http://127.0.0.1:$DEADPORT/v1/systemone"

MOCK_LOG="$REQ_LOG" MOCK_RESPONSE="$RESP_FILE" \
MOCK_STATUS_FILE="$STATUS_FILE" MOCK_DELAY_FILE="$DELAY_FILE" \
python3 "$FIX/mock_jev.py" "$PORT" &
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
OUT="$(env -u ORK_EXPECT_JEV -u ORK_EXPECT_JEV_SHADOW ORK_TYPESAFE_API_KEY=test-key \
       ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" \
       --step-id x --goal g --last-verify v --model-action 'click @e3' \
       --snapshot-file "$FIX/aria-login.txt")"
[[ -z "$OUT" ]] && ok "flag unset: no output" || bad "flag unset produced output: $OUT"

OUT="$(env -u ORK_EXPECT_JEV ORK_EXPECT_JEV_SHADOW=0 ORK_TYPESAFE_API_KEY=test-key \
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
    r.get('mode') == 'shadow',
    r.get('floor') == 0.5,
    r.get('below_floor') is False,
    r.get('high_confidence_disagreement') is False,
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
    r.get('below_floor') is False,
    r.get('high_confidence_disagreement') is True,
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

# ── 8: act mode -> executed_action is the Jev pick ───────────
run_jev() {  # extra args passed through to jev-shadow.sh
  ORK_EXPECT_JEV=act ORK_TYPESAFE_API_KEY=test-key \
  ORK_EXPECT_JEV_ENDPOINT="${JEV_ENDPOINT:-$ENDPOINT}" \
  bash "$SH" --step-id act-1 --goal "Click the Sign in button" \
    --last-verify "Page loaded, login form visible" \
    --model-action "click @e3" \
    --snapshot-file "$FIX/aria-login.txt" "$@"
}

cp "$FIX/jev-response-disagree.json" "$RESP_FILE"
LINE="$(run_jev)"
REC="$(printf '%s' "$LINE" | cut -d'|' -f3-)"
VERDICT="$(python3 -c "
import json, sys
r = json.loads(sys.argv[1])
checks = [
    r.get('mode') == 'act',
    r.get('path') == 'jev',
    r.get('executed_action') == 'click:@e7',
    r.get('jev_action') == 'click:@e7',
    r.get('model_action_key') == 'click:@e3',
    r.get('agree') is False,
]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:400])
" "$REC")"
[[ "$VERDICT" == "OK" ]] && ok "act: executed_action is the Jev pick (click:@e7, not the incumbent)" \
  || bad "act pick: $VERDICT"

LINE="$(ORK_EXPECT_JEV=1 ORK_TYPESAFE_API_KEY=test-key \
  ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" --step-id act-2 \
  --goal g --last-verify v --model-action 'click @e3' \
  --snapshot-file "$FIX/aria-login.txt")"
[[ "$(printf '%s' "$LINE" | cut -d'|' -f3- | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("path"))')" == "jev" ]] \
  && ok "ORK_EXPECT_JEV=1 selects act" || bad "=1 did not act: $LINE"

# ── 9: every fallback returns the incumbent pick ─────────────
expect_fallback() {  # $1=reason-substring $2=label ; record on stdin
  python3 -c "
import json, sys
r = json.loads(sys.stdin.read())
want = sys.argv[1]
checks = [
    r.get('mode') == 'act',
    (r.get('path') or '').startswith('fallback'),
    want in (r.get('path') or ''),
    r.get('executed_action') == 'click:@e3',
]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:300])
" "$1" <<< "$(printf '%s' "$LINE" | cut -d'|' -f3-)" > "$TMP/fb.out" 2>&1 || true
  if grep -q '^OK' "$TMP/fb.out"; then ok "$2"; else bad "$2: $(cat "$TMP/fb.out")"; fi
}

LINE="$(env -u ORK_TYPESAFE_API_KEY ORK_EXPECT_JEV=act \
  ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" --step-id fb-1 \
  --goal g --last-verify v --model-action 'click @e3' \
  --snapshot-file "$FIX/aria-login.txt")"
expect_fallback no_api_key "fallback no_api_key -> incumbent"

LINE="$(JEV_ENDPOINT="$DEAD_ENDPOINT" run_jev)"
expect_fallback unreachable_or_timeout "fallback unreachable (dead endpoint) -> incumbent"

echo 1.5 > "$DELAY_FILE"
LINE="$(run_jev)"
echo 0 > "$DELAY_FILE"
expect_fallback unreachable_or_timeout "fallback timeout (delay > budget) -> incumbent"

echo 500 > "$STATUS_FILE"
LINE="$(run_jev)"
echo 200 > "$STATUS_FILE"
expect_fallback http_500 "fallback http 500 -> incumbent"

printf '{"answers":{}}' > "$RESP_FILE"
LINE="$(run_jev)"
expect_fallback empty_answer "fallback empty_answer -> incumbent"

printf '{"answers":{"next_action":{"type":"choice","choice":"bogus_action","confidence":0.9}}}' > "$RESP_FILE"
LINE="$(run_jev)"
expect_fallback malformed_answer "fallback malformed_answer -> incumbent"

cp "$FIX/jev-response-lowconf.json" "$RESP_FILE"
LINE="$(run_jev)"
expect_fallback low_confidence "fallback low_confidence (0.3 < floor 0.5) -> incumbent"
VERDICT="$(python3 -c "
import json, sys
r = json.loads(sys.argv[1])
checks = [
    r.get('jev_action') == 'click:@e3',
    r.get('jev_confidence') == 0.3,
    r.get('agree') is True,
]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:300])
" "$(printf '%s' "$LINE" | cut -d'|' -f3-)")"
[[ "$VERDICT" == "OK" ]] && ok "low_confidence fallback still logs the full Jev answer" \
  || bad "lowconf log: $VERDICT"

# Invalid confidence and nested API shapes are never eligible to steer. Python's
# JSON parser accepts NaN, and bool is a subclass of int, so both need explicit
# rejection rather than a plain numeric comparison against the confidence floor.
invalid_response() {  # $1=label $2=response body
  printf '%s' "$2" > "$RESP_FILE"
  LINE="$(run_jev)"
  expect_fallback malformed_answer "$1 -> incumbent"
}

VALID_NOULS='"goal_reached":{"noul":0.1},"page_changed_as_expected":{"noul":0.8},"blocked":{"noul":0.1}'
invalid_response "fallback missing confidence" \
  "{\"answers\":{\"next_action\":{\"choice\":\"click:@e3\",\"probabilities\":{\"click:@e3\":0.9}},$VALID_NOULS}}"
invalid_response "fallback NaN confidence" \
  "{\"answers\":{\"next_action\":{\"choice\":\"click:@e3\",\"confidence\":NaN,\"probabilities\":{\"click:@e3\":0.9}},$VALID_NOULS}}"
invalid_response "fallback boolean confidence" \
  "{\"answers\":{\"next_action\":{\"choice\":\"click:@e3\",\"confidence\":true,\"probabilities\":{\"click:@e3\":0.9}},$VALID_NOULS}}"
invalid_response "fallback out-of-range confidence" \
  "{\"answers\":{\"next_action\":{\"choice\":\"click:@e3\",\"confidence\":1.1,\"probabilities\":{\"click:@e3\":0.9}},$VALID_NOULS}}"
invalid_response "fallback list answers" '{"answers":[]}'
invalid_response "fallback list choice answer" \
  "{\"answers\":{\"next_action\":[],$VALID_NOULS}}"
invalid_response "fallback list probabilities" \
  "{\"answers\":{\"next_action\":{\"choice\":\"click:@e3\",\"confidence\":0.9,\"probabilities\":[]},$VALID_NOULS}}"
invalid_response "fallback list noul answer" \
  '{"answers":{"next_action":{"choice":"click:@e3","confidence":0.9,"probabilities":{"click:@e3":0.9}},"goal_reached":[],"page_changed_as_expected":{"noul":0.8},"blocked":{"noul":0.1}}}'

for INVALID_FLOOR in 1.1 .nan true; do
  printf '%s\n' \
    'jev_shadow:' \
    '  endpoint: "https://invalid.example/v1/systemone"' \
    '  model: "jev-test"' \
    '  element_cap: 3' \
    '  name_max_chars: 80' \
    '  context_max_chars: 300' \
    '  latency_budget_ms: 400' \
    "  act_confidence_floor: $INVALID_FLOOR" \
    '  thresholds:' \
    '    low_confidence: 0.5' \
    '    goal_reached: 0.7' \
    '    page_changed_as_expected: 0.7' \
    '    blocked: 0.7' > "$TMP/invalid-floor.yaml"
  LINE="$(run_jev --config "$TMP/invalid-floor.yaml")"
  VERDICT="$(python3 -c "
import json, sys
r = json.loads(sys.stdin.read())
checks = [
    r.get('mode') == 'act',
    r.get('path') == 'fallback:invalid_config',
    r.get('executed_action') == 'click @e3',
    r.get('error') == 'invalid jev_shadow config',
]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:300])
" <<< "$(printf '%s' "$LINE" | cut -d'|' -f3-)")"
  [[ "$VERDICT" == "OK" ]] && ok "invalid config floor $INVALID_FLOOR -> raw incumbent" \
    || bad "invalid config floor $INVALID_FLOOR: $VERDICT"
done

cp "$FIX/jev-response-disagree.json" "$RESP_FILE"
LINE="$(ORK_EXPECT_JEV=shadow ORK_TYPESAFE_API_KEY=test-key \
  ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" --step-id unknown-incumbent \
  --goal g --last-verify v --model-action 'unrecognized command' \
  --snapshot-file "$FIX/aria-login.txt")"
VERDICT="$(python3 -c "
import json, sys
r = json.loads(sys.argv[1])
checks = [r.get('agree') is None, r.get('high_confidence_disagreement') is None]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:300])
" "$(printf '%s' "$LINE" | cut -d'|' -f3-)")"
[[ "$VERDICT" == "OK" ]] && ok "unknown incumbent: agreement and disagreement bucket stay unknown" \
  || bad "unknown incumbent: $VERDICT"

# ── 10: shadow mode logs its explicit routing fields ──────────
cp "$FIX/jev-response-agree.json" "$RESP_FILE"
LINE="$(ORK_EXPECT_JEV=shadow ORK_TYPESAFE_API_KEY=test-key \
  ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" --step-id sh-1 \
  --goal g --last-verify v --model-action 'click @e3' \
  --snapshot-file "$FIX/aria-login.txt")"
VERDICT="$(python3 -c "
import json, sys
r = json.loads(sys.argv[1])
checks = [
    'executed_action' not in r,
    'path' not in r,
    r.get('mode') == 'shadow',
    r.get('jev_action') == 'click:@e3',
    r.get('agree') is True,
]
print('OK' if all(checks) else 'FAIL ' + repr(checks) + ' ' + json.dumps(r)[:300])
" "$(printf '%s' "$LINE" | cut -d'|' -f3-)")"
[[ "$VERDICT" == "OK" ]] && ok "shadow: mode recorded and no act fields" \
  || bad "shadow record: $VERDICT"

# ── 11: ORK_EXPECT_JEV unset / 0 stays off ───────────────────
OUT="$(env -u ORK_EXPECT_JEV -u ORK_EXPECT_JEV_SHADOW ORK_TYPESAFE_API_KEY=test-key \
  ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" --step-id m-1 \
  --goal g --last-verify v --model-action 'click @e3' \
  --snapshot-file "$FIX/aria-login.txt")"
[[ -z "$OUT" ]] && ok "ORK_EXPECT_JEV unset: no output" || bad "unset produced output: $OUT"

OUT="$(env -u ORK_EXPECT_JEV_SHADOW ORK_EXPECT_JEV=0 ORK_TYPESAFE_API_KEY=test-key \
  ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" bash "$SH" --step-id m-2 \
  --goal g --last-verify v --model-action 'click @e3' \
  --snapshot-file "$FIX/aria-login.txt")"
[[ -z "$OUT" ]] && ok "ORK_EXPECT_JEV=0: no output" || bad "=0 produced output: $OUT"

# ── 12: act-mode egress is the same bounded payload ──────────
cp "$FIX/jev-response-agree.json" "$RESP_FILE"
: > "$REQ_LOG"
ORK_EXPECT_JEV=act ORK_TYPESAFE_API_KEY=test-key \
ORK_EXPECT_JEV_ENDPOINT="$ENDPOINT" \
bash "$SH" --step-id sec-2 --goal "Continue" --last-verify "form shown" \
  --model-action "click @e3" --snapshot-file "$FIX/aria-secret.txt" >/dev/null
BODY="$(tail -1 "$REQ_LOG")"
LEAK=0
for planted in PLANTED_TOKEN_9f8e7d6c5b PLANTED_COOKIE_a1b2c3d4e5 PLANTED_BEARER_z9y8x7w6v5 \
               PLANTED_ESCTOKEN_c1d2e3f4 PLANTED_ESCBEARER_x9y8z7 'cookie\\u003d' 'Bearer\\u0020' \
               UNRELATED_PAGE_TEXT_7x9q; do
  [[ "$BODY" == *"$planted"* ]] && LEAK=1
done
[[ "$LEAK" == "0" ]] && ok "act: no secret value or non-name page text in the payload (both encodings)" \
  || bad "act-mode leak: $BODY"
SHAPE="$(python3 -c "
import json, sys
b = json.loads(sys.stdin.read())
skeys = sorted(b['state'].keys())
ekeys = sorted({k for e in b['state']['interactive_elements'] for k in e})
print(skeys, ekeys)
" <<< "$BODY")"
[[ "$SHAPE" == "['interactive_elements', 'last_verify', 'step_goal'] ['name', 'ref', 'role']" ]] \
  && ok "act: payload carries only step_goal, last_verify and ref/role/name triples" \
  || bad "act payload shape: $SHAPE"

# ── 13: per-run JEV_RUN summary line + JSON fields ───────────
REPORT_OUT="$(printf '%s\n' \
  'STEP_START|s1|t1' \
  'JEV_SHADOW|s1|{"step_id":"s1","mode":"act","path":"jev","executed_action":"click:@e3","jev_action":"click:@e3","model_action_key":"click:@e3","agree":true,"latency_ms":90,"error":null}' \
  'STEP_DONE|s1|ok' \
  'STEP_START|s2|t2' \
  'JEV_SHADOW|s2|{"step_id":"s2","mode":"act","path":"jev","executed_action":"click:@e7","jev_action":"click:@e7","model_action_key":"click:@e3","agree":false,"latency_ms":95,"error":null}' \
  'STEP_DONE|s2|ok' \
  'STEP_START|s3|t3' \
  'JEV_SHADOW|s3|{"step_id":"s3","mode":"act","path":"fallback:no_api_key","executed_action":"click:@e3","model_action_key":"click:@e3","agree":null,"error":"no_api_key"}' \
  'STEP_DONE|s3|ok' \
  'RUN_COMPLETED|passed|3 passed' \
  | bash "$REPORT_SH" --json)"
[[ "$REPORT_OUT" == *"JEV_RUN|steps=3|picks=2|fallbacks=1|agree_rate=50.0%"* ]] \
  && ok "JEV_RUN summary line: steps, picks, fallbacks, agree rate" \
  || bad "no JEV_RUN line: $REPORT_OUT"
VERDICT="$(python3 -c "
import json, sys
doc = json.loads(sys.stdin.read())
s = doc['jev_shadow']
checks = [
    s['steps'] == 3, s['picks_taken'] == 2, s['fallbacks'] == 1,
    s['agree_rate'] == '50.0%',
    s['recorded'] == 3, s['agreed'] == 1, s['disagreed'] == 1,
    doc['steps'][1]['jev_shadow']['executed_action'] == 'click:@e7',
    doc['steps'][2]['jev_shadow']['path'] == 'fallback:no_api_key',
]
print('OK' if all(checks) else 'FAIL ' + repr(checks))
" <<< "$(printf '%s' "$REPORT_OUT" | sed -n '/^{/,$p')")"
[[ "$VERDICT" == "OK" ]] && ok "JSON report: act fields + run totals (picks/fallbacks/rate)" \
  || bad "summary json: $VERDICT"

echo ""
echo "=========================================="
echo "  $PASS passed, $FAIL failed"
echo "=========================================="
[[ "$FAIL" -eq 0 ]]
