#!/usr/bin/env bash
# Gate: tests/manifests/test-manifest-dependencies.sh
# Pass condition: FAILED_CHECKS==0 (line 198). Line 203 adds an explicit
#   TOTAL_CHECKS==0 branch that prints SKIPPED / NOT APPLICABLE and still exits 0.
#   Check 3 (line 175) runs its log_fail inside a `jq | while read` subshell, so
#   its failures cannot reach FAILED_CHECKS in the parent shell.
# control: manifest whose prose says "Depends on ork-x" and declares it -> 0
# fault:   dependencies array removed while the prose claim remains     -> expect non-zero
# fault2:  manifests present but none declares anything (0 checks run)  -> expect non-zero
# fault3:  a declared dependency naming a plugin that does not exist    -> expect non-zero (check 3)
set -uo pipefail

REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
SLUG="manifest-dependencies"
F="$H/fixtures/$SLUG"
GATE="$REPO/tests/manifests/test-manifest-dependencies.sh"

fresh() { rm -rf "$F"; mkdir -p "$F/manifests"; printf '%s\n' '{"name":"ork-x"}' > "$F/manifests/ork-x.json"; }

fresh
printf '%s\n' '{"name":"ork-y","description":"Depends on ork-x for things.","dependencies":["ork-x"]}' > "$F/manifests/ork-y.json"
echo "--- control arm (prose claim backed by a dependencies array) ---" >&2
( cd "$F" && CLAUDE_PROJECT_DIR="$F" bash "$GATE" ) >&2
control_rc=$?

fresh
printf '%s\n' '{"name":"ork-y","description":"Depends on ork-x for things."}' > "$F/manifests/ork-y.json"
echo "--- fault arm (dependencies array removed, prose kept) ---" >&2
( cd "$F" && CLAUDE_PROJECT_DIR="$F" bash "$GATE" ) >&2
fault_rc=$?

fresh
printf '%s\n' '{"name":"ork-y","description":"No claims at all."}' > "$F/manifests/ork-y.json"
echo "--- fault2 arm (zero assertions run) ---" >&2
( cd "$F" && CLAUDE_PROJECT_DIR="$F" bash "$GATE" ) >&2
fault2_rc=$?

fresh
printf '%s\n' '{"name":"ork-y","dependencies":["ork-does-not-exist"]}' > "$F/manifests/ork-y.json"
echo "--- fault3 arm (declared dependency does not exist) ---" >&2
( cd "$F" && CLAUDE_PROJECT_DIR="$F" bash "$GATE" ) >&2
fault3_rc=$?

printf 'RESULT gate=%s control=%s fault=%s fault2=%s fault3=%s\n' "$SLUG" "$control_rc" "$fault_rc" "$fault2_rc" "$fault3_rc"
