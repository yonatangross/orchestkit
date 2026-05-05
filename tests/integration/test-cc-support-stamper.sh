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

# Extract the current MIN_CC_VERSION value so monotonic-guard assertions stay
# resilient to floor bumps (was hardcoded "2.1.122" pre-M131).
ORIG_FLOOR=$(printf '%s' "$ORIG_MATRIX" | grep -oE "MIN_CC_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
if [ -z "$ORIG_FLOOR" ]; then
  echo "FATAL: could not extract MIN_CC_VERSION from cc-version-matrix.ts" >&2
  exit 1
fi

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
# Test 4: monotonic guard — refuse to LOWER MIN_CC_VERSION below current.
# Restore originals first (Test 2 left matrix at 2.1.999), then attempt to
# downgrade via SoT and verify stamper exits non-zero.
# ============================================================================
echo "$ORIG_MATRIX" > src/hooks/src/lib/cc-version-matrix.ts
echo "$ORIG_CLAUDE_MD" > CLAUDE.md
echo "$ORIG_DOC" > src/skills/doctor/references/version-compatibility.md
# Force SoT to a value strictly below the current MIN_CC_VERSION ($ORIG_FLOOR).
jq '.supported_floor = "2.1.100"' shared/cc-support.json > shared/cc-support.json.tmp
mv shared/cc-support.json.tmp shared/cc-support.json

if node scripts/stamp-cc-support.mjs > /tmp/stamp-out.txt 2>&1; then
  log_fail "Monotonic guard" "stamper exited 0 when asked to lower floor $ORIG_FLOOR → 2.1.100"
else
  if grep -q "refusing to lower MIN_CC_VERSION" /tmp/stamp-out.txt; then
    log_pass "Monotonic guard: stamper refuses to lower MIN_CC_VERSION"
  else
    log_fail "Monotonic guard error message" "expected 'refusing to lower MIN_CC_VERSION', got: $(cat /tmp/stamp-out.txt)"
  fi
fi

# Verify nothing was written despite the failure.
if grep -q "MIN_CC_VERSION = '$ORIG_FLOOR'" src/hooks/src/lib/cc-version-matrix.ts; then
  log_pass "Monotonic guard: matrix.ts left untouched after refusal"
else
  log_fail "Monotonic guard atomicity" "matrix.ts was modified despite stamper rejection (expected $ORIG_FLOOR)"
fi

# ============================================================================
# Test 5: duplicate MIN_CC_VERSION assignment fails fast — defensive check
# against future refactors that might split the constant in two.
# ============================================================================
# Inject a second assignment that matches the locator regex.
echo "$ORIG_MATRIX" > src/hooks/src/lib/cc-version-matrix.ts
printf "\nexport const MIN_CC_VERSION = '2.1.0';\n" >> src/hooks/src/lib/cc-version-matrix.ts
# Restore the SoT to match current to avoid confusing the monotonic check.
echo "$ORIG_SUPPORT" > shared/cc-support.json

if node scripts/stamp-cc-support.mjs > /tmp/stamp-out.txt 2>&1; then
  log_fail "Duplicate assignment guard" "stamper exited 0 with two MIN_CC_VERSION assignments"
else
  if grep -qE "(refusing to stamp ambiguously|MIN_CC_VERSION assignments found)" /tmp/stamp-out.txt; then
    log_pass "Duplicate assignment guard: stamper refuses ambiguous source"
  else
    log_fail "Duplicate assignment message" "expected ambiguity error, got: $(cat /tmp/stamp-out.txt)"
  fi
fi

# Restore originals before next test.
echo "$ORIG_MATRIX" > src/hooks/src/lib/cc-version-matrix.ts
echo "$ORIG_SUPPORT" > shared/cc-support.json

# ============================================================================
# Test 6: missing cc-support.json fails fast
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
