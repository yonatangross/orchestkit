#!/usr/bin/env bash
# Gate: tests/plugins/test-settings-validation.sh
# Pass condition: TOTAL_FAILED == 0 after a loop over plugins/*/settings.json.
# The loop body is the only place a failure can be recorded, so zero settings
# files means zero assertions and a silent exit 0.
set -uo pipefail

REPO="${REPO:?set by the fault-arms runner}"
GATE="$REPO/tests/plugins/test-settings-validation.sh"
FIX="$H/fixtures/settings-validation"

rm -rf "$FIX"
mkdir -p "$FIX/control/plugins/ork"
mkdir -p "$FIX/fault/plugins/ork"

cp "$REPO/plugins/ork/settings.json" "$FIX/control/plugins/ork/settings.json"
# fault: plugins/ork/ exists but carries no settings.json at all.

CLAUDE_PROJECT_DIR="$FIX/control" bash "$GATE" >"$FIX/control.log" 2>&1
control_rc=$?
CLAUDE_PROJECT_DIR="$FIX/fault" bash "$GATE" >"$FIX/fault.log" 2>&1
fault_rc=$?

{
  echo "--- control tail ---"; tail -4 "$FIX/control.log"
  echo "--- fault tail ---";   tail -4 "$FIX/fault.log"
} >&2

printf 'RESULT gate=%s control=%s fault=%s\n' "settings-validation" "$control_rc" "$fault_rc"
