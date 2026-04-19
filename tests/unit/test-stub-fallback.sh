#!/usr/bin/env bash
# Stub-fallback integration test.
#
# docs/stubs/analytics-stub/ is the no-op replacement for the private
# @yonatan-hq/analytics package, swapped in by .github/workflows/docs.yml
# (and tests/unit/test-mdx-compile.sh) when npm ci hits 401 on feature-
# branch PRs.
#
# This test pins the contract that the workflow's fallback relies on:
#   - stub package.json has the expected name + exports map
#   - stub's dist/index.js is importable and exports HQAnalytics
#   - stub's dist/edge.js is importable and exports POST + OPTIONS
#   - simulating the workflow's `npm pkg set ... file:../stubs/analytics-stub`
#     rewrite produces a valid package.json
#
# If ANY of these regress, the 401 fallback path breaks silently on the
# next feature-branch PR and docs build dies.
#
# Part of Road to 10 — Wave 2 PR-T5.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STUB_DIR="$PROJECT_ROOT/docs/stubs/analytics-stub"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
NC=$'\033[0m'

PASS=0
FAIL=0

pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

echo "════════════════════════════════════════════════════════════════"
echo "  Analytics stub-fallback integration (Road to 10 — PR-T5)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ─── Test 1: stub directory + package.json shape ────────────────────
echo "▶ Test 1: stub structure"
echo "────────────────────────────────────────────────────────────────"

if [[ ! -d "$STUB_DIR" ]]; then
  fail "Missing stub dir: $STUB_DIR"
  exit 1
fi
pass "stub directory exists"

if [[ ! -f "$STUB_DIR/package.json" ]]; then
  fail "Missing $STUB_DIR/package.json"
  exit 1
fi

NAME=$(jq -r .name "$STUB_DIR/package.json")
if [[ "$NAME" == "@yonatan-hq/analytics" ]]; then
  pass "package name is @yonatan-hq/analytics"
else
  fail "package name is '$NAME', expected '@yonatan-hq/analytics'"
fi

MAIN_EXPORT=$(jq -r '.exports["."].default // empty' "$STUB_DIR/package.json")
if [[ -n "$MAIN_EXPORT" ]]; then
  pass "exports['.'].default is defined"
else
  fail "exports['.'].default missing"
fi

EDGE_EXPORT=$(jq -r '.exports["./edge"].default // empty' "$STUB_DIR/package.json")
if [[ -n "$EDGE_EXPORT" ]]; then
  pass "exports['./edge'].default is defined"
else
  fail "exports['./edge'].default missing"
fi

TYPE=$(jq -r .type "$STUB_DIR/package.json")
if [[ "$TYPE" == "module" ]]; then
  pass "stub declares type=module (ESM)"
else
  fail "stub type is '$TYPE', expected 'module'"
fi
echo ""

# ─── Test 2: dist files exist ───────────────────────────────────────
echo "▶ Test 2: dist outputs"
echo "────────────────────────────────────────────────────────────────"

for f in dist/index.js dist/edge.js dist/index.d.ts dist/edge.d.ts; do
  if [[ -f "$STUB_DIR/$f" ]]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done
echo ""

# ─── Test 3: runtime imports work (both index and edge) ─────────────
echo "▶ Test 3: ESM imports resolve without error"
echo "────────────────────────────────────────────────────────────────"

TEST_OUT=$(node --input-type=module -e "
import * as main from '$STUB_DIR/dist/index.js';
import * as edge from '$STUB_DIR/dist/edge.js';
const out = {
  main_keys: Object.keys(main).sort(),
  edge_keys: Object.keys(edge).sort(),
  hqAnalytics_type: typeof main.HQAnalytics,
  hqAnalytics_returns: typeof main.HQAnalytics === 'function' ? main.HQAnalytics() : null,
  edge_POST_type: typeof edge.POST,
  edge_OPTIONS_type: typeof edge.OPTIONS,
};
console.log(JSON.stringify(out));
" 2>&1)
if [[ $? -ne 0 ]]; then
  fail "import threw: $TEST_OUT"
else
  pass "imports resolve"

  HQ_TYPE=$(echo "$TEST_OUT" | jq -r .hqAnalytics_type)
  if [[ "$HQ_TYPE" == "function" ]]; then
    pass "HQAnalytics is a function"
  else
    fail "HQAnalytics type is '$HQ_TYPE', expected 'function'"
  fi

  HQ_RET=$(echo "$TEST_OUT" | jq -r .hqAnalytics_returns)
  # React components returning null show up as 'object' (null is typeof object)
  if [[ "$HQ_RET" == "object" || "$HQ_RET" == "null" ]]; then
    pass "HQAnalytics() returns null/falsy (no-op component)"
  else
    fail "HQAnalytics() returned '$HQ_RET', expected null"
  fi

  POST_TYPE=$(echo "$TEST_OUT" | jq -r .edge_POST_type)
  OPTIONS_TYPE=$(echo "$TEST_OUT" | jq -r .edge_OPTIONS_type)
  if [[ "$POST_TYPE" == "function" && "$OPTIONS_TYPE" == "function" ]]; then
    pass "edge POST + OPTIONS handlers are functions"
  else
    fail "edge handlers wrong: POST=$POST_TYPE OPTIONS=$OPTIONS_TYPE"
  fi
fi
echo ""

# ─── Test 4: simulate the workflow's package.json rewrite ───────────
echo "▶ Test 4: simulate docs.yml's \`npm pkg set ... file:../stubs/analytics-stub\`"
echo "────────────────────────────────────────────────────────────────"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

# Make a skeletal package.json that references @yonatan-hq/analytics like
# the real docs/site does (we don't need all the deps, just the target dep)
cat > "$SANDBOX/package.json" <<'EOF'
{
  "name": "fixture",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "@yonatan-hq/analytics": "^1.0.4"
  }
}
EOF

# Replicate the workflow step
(cd "$SANDBOX" && npm pkg set "dependencies.@yonatan-hq/analytics=file:$STUB_DIR" >/dev/null 2>&1)

NEW_DEP=$(jq -r '.dependencies["@yonatan-hq/analytics"]' "$SANDBOX/package.json")
if [[ "$NEW_DEP" == "file:$STUB_DIR" ]]; then
  pass "package.json rewrite succeeded (dependency now points at stub)"
else
  fail "rewrite produced '$NEW_DEP' — expected 'file:$STUB_DIR'"
fi

# Validate the resulting package.json is still parseable JSON
if jq empty "$SANDBOX/package.json" >/dev/null 2>&1; then
  pass "rewritten package.json is still valid JSON"
else
  fail "rewritten package.json is not valid JSON"
fi
echo ""

# ─── Summary ────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1
exit 0
