#!/bin/bash
# Security Tests: compound commands, blocker retirement tripwire
#
# WHAT THIS FILE USED TO BE
# Tests 1-7 asserted the blocker caught a dangerous segment anywhere in a &&, ;, || or | chain (compound-command-validator's Tests 8-13 were retired in wave 1).
#
# WHAT IT TESTS NOW (#3835 wave 4, 2026-08-31)
# dangerous-command-blocker was deleted by operator decision. Every DENY
# pattern it carried is a Bash() deny rule in the OPERATOR's settings scope
# (skills/setup phase 3.6 writes it, skills/doctor audits it), enforced by CC
# before any hook runs, including under --dangerously-skip-permissions
# (measured by tests/ci/restricted-smoke/probe-permission-deny.sh, a CI step
# that reads REGRESSED on failure). CC evaluates permission rules per segment of a compound command (nine-release fix trail through 2.1.251).
#
# This file is the #3807-shaped tripwire: the hook must stay gone AND the
# payload must keep every pattern it denied AND the canary probe must be wired
# into CI. The full old contract is in git history at the parent of the #3835
# wave 4 commit. Deliberately given up with the hook (recorded so nobody
# rediscovers it as a gap): nothing beyond the blocker itself; per-segment evaluation is now CC's, gated by the canary probe.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
PASS=0; FAIL=0
section()  { echo; echo "${YELLOW}$1${NC}"; }
ok()  { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
bad() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

BLOCKER_TS="$PROJECT_ROOT/src/hooks/src/pretool/bash/dangerous-command-blocker.ts"
PAYLOAD="$PROJECT_ROOT/src/skills/setup/references/operator-permissions.json"
PROBE="$PROJECT_ROOT/tests/ci/restricted-smoke/probe-permission-deny.sh"

section "1. The hook is retired"
if [[ ! -e "$BLOCKER_TS" ]]; then ok "dangerous-command-blocker.ts absent"; else bad "dangerous-command-blocker.ts revived"; fi
if grep -q "pretool/bash/dangerous-command-blocker" "$PROJECT_ROOT/src/hooks/src/entries/pretool.ts"; then
  bad "still registered in entries/pretool.ts"
else
  ok "not in the entries map"
fi

section "2. The DENY patterns the compound cases exercised are in the payload"
for needle in "Bash(rm -rf /)" "Bash(rm -rf ~)" "Bash(mv /* /dev/null)" "Bash(chmod -R 777 *)"; do
  if grep -qF "$needle" "$PAYLOAD"; then ok "payload carries $needle"; else bad "payload lost $needle"; fi
done

section "3. The native layer has a gate that fails loudly"
if [[ -f "$PROBE" ]]; then ok "canary probe present"; else bad "canary probe missing"; fi
if grep -q "probe-permission-deny.sh" "$PROJECT_ROOT/.github/workflows/plugin-validation.yml"; then ok "canary probe wired into CI"; else bad "canary probe not invoked by any workflow"; fi

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ "$FAIL" -eq 0 ]]
