#!/bin/bash
# Security Tests: file-guard retirement tripwire (was: path and symlink handling)
#
# WHAT THIS FILE USED TO BE
# A contract test for pretool/write-edit/file-guard: protected patterns denied,
# ordinary files abstained, traversal and symlinks resolved before matching
# (the ME-001 / CWE-59 defence), dangling symlinks tolerated.
#
# WHAT IT TESTS NOW (#3835 wave 3, 2026-08-31)
# file-guard was deleted by operator decision. Its opinion re-homed as
# Edit()/Write() deny rules in the OPERATOR's settings scope, delivered by
# skills/setup (phase 3.6) and audited by skills/doctor. CC resolves the target
# path itself before matching a deny rule, so the traversal/symlink concern is
# CC's, and it is gated in CI by the canary probe
# tests/ci/restricted-smoke/probe-permission-deny.sh (REGRESSED on failure).
#
# This file is the #3807-shaped tripwire: it asserts the hook is GONE and that
# the assumption which made removing it safe still holds (the payload carries
# every pattern the hook used to deny). A revived hook, or a payload that lost
# a pattern, fails here.
#
# Priority: HIGH
# Reference: OWASP A01/A02, CWE-22, CWE-59

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
PASS=0; FAIL=0
section()  { echo; echo "${YELLOW}$1${NC}"; }
ok()  { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
bad() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

GUARD_TS="$PROJECT_ROOT/src/hooks/src/pretool/write-edit/file-guard.ts"
PAYLOAD="$PROJECT_ROOT/src/skills/setup/references/operator-permissions.json"
PROBE="$PROJECT_ROOT/tests/ci/restricted-smoke/probe-permission-deny.sh"

section "1. The hook is retired"
if [[ ! -e "$GUARD_TS" ]]; then ok "file-guard.ts absent"; else bad "file-guard.ts revived at $GUARD_TS"; fi
if grep -q "pretool/write-edit/file-guard" "$PROJECT_ROOT/src/hooks/src/entries/pretool.ts"; then
  bad "file-guard still registered in entries/pretool.ts"
else
  ok "file-guard not in the entries map"
fi

section "2. Every pattern file-guard denied is a native deny rule in the payload"
# file-guard.ts PROTECTED_PATTERNS at deletion: .env, .env.local, .env.production,
# credentials.json, secrets.json, private.key, *.pem, id_rsa, id_ed25519, .husky/
for needle in '.env)' '.env.local)' '.env.production)' 'credentials.json)' 'secrets.json)' 'private.key)' '*.pem)' 'id_rsa)' 'id_ed25519)' '.husky/**)'; do
  if grep -qF "Write(**/$needle" "$PAYLOAD" && grep -qF "Edit(**/$needle" "$PAYLOAD"; then
    ok "payload carries Edit+Write deny for $needle"
  else
    bad "payload lost the rule for $needle (file-guard's opinion went unguarded)"
  fi
done

section "3. The native layer has a gate that fails loudly"
if [[ -x "$PROBE" || -f "$PROBE" ]]; then ok "canary probe present: ${PROBE#$PROJECT_ROOT/}"; else bad "canary probe missing; the deletion has no watchdog"; fi
if grep -q "probe-permission-deny.sh" "$PROJECT_ROOT/.github/workflows/plugin-validation.yml"; then
  ok "canary probe wired into CI"
else
  bad "canary probe not invoked by any workflow"
fi

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ "$FAIL" -eq 0 ]]
