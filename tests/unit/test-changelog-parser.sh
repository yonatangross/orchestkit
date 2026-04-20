#!/usr/bin/env bash
# Regression test for scripts/changelog-to-props.mjs
#
# Why this exists: release-please writes CHANGELOG entries with a different
# header format than bin/bump-version.sh. Before PR closing out 7.58.0's
# post-mortem, the parser only recognized the bump-version format and the
# video workflow failed on every release-please release. This test locks both
# formats in so a regression is caught before next release.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PARSER="$PROJECT_ROOT/scripts/changelog-to-props.mjs"
FIXTURE_DIR=$(mktemp -d)
trap 'rm -rf "$FIXTURE_DIR"' EXIT

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
NC=$'\033[0m'

PASS=0
FAIL=0
pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

# ─── Fixture: both header formats in one CHANGELOG ─────────────────
cat > "$FIXTURE_DIR/CHANGELOG.md" <<'EOF'
# Changelog

## [7.58.0](https://github.com/yonatangross/orchestkit/compare/v7.57.1...v7.58.0) (2026-04-20)

### Features

* /ork:expect — Diff-Aware AI Browser Testing (M99) ([#1183](https://github.com/yonatangross/orchestkit/issues/1183)) ([7b88cb7](https://github.com/yonatangross/orchestkit/commit/7b88cb7))
* agent attribution system — viral sub-agent tracking for PRs & commits ([#1194](https://github.com/yonatangross/orchestkit/issues/1194)) ([2de086f](https://github.com/yonatangross/orchestkit/commit/2de086f))

### Bug Fixes

* resolve race in pretool hook ([#1200](https://github.com/yonatangross/orchestkit/issues/1200)) ([abc1234](https://github.com/yonatangross/orchestkit/commit/abc1234))

## [7.57.1] - 2026-04-20

### Fixed

- **Scorecard supply-chain alerts — closed all 11 open code-scanning findings.**

---

## [7.57.0] - 2026-04-19

### Added

- **/ork:example skill** — does a thing.
EOF

# Run parser against the fixture by temporarily overlaying CHANGELOG.md
ORIG_CHANGELOG="$PROJECT_ROOT/CHANGELOG.md"
BACKUP=$(mktemp)
cp "$ORIG_CHANGELOG" "$BACKUP"
trap 'cp "$BACKUP" "$ORIG_CHANGELOG"; rm -f "$BACKUP"; rm -rf "$FIXTURE_DIR"' EXIT

cp "$FIXTURE_DIR/CHANGELOG.md" "$ORIG_CHANGELOG"

echo "════════════════════════════════════════════════════════════════"
echo "  changelog-to-props.mjs parser"
echo "════════════════════════════════════════════════════════════════"

# ─── Test 1: release-please format parses ─────────────────────────
out=$(node "$PARSER" 7.58.0 --landscape 2>&1 || echo "PARSE_FAIL")
if echo "$out" | grep -q '"version": "7.58.0"'; then
  pass "release-please header '## [X.Y.Z](url) (YYYY-MM-DD)' parses"
else
  fail "release-please header did not parse — got: $out"
fi

# Features section maps to "added" category
if echo "$out" | grep -q '"category": "added"'; then
  pass "'### Features' maps to 'added' category"
else
  fail "release-please 'Features' did not map to 'added'"
fi

# Bullet prefix '* ' is recognized
if echo "$out" | grep -q '"title": "/ork:expect"'; then
  pass "'* ' bullets parse (release-please style)"
else
  fail "'* ' bullet prefix not recognized"
fi

# Trailing link artifacts stripped
if ! echo "$out" | grep -q '\[#1183\]'; then
  pass "trailing ([#N](url)) link artifacts stripped"
else
  fail "trailing link artifacts leaked into title/description"
fi

# Bug Fixes → fixed
out_bug=$(node "$PARSER" 7.58.0 2>&1 || echo "PARSE_FAIL")
if echo "$out_bug" | grep -q '"category": "fixed"'; then
  pass "'### Bug Fixes' maps to 'fixed' category"
else
  fail "release-please 'Bug Fixes' did not map to 'fixed'"
fi

# ─── Test 2: bump-version.sh format still parses ──────────────────
out2=$(node "$PARSER" 7.57.1 --landscape 2>&1 || echo "PARSE_FAIL")
if echo "$out2" | grep -q '"version": "7.57.1"'; then
  pass "Keep-a-Changelog header '## [X.Y.Z] - YYYY-MM-DD' still parses"
else
  fail "Keep-a-Changelog header broken — got: $out2"
fi

if echo "$out2" | grep -q '"category": "fixed"'; then
  pass "'### Fixed' still maps to 'fixed' category"
else
  fail "Keep-a-Changelog 'Fixed' section broken"
fi

# ─── Test 3: unknown version fails explicitly ─────────────────────
if node "$PARSER" 99.99.99 --landscape >/dev/null 2>&1; then
  fail "parser should exit non-zero for missing version, but exited 0"
else
  pass "missing version produces non-zero exit"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1
exit 0
