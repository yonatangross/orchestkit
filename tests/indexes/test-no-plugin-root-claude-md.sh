#!/usr/bin/env bash
# ============================================================================
# No CLAUDE.md at a plugin root
# ============================================================================
# Claude Code does not load a CLAUDE.md at a plugin root as context, and
# `claude plugin validate --strict` fails on one ("CLAUDE.md at the plugin
# root is not loaded as project context"). The plugin directory submission
# runs the same check, so the build must never write one.
#
# Checks both sides:
#   1. the committed build output: no plugins/<name>/CLAUDE.md
#   2. the generator source: scripts/generate-indexes.js has no CLAUDE.md write
# The routing index itself still ships as .claude-plugin/agent-index.md.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "=========================================="
echo "  No CLAUDE.md at a plugin root"
echo "=========================================="
echo ""

# ----------------------------------------------------------------------------
# Test 1: committed build output
# ----------------------------------------------------------------------------
echo "▶ Test 1: built plugins carry no root CLAUDE.md"
echo "──────────────────────────────────────"

PLUGIN_COUNT=0
for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ -d "$plugin_dir" ]] || continue
    PLUGIN_COUNT=$((PLUGIN_COUNT + 1))
    plugin_name="$(basename "$plugin_dir")"
    if [[ -e "${plugin_dir}CLAUDE.md" ]]; then
        fail "$plugin_name: plugins/$plugin_name/CLAUDE.md exists (never loaded, fails validate --strict)"
    else
        pass "$plugin_name: no root CLAUDE.md"
    fi
done

if [[ "$PLUGIN_COUNT" -eq 0 ]]; then
    fail "no built plugins found under $PLUGINS_DIR (zero-sample run proves nothing)"
fi

# The index the old CLAUDE.md wrapped must still ship.
if [[ -f "$PLUGINS_DIR/ork/.claude-plugin/agent-index.md" ]]; then
    pass "ork: .claude-plugin/agent-index.md still ships"
else
    fail "ork: .claude-plugin/agent-index.md missing"
fi

echo ""

# ----------------------------------------------------------------------------
# Test 2: the generator writes none
# ----------------------------------------------------------------------------
echo "▶ Test 2: generate-indexes.js writes no plugin-root CLAUDE.md"
echo "──────────────────────────────────────"

if grep -qE "writeFileSync\([^)]*'CLAUDE\.md'" "$PROJECT_ROOT/scripts/generate-indexes.js"; then
    fail "scripts/generate-indexes.js still writes a CLAUDE.md"
else
    pass "scripts/generate-indexes.js has no CLAUDE.md write"
fi

echo ""
echo "=========================================="
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "=========================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT plugin-root CLAUDE.md checks failed${NC}"
    exit 1
fi
echo -e "${GREEN}SUCCESS: no plugin-root CLAUDE.md${NC}"
exit 0
