#!/bin/bash
# Integration test: stamp-cc-support.mjs propagates shared/cc-support.json correctly.
# Issue: #1488 (M130)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS=0
FAIL=0
log_pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
log_fail() { echo -e "  ${RED}✗${NC} $1 — $2"; FAIL=$((FAIL + 1)); }

echo "CC Support Stamper Tests (M130 #1488)"
echo "====================================="

cd "$PROJECT_ROOT"

ORIG_SUPPORT=$(cat shared/cc-support.json)
ORIG_CLAUDE_MD=$(cat CLAUDE.md)
ORIG_MATRIX=$(cat src/hooks/src/lib/cc-version-matrix.ts)
ORIG_DOC=$(cat src/skills/doctor/references/version-compatibility.md)

restore() {
  echo "$ORIG_SUPPORT" > shared/cc-support.json
  echo "$ORIG_CLAUDE_MD" > CLAUDE.md
  echo "$ORIG_MATRIX" > src/hooks/src/lib/cc-version-matrix.ts
  echo "$ORIG_DOC" > src/skills/doctor/references/version-compatibility.md
}
trap restore EXIT

# ============================================================================
# Test 1: stamper is idempotent — running on synced state mutates 0 files
# ============================================================================
node scripts/stamp-cc-support.mjs > /tmp/stamp-out.txt 2>&1
if grep -q "no changes needed" /tmp/stamp-out.txt; then
  log_pass "Idempotent on already-synced state"
else
  log_fail "Idempotent check" "expected 'no changes needed', got: $(cat /tmp/stamp-out.txt)"
fi

# ============================================================================
# Test 2: changing supported_floor in JSON propagates to all derived files
# ============================================================================
jq '.supported_floor = "2.1.999"' shared/cc-support.json > shared/cc-support.json.tmp
mv shared/cc-support.json.tmp shared/cc-support.json

node scripts/stamp-cc-support.mjs > /tmp/stamp-out.txt 2>&1

if grep -qE "Claude Code\*\*:\s*>=\s*2\.1\.999" CLAUDE.md; then
  log_pass "CLAUDE.md picks up new floor"
else
  log_fail "CLAUDE.md propagation" "expected '>= 2.1.999' in Version section"
fi

if grep -q "MIN_CC_VERSION = '2.1.999'" src/hooks/src/lib/cc-version-matrix.ts; then
  log_pass "cc-version-matrix.ts MIN_CC_VERSION updated"
else
  log_fail "cc-version-matrix.ts propagation" "expected MIN_CC_VERSION = '2.1.999'"
fi

if grep -q "OrchestKit requires Claude Code >= 2.1.999" src/skills/doctor/references/version-compatibility.md; then
  log_pass "version-compatibility.md overview line updated"
else
  log_fail "version-compatibility.md propagation" "expected 'requires Claude Code >= 2.1.999'"
fi

# ============================================================================
# Test 3: invalid floor format rejected with non-zero exit
# ============================================================================
jq '.supported_floor = "invalid-version"' shared/cc-support.json > shared/cc-support.json.tmp
mv shared/cc-support.json.tmp shared/cc-support.json

if node scripts/stamp-cc-support.mjs > /tmp/stamp-out.txt 2>&1; then
  log_fail "Invalid floor rejection" "stamper exited 0 on invalid floor"
else
  if grep -q "invalid supported_floor" /tmp/stamp-out.txt; then
    log_pass "Invalid floor format rejected with explicit error"
  else
    log_fail "Invalid floor error message" "expected 'invalid supported_floor', got: $(cat /tmp/stamp-out.txt)"
  fi
fi

# ============================================================================
# Test 4: missing cc-support.json fails fast
# ============================================================================
mv shared/cc-support.json /tmp/cc-support-backup.json
if node scripts/stamp-cc-support.mjs > /tmp/stamp-out.txt 2>&1; then
  mv /tmp/cc-support-backup.json shared/cc-support.json
  log_fail "Missing-file rejection" "stamper exited 0 with no source file"
else
  mv /tmp/cc-support-backup.json shared/cc-support.json
  if grep -q "missing" /tmp/stamp-out.txt; then
    log_pass "Missing cc-support.json fails fast with clear message"
  else
    log_fail "Missing-file message" "expected 'missing', got: $(cat /tmp/stamp-out.txt)"
  fi
fi

echo ""
echo "====================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "====================================="

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}FAIL${NC}"
  exit 1
fi
echo -e "${GREEN}SUCCESS${NC}"
