#!/bin/bash
# Security Tests: file-guard path and symlink handling
#
# Priority: CRITICAL
# Reference: OWASP Path Traversal, CWE-22, CWE-59 (symlink following)
#
# =============================================================================
# WHAT THIS FILE USED TO BE
# =============================================================================
# Every test here called `pretool/input-mod/path-normalizer.sh` and
# `pretool/write-edit/file-guard.sh` through run_hook_capture. Neither path has
# existed since the TypeScript hook migration, so run_hook returned 127, the
# `if [[ $HOOK_EXIT_CODE -eq 0 ]]` branch never ran, and every function ended in
# an unconditional `return 0`. 7 of 8 functions could not fail. The suite passed
# BECAUSE the hooks were gone.
#
# path-normalizer was consolidated away (commit e844b4b25, "consolidate to 24
# hooks"); its path resolution now lives inside file-guard.ts:153
# (resolveRealPath). So file-guard is the correct target for both concerns.
#
# =============================================================================
# WHAT IT TESTS NOW: file-guard's ACTUAL contract
# =============================================================================
# From file-guard.ts:1-8 and its PROTECTED_PATTERNS at :128 —
#
#   "Protects sensitive files from modification"
#   "Resolves symlinks before checking patterns (ME-001 fix) to prevent
#    symlink-based bypasses of file protection"
#
# It is NOT a general outside-the-project blocker. Writing to /etc/passwd is
# ALLOWED by this hook (the OS and CC's own permission layer gate that), and
# asserting otherwise would be inventing a contract the code never claimed.
# Measured before writing these assertions, not assumed.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

GUARD="pretool/write-edit/file-guard"
PASS=0
FAIL=0

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
log_pass() { echo "  ${GREEN}✓${NC} $1"; }
log_fail() { echo "  ${RED}✗${NC} $1"; }
section()  { echo; echo "${YELLOW}$1${NC}"; }

write_input() { jq -n --arg p "$1" '{tool_name:"Write",tool_input:{file_path:$p,content:"x"}}'; }

expect_write() { # expect_write <deny|allow> <path> <label>
  expect_decision "$1" "$GUARD" "$(write_input "$2")" "$3"
}

echo "=========================================="
echo "  file-guard: path + symlink protection"
echo "=========================================="

# The hook must be reachable. Without this, a renamed key would make every
# "allow" assertion below pass against a hook that never ran — which is exactly
# how this file went blind for months.
if ! assert_hook_registered "$GUARD"; then
  echo "${RED}✗ $GUARD is not registered — aborting rather than reporting green${NC}"
  exit 1
fi

section "1. Protected patterns are denied (file-guard.ts:128)"
expect_write deny ".env"                        "deny .env"
expect_write deny ".env.local"                  "deny .env.local"
expect_write deny ".env.production"             "deny .env.production"
expect_write deny "config/server.pem"           "deny .pem private key"
expect_write deny "$HOME/.ssh/id_rsa"           "deny id_rsa"

section "2. Ordinary files are untouched (no false positives)"
# file-guard abstains on unprotected paths — it emits no permissionDecision and
# the write falls through to the normal permission flow. It never affirmatively
# allows, which would auto-approve the write.
expect_write abstain "src/index.ts"             "ordinary source file"
expect_write abstain "README.md"                "markdown"
expect_write abstain ".envrc"                   ".envrc (not .env)"
expect_write abstain "docs/environment.md"      "filename merely containing 'environment'"

section "3. Traversal cannot reach a protected file"
# The concern is not '..' itself but whether a traversal-built path that RESOLVES
# onto a protected name still gets caught.
expect_write deny "src/../.env"                 "traversal resolving onto .env"
expect_write deny "a/b/../../.env.local"        "multi-hop traversal onto .env.local"

section "4. Symlink bypass — the ME-001 defence (CWE-59)"
# file-guard.ts:1-8 claims it resolves symlinks BEFORE pattern-matching. Nothing
# in the suite exercised that claim, so it was documentation rather than a
# tested behaviour. A symlink pointing at a protected file must be denied on the
# basis of its TARGET, not its innocuous-looking name.
TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT
printf 'SECRET=1\n' > "$TMPD/.env"
ln -s "$TMPD/.env" "$TMPD/harmless-name.txt"

expect_write deny "$TMPD/harmless-name.txt"     "symlink to .env denied by TARGET, not name"
expect_write deny "$TMPD/.env"                  "the real .env still denied"

section "5. A broken symlink must not crash the hook"
ln -s "$TMPD/does-not-exist" "$TMPD/dangling.txt"
got="$(hook_decision "$GUARD" "$(write_input "$TMPD/dangling.txt")")"
if [[ "$got" == "ERROR" ]]; then
  log_fail "dangling symlink produced ERROR (hook crashed or was unreachable)"
  FAIL=$((FAIL + 1))
else
  log_pass "dangling symlink handled without crashing (-> $got)"
  PASS=$((PASS + 1))
fi

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ $FAIL -eq 0 ]]
