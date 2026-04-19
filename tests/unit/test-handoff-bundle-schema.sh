#!/usr/bin/env bash
# Exercises scripts/validate-handoff-bundle.mjs with fixture bundles built
# on the fly so we never commit binary .tar.gz files to the repo.
#
# What this pins:
#   - A complete bundle (README + chats + project/*.html) validates 0
#   - An incomplete bundle (no project/) still validates 0 (expected)
#   - Missing README.md → exit 1
#   - Missing chats/ → exit 1
#   - Empty chats/ dir → exit 1
#   - Non-tar.gz input → exit 1 or 2
#
# Part of Road to 10 — Wave 2 PR-T4.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALIDATOR="$PROJECT_ROOT/scripts/validate-handoff-bundle.mjs"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
NC=$'\033[0m'

PASS=0
FAIL=0

pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

# ─── sandbox for all fixtures ────────────────────────────────────────
SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

# Helper: build a bundle from a directory, return path to .tar.gz
build_bundle() {
  local src_dir="$1"
  local out="$2"
  (cd "$(dirname "$src_dir")" && tar -czf "$out" "$(basename "$src_dir")")
}

# Helper: assert exit code
assert_exit() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label (exit $actual)"
  else
    fail "$label (expected exit $expected, got $actual)"
  fi
}

echo "════════════════════════════════════════════════════════════════"
echo "  Handoff bundle schema validator (Road to 10 — PR-T4)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Pre-flight
if [[ ! -f "$VALIDATOR" ]]; then
  fail "Validator script not found: $VALIDATOR"
  exit 1
fi

# ─── Fixture 1: COMPLETE bundle (README + chats + project/*.html) ───
echo "▶ Fixture 1: complete bundle"
FIX1="$SANDBOX/complete"
mkdir -p "$FIX1/bundle1/chats" "$FIX1/bundle1/project"
cat > "$FIX1/bundle1/README.md" <<'EOF'
# CODING AGENTS: READ THIS FIRST

This is a handoff bundle from Claude Design (claude.ai/design).
EOF
echo "Chat transcript content" > "$FIX1/bundle1/chats/chat1.md"
cat > "$FIX1/bundle1/project/Landing.html" <<'EOF'
<!doctype html><html><body><h1>Mock prototype</h1></body></html>
EOF
build_bundle "$FIX1/bundle1" "$SANDBOX/complete.tar.gz"
set +e
node "$VALIDATOR" "$SANDBOX/complete.tar.gz" >/dev/null 2>&1
EC=$?
set -e
assert_exit 0 $EC "complete bundle validates (exit 0)"
echo ""

# ─── Fixture 2: INCOMPLETE bundle (no project/) — still valid ───────
echo "▶ Fixture 2: incomplete bundle (assistant waiting for clarification)"
FIX2="$SANDBOX/incomplete"
mkdir -p "$FIX2/bundle2/chats"
cat > "$FIX2/bundle2/README.md" <<'EOF'
# CODING AGENTS: READ THIS FIRST

Claude Design handoff bundle. claude.ai/design
EOF
echo "Assistant asked for clarification; no designs yet" > "$FIX2/bundle2/chats/chat1.md"
build_bundle "$FIX2/bundle2" "$SANDBOX/incomplete.tar.gz"
set +e
node "$VALIDATOR" "$SANDBOX/incomplete.tar.gz" >/dev/null 2>&1
EC=$?
set -e
assert_exit 0 $EC "incomplete bundle validates (exit 0 — expected)"
echo ""

# ─── Fixture 3: missing README.md → invalid ─────────────────────────
echo "▶ Fixture 3: missing README.md"
FIX3="$SANDBOX/no-readme"
mkdir -p "$FIX3/bundle3/chats"
echo "chat" > "$FIX3/bundle3/chats/chat1.md"
build_bundle "$FIX3/bundle3" "$SANDBOX/no-readme.tar.gz"
set +e
node "$VALIDATOR" "$SANDBOX/no-readme.tar.gz" >/dev/null 2>&1
EC=$?
set -e
assert_exit 1 $EC "missing README.md → exit 1"
echo ""

# ─── Fixture 4: missing chats/ → invalid ────────────────────────────
echo "▶ Fixture 4: missing chats/ directory"
FIX4="$SANDBOX/no-chats"
mkdir -p "$FIX4/bundle4"
cat > "$FIX4/bundle4/README.md" <<'EOF'
CODING AGENTS — handoff bundle
EOF
build_bundle "$FIX4/bundle4" "$SANDBOX/no-chats.tar.gz"
set +e
node "$VALIDATOR" "$SANDBOX/no-chats.tar.gz" >/dev/null 2>&1
EC=$?
set -e
assert_exit 1 $EC "missing chats/ → exit 1"
echo ""

# ─── Fixture 5: empty chats/ → invalid ──────────────────────────────
echo "▶ Fixture 5: empty chats/ directory"
FIX5="$SANDBOX/empty-chats"
mkdir -p "$FIX5/bundle5/chats"
cat > "$FIX5/bundle5/README.md" <<'EOF'
CODING AGENTS — handoff bundle
EOF
build_bundle "$FIX5/bundle5" "$SANDBOX/empty-chats.tar.gz"
set +e
node "$VALIDATOR" "$SANDBOX/empty-chats.tar.gz" >/dev/null 2>&1
EC=$?
set -e
assert_exit 1 $EC "empty chats/ → exit 1"
echo ""

# ─── Fixture 6: non-tarball input → invalid (exit 1 or 2) ───────────
echo "▶ Fixture 6: non-tarball input"
echo "just plain text, not a tar.gz" > "$SANDBOX/not-a-tarball.txt"
set +e
node "$VALIDATOR" "$SANDBOX/not-a-tarball.txt" >/dev/null 2>&1
EC=$?
set -e
if [[ "$EC" == "1" || "$EC" == "2" ]]; then
  pass "non-tarball rejected (exit $EC — either 1 or 2 is acceptable)"
else
  fail "non-tarball should have been rejected, got exit $EC"
fi
echo ""

# ─── Fixture 7: missing input path → exit 2 (tool error) ────────────
echo "▶ Fixture 7: missing input path"
set +e
node "$VALIDATOR" "$SANDBOX/does-not-exist.tar.gz" >/dev/null 2>&1
EC=$?
set -e
assert_exit 2 $EC "missing input → exit 2 (tool/IO error)"
echo ""

# ─── Summary ────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1
exit 0
