#!/usr/bin/env bash
# Round-trip test for the sync_versions function in scripts/stamp-counts.sh
# (introduced in #1407, Lane 2).
#
# The function reads package.json's version and propagates it to:
#   - pyproject.toml
#   - manifests/ork.json
#   - .claude-plugin/marketplace.json (top-level + plugins[0].version)
#   - .release-please-manifest.json
#   - CLAUDE.md ("**Current**: X.Y.Z" line)
#
# This test pins that behavior: bump, sync, assert.
#
# ─── WHY THIS RUNS IN A SANDBOX ─────────────────────────────────────────
# It used to write FAKE_VER="999.888.777" into the LIVE working tree and rely
# on an EXIT trap to put the real version back. For the duration of the run,
# seven tracked files (package.json, pyproject.toml, manifests/ork.json,
# .claude-plugin/marketplace.json, .release-please-manifest.json, CLAUDE.md)
# carried a fake version. Consequences, all observed or reasoned from real
# incidents:
#
#   - Any concurrent session reading or committing during the window saw
#     999.888.777. Multiple Claude sessions on one machine is normal here.
#   - `kill -9`, a full disk, or a crashed shell skips the trap entirely and
#     leaves the repo corrupted with no warning.
#   - It made `npm test` unsafe to run at all while anyone else was working,
#     which is what blocked reproducing #3263.
#
# A test that can corrupt the tree it is testing is not worth the coverage.
# The round-trip now happens inside a throwaway copy of the tracked files, so
# the live tree is never written to and there is nothing to restore. Killing
# this test at any moment leaves a temp directory behind, not a broken repo.
#
# The copy is made from the WORKING TREE (`git ls-files` + tar), not from HEAD,
# so an uncommitted edit to scripts/stamp-counts.sh is what actually gets
# tested. Copying from HEAD would silently test the committed script and tell a
# developer their change passed when it was never run.
#
# Part of Road to 10 — Wave 2 PR-T2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
NC=$'\033[0m'

PASS=0
FAIL=0

pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

read_versions() { # read_versions <root> -> prints "key=value" lines
  local r="$1"
  echo "package=$(jq -r '.version' "$r/package.json")"
  echo "pyproject=$(grep -E '^version\s*=' "$r/pyproject.toml" | sed -E 's/.*"([^"]*)".*/\1/')"
  echo "manifest=$(jq -r '.version' "$r/manifests/ork.json")"
  echo "market-top=$(jq -r '.version' "$r/.claude-plugin/marketplace.json")"
  echo "market-plugin=$(jq -r '.plugins[0].version' "$r/.claude-plugin/marketplace.json")"
  echo "release-please=$(jq -r '.["."]' "$r/.release-please-manifest.json")"
  echo "CLAUDE=$(grep -E '^\- \*\*Current\*\*:' "$r/CLAUDE.md" | sed -E 's/.*Current\*\*: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/' | head -1)"
}

echo "════════════════════════════════════════════════════════════════"
echo "  sync_versions round-trip (Lane 2 #1407) — sandboxed"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ─── Test 0: the LIVE tree is self-consistent (READ-ONLY) ───────────
# This preserves the signal the old pre-flight guard carried. It is now an
# assertion in its own right rather than a precondition for mutating the repo,
# and it never writes anything.
echo "▶ Test 0: live working tree agrees on one version (read-only)"
echo "────────────────────────────────────────────────────────────────"
LIVE_PKG=$(jq -r '.version' package.json)
LIVE_BAD=0
while IFS='=' read -r key value; do
  [[ "$key" == "package" ]] && continue
  if [[ "$value" != "$LIVE_PKG" ]]; then
    fail "live $key shows $value, expected $LIVE_PKG"
    LIVE_BAD=1
  fi
done < <(read_versions "$PROJECT_ROOT")
if [[ $LIVE_BAD -eq 0 ]]; then
  pass "all 7 live files agree at $LIVE_PKG"
else
  echo ""
  echo "  Run \`npm run build\` to reconcile."
fi
echo ""

# ─── Sandbox: a throwaway copy of the tracked working tree ──────────
SANDBOX="$(mktemp -d)"
cleanup() { rm -rf "$SANDBOX"; }
trap cleanup EXIT INT TERM
# NOTE: this trap only removes a temp dir. Nothing in the repo needs restoring,
# which is the entire point of the rewrite.

git ls-files -z | tar --null -T - -cf - | tar -x -C "$SANDBOX"
pass "sandbox built from the working tree ($(find "$SANDBOX" -type f | wc -l | tr -d ' ') files)"
echo ""

ORIG_PKG=$(jq -r '.version' "$SANDBOX/package.json")
FAKE_VER="999.888.777"

# ─── Test 1: bump synthetic version + sync + assert ────────────────
echo "▶ Test 1: sync propagates a bump (inside the sandbox)"
echo "────────────────────────────────────────────────────────────────"

jq --arg v "$FAKE_VER" '.version = $v' "$SANDBOX/package.json" > "$SANDBOX/package.json.tmp"
mv "$SANDBOX/package.json.tmp" "$SANDBOX/package.json"
( cd "$SANDBOX" && bash scripts/stamp-counts.sh >/dev/null )

ALL_MATCHED=1
while IFS='=' read -r key value; do
  [[ "$key" == "package" ]] && continue
  if [[ "$value" == "$FAKE_VER" ]]; then
    pass "$key synced to $FAKE_VER"
  else
    fail "$key stuck at $value (expected $FAKE_VER)"
    ALL_MATCHED=0
  fi
done < <(read_versions "$SANDBOX")

if [[ $ALL_MATCHED -ne 1 ]]; then
  echo ""
  echo "sync_versions failed to propagate. Check scripts/stamp-counts.sh."
  exit 1
fi
echo ""

# ─── Test 2: restore original + assert ──────────────────────────────
echo "▶ Test 2: sync propagates the restoration back"
echo "────────────────────────────────────────────────────────────────"

jq --arg v "$ORIG_PKG" '.version = $v' "$SANDBOX/package.json" > "$SANDBOX/package.json.tmp"
mv "$SANDBOX/package.json.tmp" "$SANDBOX/package.json"
( cd "$SANDBOX" && bash scripts/stamp-counts.sh >/dev/null )

while IFS='=' read -r key value; do
  [[ "$key" == "package" ]] && continue
  if [[ "$value" == "$ORIG_PKG" ]]; then
    pass "$key restored to $ORIG_PKG"
  else
    fail "$key stuck at $value (expected $ORIG_PKG)"
  fi
done < <(read_versions "$SANDBOX")
echo ""

# ─── Test 3: validate-counts.sh agrees with the round-trip ──────────
echo "▶ Test 3: validate-counts.sh accepts the final sandbox state"
echo "────────────────────────────────────────────────────────────────"

if ( cd "$SANDBOX" && bash bin/validate-counts.sh >/dev/null ); then
  pass "validate-counts passes after round-trip"
else
  fail "validate-counts rejects the state after round-trip"
fi
echo ""

# ─── Test 4: the live tree was never written to ─────────────────────
# The guarantee this rewrite exists to provide, asserted rather than assumed.
echo "▶ Test 4: the live working tree is untouched"
echo "────────────────────────────────────────────────────────────────"
LIVE_AFTER=$(jq -r '.version' "$PROJECT_ROOT/package.json")
if [[ "$LIVE_AFTER" == "$LIVE_PKG" ]]; then
  pass "live package.json still $LIVE_PKG (never saw $FAKE_VER)"
else
  fail "live package.json changed: $LIVE_PKG -> $LIVE_AFTER"
fi
if grep -rqF "$FAKE_VER" \
     "$PROJECT_ROOT/package.json" \
     "$PROJECT_ROOT/pyproject.toml" \
     "$PROJECT_ROOT/CLAUDE.md" \
     "$PROJECT_ROOT/manifests/ork.json"; then
  fail "sentinel $FAKE_VER leaked into a live tracked file"
else
  pass "sentinel never appeared in any live tracked file"
fi
echo ""

# ─── Summary ────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1
exit 0
