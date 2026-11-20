#!/usr/bin/env bash
# Test: scripts/perf-compare.sh must refuse a snapshot it cannot read.
#
# read_scalars used to swallow JSON.parse errors and substitute "0|0|unknown",
# so a truncated after-snapshot compared as a 100% IMPROVEMENT with exit 0 and
# a broken measurement passed as a win. An unreadable snapshot is an input
# error (exit 2, naming the file); valid snapshots, zero-token ones included,
# still compare as before.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPARE="$REPO_ROOT/scripts/perf-compare.sh"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-perf-compare.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

FAILED=0
echo "=== perf-compare.sh Snapshot Input Test ==="

printf '%s' '{"totalTokensInjected":100,"hookCount":2,"bucket":"baseline"}' > "$WORK/before.json"
printf '%s' '{"totalTokensInjected":101,"hookCount":2,"bucket":"after"}' > "$WORK/regressed.json"
printf '%s' '{"totalTokensInjected":0,"hookCount":0,"bucket":"after"}' > "$WORK/zero.json"
printf '%s' '{"hookCount":2,"bucket":"after"}' > "$WORK/no-total.json"
printf '%s' '{truncated' > "$WORK/truncated.json"
: > "$WORK/empty.json"
printf '%s' '[1,2]' > "$WORK/array.json"
printf '%s' 'null' > "$WORK/null.json"
printf '%s' '{"totalTokensInjected":"lots","hookCount":2}' > "$WORK/string-total.json"
printf '%s' '{"totalTokensInjected":-5,"hookCount":2}' > "$WORK/negative-total.json"
printf '%s' '{"totalTokensInjected":100,"hookCount":1.5}' > "$WORK/fraction-hooks.json"

# expect <name> <before> <after> <exit> <pattern in combined output>
expect() {
    local name="$1" before="$2" after="$3" want_rc="$4" pattern="$5" out rc=0
    out="$(bash "$COMPARE" "$WORK/$before" "$WORK/$after" 2>&1)" || rc=$?
    if [ "$rc" -eq "$want_rc" ] && grep -qF -- "$pattern" <<< "$out"; then
        echo "  PASS: $name (exit $rc)"
    else
        echo "  FAIL: $name: want exit $want_rc with '$pattern', got exit $rc"
        printf '%s\n' "$out" | sed 's/^/    | /'
        FAILED=1
    fi
}

echo "--- unreadable snapshots are input errors ---"
expect "truncated after"          before.json truncated.json      2 "not valid JSON: $WORK/truncated.json"
expect "truncated before"         truncated.json before.json      2 "not valid JSON: $WORK/truncated.json"
expect "empty after"              before.json empty.json          2 "not valid JSON: $WORK/empty.json"
expect "array after"              before.json array.json          2 "not a JSON object: $WORK/array.json"
expect "null after"               before.json null.json           2 "not a JSON object: $WORK/null.json"
expect "string token total"       before.json string-total.json   2 "totalTokensInjected is not a non-negative integer"
expect "negative token total"     before.json negative-total.json 2 "totalTokensInjected is not a non-negative integer"
expect "fractional hook count"    before.json fraction-hooks.json 2 "hookCount is not a non-negative integer"

echo "--- valid snapshots still compare ---"
expect "regression"               before.json regressed.json      1 "REGRESSION: token overhead increased by 1 tokens"
expect "zero-token improvement"   before.json zero.json           0 "IMPROVEMENT"
expect "missing total reads as 0" before.json no-total.json       0 "IMPROVEMENT"
expect "no change"                before.json before.json         0 "NO CHANGE"

echo ""
if [ "$FAILED" -ne 0 ]; then
    echo "FAILED"
    exit 1
fi
echo "ALL PASSED"
