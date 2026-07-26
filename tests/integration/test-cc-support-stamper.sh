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
# Every stamp target must be snapshotted, or a bumped-floor test run leaves
# fixture values (2.1.999) in the working tree — README.md was missing here
# long before the docs target existed.
ORIG_README=$(cat README.md)
ORIG_TROUBLESHOOTING=$(cat docs/site/content/docs/troubleshooting/index.mdx)

# Stamp target #6 (added 2026-07-25): the `compatibility:` floor in all 114
# src/skills/*/SKILL.md files. Without snapshotting these, a bumped-floor test
# below leaves 114 files reading "Claude Code 2.1.999+" in the working tree, and
# the very next test (test-cc-version-floor.sh) then reports the stamper as
# non-idempotent with 114 pending mutations.
#
# Snapshotted as byte-exact file copies rather than by replaying just the
# compatibility line: 7 of the 114 SKILL.md files have no trailing newline, and a
# line-oriented rewrite (awk/sed) silently adds one. That normalization shows up
# as 7 spuriously dirty files, and trailing-newline state is load-bearing here —
# see tests/skills/test-skill-length.sh, which documents that `wc -l` under-counts
# a file missing its final newline.
COMPAT_BACKUP_DIR=$(mktemp -d)
for skill_md in src/skills/*/SKILL.md; do
    [ -f "$skill_md" ] || continue
    mkdir -p "$COMPAT_BACKUP_DIR/$(dirname "$skill_md")"
    cp -p "$skill_md" "$COMPAT_BACKUP_DIR/$skill_md"
done

# Extract the current MIN_CC_VERSION value so monotonic-guard assertions stay
# resilient to floor bumps (was hardcoded "2.1.122" pre-M131).
ORIG_FLOOR=$(printf '%s' "$ORIG_MATRIX" | grep -oE "MIN_CC_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
if [ -z "$ORIG_FLOOR" ]; then
  echo "FATAL: could not extract MIN_CC_VERSION from cc-version-matrix.ts" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Restore set, DERIVED from the stamper rather than hand-maintained.
#
# The hand-written list above drifted twice: README.md was missing until it bit
# someone, and `.claude-plugin/marketplace.json` (stamp target #5, the
# machine-readable install gate CC reads to decide whether ork can be
# installed at all) was still missing on 2026-07-26 — a full test run left
# `"engine": ">=2.1.999"` in the working tree, one `git add -A` away from
# shipping an uninstallable plugin.
#
# Root cause was maintaining the restore set in a SECOND place. It is now read
# out of the stamper's own `stamp('<path>')` call sites, so a new stamp target
# is covered the moment it is added. Byte-exact `cp -p` throughout: 7 of the
# SKILL.md files have no trailing newline and `echo "$VAR" > file` silently
# adds one.
# ---------------------------------------------------------------------------
STAMPER_SRC="scripts/stamp-cc-support.mjs"
BACKUP_DIR=$(mktemp -d)

# `while read` rather than `mapfile`: this script's shebang is /bin/bash, which
# on macOS is bash 3.2 where mapfile does not exist. A mapfile version passes
# Linux CI and breaks every local run — precisely the silent-divergence shape
# this rewrite exists to kill.
STAMP_TARGETS=()
while IFS= read -r target; do
  [ -n "$target" ] && STAMP_TARGETS+=("$target")
done < <(grep -oE "^stamp\('[^']+'" "$STAMPER_SRC" | sed "s/^stamp('//; s/'$//")
if [ "${#STAMP_TARGETS[@]}" -eq 0 ]; then
  echo "FATAL: derived zero stamp targets from $STAMPER_SRC — parser drifted" >&2
  exit 1
fi
# shared/cc-support.json is the source of truth the tests mutate directly; it is
# not a stamp() target, so it is appended explicitly.
STAMP_TARGETS+=("shared/cc-support.json")
for skill_md in src/skills/*/SKILL.md; do
  [ -f "$skill_md" ] && STAMP_TARGETS+=("$skill_md")
done

for f in "${STAMP_TARGETS[@]}"; do
  [ -f "$f" ] || continue
  mkdir -p "$BACKUP_DIR/$(dirname "$f")"
  cp -p "$f" "$BACKUP_DIR/$f"
done

restore() {
  for f in "${STAMP_TARGETS[@]}"; do
    [ -f "$BACKUP_DIR/$f" ] || continue
    cp -p "$BACKUP_DIR/$f" "$f"
  done
  rm -rf "$BACKUP_DIR"
  if [ -d "$COMPAT_BACKUP_DIR" ]; then
    rm -rf "$COMPAT_BACKUP_DIR"
  fi

  # Post-condition: prove the restore actually worked. Any stamp target still
  # holding a fixture version means a leak, and a leak must be LOUD — the whole
  # point of this rewrite is that the previous failure mode was silent.
  local leaked=0
  for f in "${STAMP_TARGETS[@]}"; do
    [ -f "$f" ] || continue
    if grep -qE '2\.1\.999|"2\.2\.0"' "$f"; then
      echo "LEAK: $f still contains a test fixture version after restore" >&2
      leaked=1
    fi
  done
  if [ "$leaked" -eq 1 ]; then
    echo "FATAL: test fixture leaked into the working tree — do not commit." >&2
    exit 1
  fi
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
# latest_known is set to a distinct value (2.2.0) to prove it stamps LATEST_KNOWN_CC
# independently of the floor (they diverge while a manual_override freezes the floor).
jq '.supported_floor = "2.1.999" | .latest_known = "2.2.0"' shared/cc-support.json > shared/cc-support.json.tmp
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

if grep -q "LATEST_KNOWN_CC = '2.2.0'" src/hooks/src/lib/cc-version-matrix.ts; then
  log_pass "cc-version-matrix.ts LATEST_KNOWN_CC updated (independent of floor)"
else
  log_fail "cc-version-matrix.ts LATEST_KNOWN_CC propagation" "expected LATEST_KNOWN_CC = '2.2.0'"
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
