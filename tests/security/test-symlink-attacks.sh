#!/bin/bash
# Security Tests: symlink resolution in file-guard (CWE-59)
#
# Priority: HIGH
# Reference: CWE-59 (Link Following), OWASP Path Traversal
#
# =============================================================================
# WHAT THIS FILE USED TO BE
# =============================================================================
# 427 lines, ZERO hook invocations. It defined is_symlink(), safe_read_file(),
# safe_write_file(), resolve_safe_path(), safe_atomic_operation(),
# handle_dangling_symlink() and create_safe_temp_file() INSIDE the test file,
# then asserted that its own definitions behaved as written. Nine "attack"
# sections tested `[ -L ]`, `ls -i`, `stat` and `mktemp`, i.e. bash builtins
# and coreutils, not OrchestKit. No production code could have broken any of it.
#
# Of the nine classes, seven were reimplementation or are now covered by
# tests/security/test-path-traversal.sh (leaf symlink onto .env, dangling
# symlink). What survives is the one class path-traversal does NOT reach.
#
# =============================================================================
# WHAT IT TESTS NOW: symlink resolution on an INTERMEDIATE path component
# =============================================================================
# file-guard.ts:153 resolveRealPath() calls realpathSync on the whole path, so
# resolution applies to every component, not just the leaf. test-path-traversal
# only ever symlinks the LEAF (harmless-name.txt -> .env), which the filename
# patterns would arguably catch anyway once resolved.
#
# The case only realpath can catch is a symlinked DIRECTORY combined with the
# one directory-scoped pattern, /\/\.husky\//  (file-guard.ts:137):
#
#     hooksdir -> .husky        write to  hooksdir/pre-commit
#
# The literal path contains no "/.husky/" anywhere. If resolveRealPath were
# removed, or narrowed to leaf-only, this write would be ALLOWED and the git
# hooks would be tamperable, the exact bypass the ME-001 fix exists to stop.
# Every decision below was measured against the live hook before being asserted.
#
# NOT asserted here, deliberately: hardlinks. Measured: a hardlink named
# harmless.txt pointing at the same inode as .env is ALLOWED, because realpath
# cannot see hardlinks. That is a structural limit of path-pattern protection,
# reported rather than frozen into a green checkmark.
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
echo "  file-guard: symlink resolution (CWE-59)"
echo "=========================================="

# An unregistered key returns {"continue":true} with no permissionDecision,
# which reads as "allow". Without this check a renamed hook would turn the
# control assertion below green while every deny assertion went red for the
# wrong reason.
if ! assert_hook_registered "$GUARD"; then
  echo "${RED}✗ $GUARD is not registered, aborting rather than reporting green${NC}"
  exit 1
fi

TMPD="$(mktemp -d)"
# Chain, do not replace: a bare `trap ... EXIT` OVERWRITES the helper's
# `trap cleanup_test_env EXIT` (test-helpers.sh), leaking the per-process
# temp dir on every run.
trap 'rm -rf "$TMPD"; cleanup_test_env' EXIT

mkdir -p "$TMPD/.husky"
printf '#!/bin/sh\n' > "$TMPD/.husky/pre-commit"
ln -s "$TMPD/.husky" "$TMPD/hooksdir"

mkdir -p "$TMPD/plain"
printf 'x\n' > "$TMPD/plain/pre-commit"
ln -s "$TMPD/plain" "$TMPD/plainlink"

section "1. Baseline: the directory pattern fires on a literal path"
expect_write deny  "$TMPD/.husky/pre-commit"      "literal .husky/pre-commit denied"

section "2. Intermediate-component symlink cannot launder a protected directory"
# The assertion that carries this file. Literal path has no '/.husky/' in it.
expect_write deny  "$TMPD/hooksdir/pre-commit"    "symlinked dir onto .husky denied by RESOLVED path"

section "3. Control: a symlinked directory is not blocked for being a symlink"
# Without this, section 2 would also pass if file-guard denied every path with
# a symlink in it, a much blunter behaviour than the one being claimed.
# `abstain`, not `allow`: the hook stays silent on an unprotected resolved path.
expect_write abstain "$TMPD/plainlink/pre-commit" "symlinked dir to unprotected target"

section "4. A symlink cycle (ELOOP) must not crash the hook"
# Distinct from the dangling-symlink (ENOENT) case in test-path-traversal.sh:
# realpathSync throws a different error class here, and both must land in
# resolveRealPath's catch. A catch narrowed to ENOENT would fail this.
mkdir -p "$TMPD/rec"
ln -s "../rec" "$TMPD/rec/loop"
got="$(hook_decision "$GUARD" "$(write_input "$TMPD/rec/loop/loop/loop/x")")"
if [[ "$got" == "ERROR" ]]; then
  log_fail "symlink cycle produced ERROR (hook crashed or was unreachable)"
  FAIL=$((FAIL + 1))
else
  log_pass "symlink cycle handled without crashing (-> $got)"
  PASS=$((PASS + 1))
fi

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ $FAIL -eq 0 ]]
