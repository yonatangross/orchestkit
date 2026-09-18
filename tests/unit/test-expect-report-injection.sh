#!/usr/bin/env bash
# tests/unit/test-expect-report-injection.sh
#
# Regression for #4219 (audit AF-4): report.sh used to splice RUN_RESULT /
# RUN_SUMMARY (browser-agent stdout, which hostile page content can steer)
# into python3 -c source. These cases feed a hostile RUN_COMPLETED line and
# prove every field arrives in the report as data, never as code.
#
# Cases:
#   1. hostile summary  -> exit 0, valid JSON, literal summary, no canary
#   2. hostile result   -> exit 0, valid JSON, literal result, no canary
#   3. normal run       -> same keys and values as before the fix
#   4. diff-scan.sh     -> non-hex commit hash rejected before git runs
#   5. stop.sh          -> non-label name rejected before rm (needs portless)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
REPORT_SH="$PROJECT_ROOT/src/skills/expect/scripts/report.sh"
DIFF_SCAN="$PROJECT_ROOT/src/skills/expect/scripts/diff-scan.sh"
STOP_SH="$PROJECT_ROOT/src/skills/page-serve/scripts/stop.sh"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; NC=$'\033[0m'
PASS=0; FAIL=0
ok()  { echo "  ${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
bad() { echo "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/expect-report-test.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

CANARY="$TMP/canary-pwned"

echo "=========================================="
echo "  expect report.sh injection (#4219)"
echo "=========================================="

# The payload carries every breakout primitive: a single quote and brace to
# close the old Python string + dict literal, live Python that would create
# the canary, then a comment that swallows a double quote, a backtick
# substitution and a $() substitution. Verified: spliced into the old
# python3 -c source this executes touch and exits 0.
PAYLOAD="x'};import os;os.system('touch $CANARY');exec('y=1')#'\`touch $CANARY\` \$(touch $CANARY) \"quoted\""

# ── 1: hostile summary arrives as a literal string ─────────
OUT="$(printf 'STEP_START|s1|Login page\nSTEP_DONE|s1|form submitted\nRUN_COMPLETED|passed|%s\n' "$PAYLOAD" \
  | bash "$REPORT_SH" --json)" && RC=0 || RC=$?
[[ "$RC" == "0" ]] && ok "hostile summary: report.sh exits 0" \
  || bad "hostile summary: exit $RC"

JSON="$(printf '%s' "$OUT" | sed -n '/^{/,$p')"
VERDICT="$(EXPECTED_SUMMARY="$PAYLOAD" python3 -c "
import json, os, sys
try:
    doc = json.loads(sys.stdin.read())
except Exception as e:
    print('FAIL json did not parse: %s' % e); raise SystemExit
checks = [
    doc.get('result') == 'passed',
    doc.get('summary') == os.environ['EXPECTED_SUMMARY'],
    doc.get('passed') == 1,
    doc.get('failed') == 0,
]
print('OK' if all(checks) else 'FAIL ' + json.dumps(doc)[:400])
" <<< "$JSON")"
[[ "$VERDICT" == "OK" ]] && ok "hostile summary: JSON parses, summary is the literal payload" \
  || bad "hostile summary: $VERDICT"

[[ ! -e "$CANARY" ]] && ok "hostile summary: canary was not created" \
  || bad "hostile summary: CANARY EXISTS (code executed)"

# ── 2: hostile result field arrives as a literal string ────
OUT="$(printf 'RUN_COMPLETED|%s|run done\n' "$PAYLOAD" \
  | bash "$REPORT_SH" --json)" && RC=0 || RC=$?
[[ "$RC" == "0" ]] && ok "hostile result: report.sh exits 0" \
  || bad "hostile result: exit $RC"

JSON="$(printf '%s' "$OUT" | sed -n '/^{/,$p')"
VERDICT="$(EXPECTED_RESULT="$PAYLOAD" python3 -c "
import json, os, sys
try:
    doc = json.loads(sys.stdin.read())
except Exception as e:
    print('FAIL json did not parse: %s' % e); raise SystemExit
checks = [
    doc.get('result') == os.environ['EXPECTED_RESULT'],
    doc.get('summary') == 'run done',
]
print('OK' if all(checks) else 'FAIL ' + json.dumps(doc)[:400])
" <<< "$JSON")"
[[ "$VERDICT" == "OK" ]] && ok "hostile result: JSON parses, result is the literal payload" \
  || bad "hostile result: $VERDICT"

[[ ! -e "$CANARY" ]] && ok "hostile result: canary was not created" \
  || bad "hostile result: CANARY EXISTS (code executed)"

# ── 3: normal run produces the same keys and values ────────
OUT="$(printf 'STEP_START|s1|Open page\nSTEP_DONE|s1|page loaded\nRUN_COMPLETED|passed|1 passed, 0 failed\n' \
  | bash "$REPORT_SH" --json)" && RC=0 || RC=$?
[[ "$RC" == "0" ]] && ok "normal run: report.sh exits 0" || bad "normal run: exit $RC"

JSON="$(printf '%s' "$OUT" | sed -n '/^{/,$p')"
VERDICT="$(python3 -c "
import json, re, sys
try:
    doc = json.loads(sys.stdin.read())
except Exception as e:
    print('FAIL json did not parse: %s' % e); raise SystemExit
checks = [
    sorted(doc.keys()) == ['failed', 'passed', 'result', 'steps', 'summary', 'timestamp'],
    re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$', doc['timestamp']) is not None,
    doc['steps'] == [{'id': 's1', 'title': 'Open page', 'status': 'passed', 'summary': 'page loaded'}],
    doc['passed'] == 1,
    doc['failed'] == 0,
    doc['result'] == 'passed',
    doc['summary'] == '1 passed, 0 failed',
]
print('OK' if all(checks) else 'FAIL ' + json.dumps(doc)[:400])
" <<< "$JSON")"
[[ "$VERDICT" == "OK" ]] && ok "normal run: same keys and values as before" \
  || bad "normal run: $VERDICT"

# ── 4: diff-scan.sh rejects a non-hex commit hash ──────────
DIFF_CANARY="$TMP/diff-canary"
OUT="$(bash "$DIFF_SCAN" commit "--output=$DIFF_CANARY" 2>&1)" && RC=0 || RC=$?
if [[ "$RC" != "0" && "$OUT" == *"Invalid commit hash"* && ! -e "$DIFF_CANARY" ]]; then
  ok "diff-scan: flag-shaped hash rejected, no --output write"
else
  bad "diff-scan: rc=$RC out=$OUT canary=$([ -e "$DIFF_CANARY" ] && echo present || echo absent)"
fi

OUT="$(bash "$DIFF_SCAN" commit 'deadbeef' 2>/dev/null)" && RC=0 || RC=$?
[[ "$RC" == "0" && "$OUT" == *'"target":"commit"'* ]] && ok "diff-scan: hex hash still accepted" \
  || bad "diff-scan: valid hash rejected (rc=$RC)"

# ── 5: stop.sh rejects a non-label name ────────────────────
if command -v portless >/dev/null 2>&1; then
  OUT="$(bash "$STOP_SH" '../../tmp/evil' 2>&1)" && RC=0 || RC=$?
  if [[ "$RC" != "0" && "$OUT" == *"not a valid subdomain label"* ]]; then
    ok "stop.sh: traversal name rejected"
  else
    bad "stop.sh: rc=$RC out=$OUT"
  fi
else
  echo "  SKIP stop.sh case (portless not installed)"
fi

echo ""
echo "=========================================="
echo "  $PASS passed, $FAIL failed"
echo "=========================================="
[[ "$FAIL" -eq 0 ]]
