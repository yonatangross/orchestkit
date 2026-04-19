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
# This test pins that behavior: bump, sync, assert all synced, restore.
#
# Part of Road to 10 — Wave 2 PR-T2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

PASS=0
FAIL=0

pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

echo "════════════════════════════════════════════════════════════════"
echo "  sync_versions round-trip (Lane 2 #1407)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ─── Pre-flight: capture original versions so we can restore everything ─
ORIG_PKG=$(jq -r '.version' package.json)
ORIG_PYPROJ=$(grep -E '^version\s*=' pyproject.toml | sed -E 's/.*"([^"]*)".*/\1/')
ORIG_MANIFEST=$(jq -r '.version' manifests/ork.json)
ORIG_MARKET_TOP=$(jq -r '.version' .claude-plugin/marketplace.json)
ORIG_MARKET_PLUGIN=$(jq -r '.plugins[0].version' .claude-plugin/marketplace.json)
ORIG_RP=$(jq -r '.["."]' .release-please-manifest.json)
ORIG_CLAUDE=$(grep -E '^\- \*\*Current\*\*:' CLAUDE.md | sed -E 's/.*Current\*\*: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/' | head -1)

echo "Original version:     $ORIG_PKG"
echo ""

# Guard: refuse to run if any file is already mismatched — we need a
# clean baseline so a post-test restoration leaves the repo pristine.
for pair in "pyproject:$ORIG_PYPROJ" "manifest:$ORIG_MANIFEST" "market-top:$ORIG_MARKET_TOP" "market-plugin:$ORIG_MARKET_PLUGIN" "release-please:$ORIG_RP" "CLAUDE:$ORIG_CLAUDE"; do
  IFS=: read -r label value <<<"$pair"
  if [[ "$value" != "$ORIG_PKG" ]]; then
    fail "Pre-flight: $label shows $value, expected $ORIG_PKG — repo is in a mismatched state before the test"
    echo ""
    echo "Run \`npm run build\` to reconcile, then retry."
    exit 1
  fi
done
pass "Pre-flight: all 7 files match at $ORIG_PKG"
echo ""

# ─── Always restore, even on failure or interrupt ──────────────────
cleanup() {
  local ec=$?
  echo ""
  echo "─── restoring original version $ORIG_PKG ──────────────────────────"
  jq --arg v "$ORIG_PKG" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
  bash scripts/stamp-counts.sh >/dev/null 2>&1 || true
  exit $ec
}
trap cleanup EXIT INT TERM

# ─── Test 1: bump synthetic version + sync + assert ────────────────
FAKE_VER="999.888.777"
echo "▶ Test 1: sync propagates a bump"
echo "────────────────────────────────────────────────────────────────"

jq --arg v "$FAKE_VER" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
bash scripts/stamp-counts.sh >/dev/null 2>&1

# Assert each sibling now shows FAKE_VER
declare -A POST
POST[pyproject]=$(grep -E '^version\s*=' pyproject.toml | sed -E 's/.*"([^"]*)".*/\1/')
POST[manifest]=$(jq -r '.version' manifests/ork.json)
POST[market-top]=$(jq -r '.version' .claude-plugin/marketplace.json)
POST[market-plugin]=$(jq -r '.plugins[0].version' .claude-plugin/marketplace.json)
POST[release-please]=$(jq -r '.["."]' .release-please-manifest.json)
POST[CLAUDE]=$(grep -E '^\- \*\*Current\*\*:' CLAUDE.md | sed -E 's/.*Current\*\*: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/' | head -1)

ALL_MATCHED=1
for key in pyproject manifest market-top market-plugin release-please CLAUDE; do
  if [[ "${POST[$key]}" == "$FAKE_VER" ]]; then
    pass "$key synced to $FAKE_VER"
  else
    fail "$key stuck at ${POST[$key]} (expected $FAKE_VER)"
    ALL_MATCHED=0
  fi
done

if [[ $ALL_MATCHED -ne 1 ]]; then
  echo ""
  echo "sync_versions failed to propagate. Check scripts/stamp-counts.sh."
  exit 1
fi
echo ""

# ─── Test 2: restore original + assert ──────────────────────────────
echo "▶ Test 2: sync propagates the restoration back"
echo "────────────────────────────────────────────────────────────────"

jq --arg v "$ORIG_PKG" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
bash scripts/stamp-counts.sh >/dev/null 2>&1

declare -A RESTORED
RESTORED[pyproject]=$(grep -E '^version\s*=' pyproject.toml | sed -E 's/.*"([^"]*)".*/\1/')
RESTORED[manifest]=$(jq -r '.version' manifests/ork.json)
RESTORED[market-top]=$(jq -r '.version' .claude-plugin/marketplace.json)
RESTORED[market-plugin]=$(jq -r '.plugins[0].version' .claude-plugin/marketplace.json)
RESTORED[release-please]=$(jq -r '.["."]' .release-please-manifest.json)
RESTORED[CLAUDE]=$(grep -E '^\- \*\*Current\*\*:' CLAUDE.md | sed -E 's/.*Current\*\*: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/' | head -1)

for key in pyproject manifest market-top market-plugin release-please CLAUDE; do
  if [[ "${RESTORED[$key]}" == "$ORIG_PKG" ]]; then
    pass "$key restored to $ORIG_PKG"
  else
    fail "$key stuck at ${RESTORED[$key]} (expected $ORIG_PKG)"
  fi
done
echo ""

# ─── Test 3: validate-counts.sh agrees with the round-trip ──────────
echo "▶ Test 3: validate-counts.sh accepts the final state"
echo "────────────────────────────────────────────────────────────────"

if bash bin/validate-counts.sh >/dev/null 2>&1; then
  pass "validate-counts passes after round-trip"
else
  fail "validate-counts rejects the state after round-trip"
fi
echo ""

# ─── Summary ────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1
exit 0
