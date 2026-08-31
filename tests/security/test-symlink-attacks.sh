#!/bin/bash
# Security Tests: symlink resolution (CWE-59), file-guard retirement note
#
# WHAT THIS FILE USED TO BE
# It proved file-guard resolved an INTERMEDIATE-component symlink before
# matching its /\/\.husky\// directory pattern (a symlinked dir onto .husky
# was denied by the resolved path), with a control showing a symlinked dir to
# an unprotected target abstained, and an ELOOP cycle did not crash the hook.
#
# WHAT IT TESTS NOW (#3835 wave 3, 2026-08-31)
# file-guard was deleted by operator decision; the .husky/ opinion is an
# Edit()/Write() deny rule in the operator scope. Path resolution before rule
# matching is CC's own behaviour and is gated by the CI canary probe. This file
# keeps the CWE-59 concern visible as a tripwire: the hook must stay gone and
# the .husky rule must stay in the payload. If a future hook re-introduces its
# own symlink handling, the full contract this file used to carry is in git
# history at the commit before #3835 wave 3.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; NC=$'\033[0m'
PASS=0; FAIL=0
ok()  { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
bad() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

echo "=========================================="
echo "  symlink resolution (CWE-59): tripwire"
echo "=========================================="

if [[ ! -e "$PROJECT_ROOT/src/hooks/src/pretool/write-edit/file-guard.ts" ]]; then
  ok "file-guard retired"
else
  bad "file-guard revived; restore this file's full contract from git history"
fi
if grep -qF 'Write(**/.husky/**)' "$PROJECT_ROOT/src/skills/setup/references/operator-permissions.json"; then
  ok ".husky/ opinion lives in the operator payload"
else
  bad ".husky/ deny rule missing from the payload"
fi

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ "$FAIL" -eq 0 ]]
