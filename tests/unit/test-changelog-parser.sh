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

# ─── Test 4: component stats are real, never zero ─────────────────
# Regression guard. statsBefore/statsAfter used to default to {0,0,0} and were
# only filled by a "Skill count: 197 → 199" regex that release-please never
# emits, so every release rendered "0 skills, 0 hooks" into both the announce
# payload and the release videos (release-video.yml feeds on this script).
# Counts now come from the ork manifest description, which bin/validate-counts.sh
# already asserts against the filesystem.
#
# Process substitution, not here-strings: bash 5.3 deadlocks on here-strings
# that pipe back a payload over PIPE_BUF (ork#3348). stderr is NOT swallowed —
# a parser crash must fail loudly, not read as "counts are zero".
#
# `printf '%s\n'`, never `printf '%s'`: without the newline `read` hits EOF and
# returns 1, which under `set -e` kills the suite mid-run and prints no summary.
#
# NOTE: this block runs while the fixture CHANGELOG is swapped in, so $LATEST is
# a fixture version. That is deliberate — the counts must come from the manifest
# regardless of what the changelog says, which is exactly the regression.
LATEST=$(node -e '
const fs=require("fs");
const m=fs.readFileSync(process.argv[1],"utf8").match(/^## \[([0-9][^\]]*)\]/m);
process.stdout.write(m?m[1]:"");
' "$PROJECT_ROOT/CHANGELOG.md")

DECLARED=$(node -e '
const d=require(process.argv[1]).description||"";
const g=(re)=>{const m=d.match(re);return m?m[1]:"0"};
process.stdout.write([
  g(/(\d+)\s+skills/i), g(/(\d+)\s+agents/i), g(/(\d+)\s+(?:TypeScript\s+)?hooks/i),
].join(" "));
' "$PROJECT_ROOT/manifests/ork.json")
read -r DECL_SKILLS DECL_AGENTS DECL_HOOKS < <(printf '%s\n' "$DECLARED")

for fmt in --landscape --square; do
  props=$(node "$PARSER" "$LATEST" "$fmt")
  stats=$(printf '%s' "$props" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s).statsAfter||{};
  process.stdout.write([a.skills,a.agents,a.hooks].join(" "));
});')
  read -r GOT_SKILLS GOT_AGENTS GOT_HOOKS < <(printf '%s\n' "$stats")

  if [[ -z "$GOT_SKILLS" || "$GOT_SKILLS" == "0" || "$GOT_HOOKS" == "0" ]]; then
    fail "$fmt statsAfter zeroed: skills=$GOT_SKILLS hooks=$GOT_HOOKS"
  else
    pass "$fmt statsAfter counts are non-zero"
  fi

  if [[ "$GOT_SKILLS" == "$DECL_SKILLS" && "$GOT_AGENTS" == "$DECL_AGENTS" && "$GOT_HOOKS" == "$DECL_HOOKS" ]]; then
    pass "$fmt statsAfter matches manifest ($DECL_SKILLS/$DECL_AGENTS/$DECL_HOOKS)"
  else
    fail "$fmt statsAfter $GOT_SKILLS/$GOT_AGENTS/$GOT_HOOKS != manifest $DECL_SKILLS/$DECL_AGENTS/$DECL_HOOKS"
  fi
done

# ─── Test 5: announce payload carries the machine account ─────────
# The payload had no account field, so the receiving platform fell back to its
# own default posting identity. An automated release rail must publish under a
# dedicated bot account, never a maintainer's personal one.
ANNOUNCE="$PROJECT_ROOT/scripts/announce-release.mjs"
# stderr is CAPTURED to a file, not discarded: the script legitimately warns
# "creds unset" there in dry-run, but a real crash must stay readable.
ANNOUNCE_ERR="$FIXTURE_DIR/announce.err"
acct=$(RELEASE_VERSION="$LATEST" RELEASE_URL="https://example.invalid/r" \
  DRY_RUN=true node "$ANNOUNCE" 2>"$ANNOUNCE_ERR" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  process.stdout.write(String((JSON.parse(s).payload||{}).account||""));
});')

if [[ "$acct" == "yonyon2ai" ]]; then
  pass "announce payload defaults to the automation account"
else
  fail "announce payload account is '$acct', expected 'yonyon2ai' (stderr: $(cat "$ANNOUNCE_ERR"))"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1
exit 0
