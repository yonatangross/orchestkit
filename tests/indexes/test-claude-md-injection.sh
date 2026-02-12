#!/usr/bin/env bash
# ============================================================================
# CLAUDE.md Passive Injection Tests
# ============================================================================
# Verifies that generated CLAUDE.md files for ork and ork-core contain
# the full agent index and proper retrieval instructions.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "=========================================="
echo "  CLAUDE.md Passive Injection Tests"
echo "=========================================="
echo ""

# Find ALL plugins that have agent indexes (they should all have CLAUDE.md)
TARGET_PLUGINS=()
for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ ! -d "$plugin_dir" ]] && continue
    plugin_name=$(basename "$plugin_dir")
    if [[ -f "$plugin_dir/.claude-plugin/agent-index.md" ]]; then
        TARGET_PLUGINS+=("$plugin_name")
    fi
done

echo "Found ${#TARGET_PLUGINS[@]} plugins with agent indexes"
echo ""

for plugin in "${TARGET_PLUGINS[@]}"; do
    CLAUDE_MD="$PLUGINS_DIR/$plugin/CLAUDE.md"
    INDEX_FILE="$PLUGINS_DIR/$plugin/.claude-plugin/agent-index.md"

    echo "▶ Testing $plugin plugin"
    echo "──────────────────────────────────────"

    # ========================================================================
    # Test: CLAUDE.md exists
    # ========================================================================
    if [[ -f "$CLAUDE_MD" ]]; then
        pass "CLAUDE.md exists"
    else
        fail "CLAUDE.md not found"
        continue
    fi

    # ========================================================================
    # Test: Has proper title
    # ========================================================================
    if head -1 "$CLAUDE_MD" | grep -q "^# OrchestKit Agent Routing"; then
        pass "Has proper title header"
    else
        fail "Missing or incorrect title header"
    fi

    # ========================================================================
    # Test: Has retrieval-led reasoning instruction
    # ========================================================================
    if grep -qi "retrieval-led reasoning" "$CLAUDE_MD"; then
        pass "Contains 'retrieval-led reasoning' instruction"
    else
        fail "Missing 'retrieval-led reasoning' instruction"
    fi

    # ========================================================================
    # Test: Has "Do NOT rely on training data" instruction
    # ========================================================================
    if grep -q "Do NOT rely on training data" "$CLAUDE_MD"; then
        pass "Contains 'Do NOT rely on training data' instruction"
    else
        fail "Missing 'Do NOT rely on training data' instruction"
    fi

    # ========================================================================
    # Test: Contains code block with index
    # ========================================================================
    CODE_BLOCKS=$(grep -c '```' "$CLAUDE_MD" || true)
    if [[ "$CODE_BLOCKS" -ge 2 ]]; then
        pass "Contains code block (found $CODE_BLOCKS backtick markers)"
    else
        fail "Missing code block for index"
    fi

    # ========================================================================
    # Test: Code block contains agent routing index
    # ========================================================================
    if grep -q "\[.*Agent Routing Index\]" "$CLAUDE_MD"; then
        pass "Code block contains Agent Routing Index"
    else
        fail "Code block missing Agent Routing Index"
    fi

    # ========================================================================
    # Test: Contains |root: directive
    # ========================================================================
    if grep -q "|root: ./agents" "$CLAUDE_MD"; then
        pass "Contains |root: ./agents directive"
    else
        fail "Missing |root: ./agents directive"
    fi

    # ========================================================================
    # Test: Contains category headers (only for plugins with multiple agents)
    # ========================================================================
    AGENT_COUNT_IN_FILE=$(grep -cE "^\|[a-z][a-z0-9-]+:" "$CLAUDE_MD" || true)
    CATEGORY_COUNT=$(grep -c "^|# " "$CLAUDE_MD" || true)
    if [[ "$CATEGORY_COUNT" -gt 0 ]]; then
        pass "Contains $CATEGORY_COUNT category headers"
    elif [[ "$AGENT_COUNT_IN_FILE" -le 2 ]]; then
        pass "Small plugin ($AGENT_COUNT_IN_FILE agents), categories optional"
    else
        fail "No category headers found (has $AGENT_COUNT_IN_FILE agents)"
    fi

    # ========================================================================
    # Test: Agent count matches source
    # ========================================================================
    if [[ -f "$INDEX_FILE" ]]; then
        INDEX_AGENT_COUNT=$(grep -cE "^\|[a-z][a-z0-9-]+:" "$INDEX_FILE" || true)
        CLAUDE_AGENT_COUNT=$(grep -cE "^\|[a-z][a-z0-9-]+:" "$CLAUDE_MD" || true)

        if [[ "$INDEX_AGENT_COUNT" -eq "$CLAUDE_AGENT_COUNT" ]]; then
            pass "Agent count matches index: $INDEX_AGENT_COUNT"
        else
            fail "Agent count mismatch: index=$INDEX_AGENT_COUNT, CLAUDE.md=$CLAUDE_AGENT_COUNT"
        fi
    fi

    # ========================================================================
    # Test: File size is reasonable (proportional to agent count)
    # ========================================================================
    FILE_SIZE=$(wc -c < "$CLAUDE_MD" | tr -d ' ')
    AGENT_COUNT_FOR_SIZE=$(grep -cE "^\|[a-z][a-z0-9-]+:" "$CLAUDE_MD" || true)
    MIN_SIZE=$((AGENT_COUNT_FOR_SIZE * 100 + 200))  # ~100 bytes/agent + 200 header

    if [[ "$FILE_SIZE" -lt "$MIN_SIZE" ]]; then
        fail "CLAUDE.md too small ($FILE_SIZE bytes for $AGENT_COUNT_FOR_SIZE agents)"
    elif [[ "$FILE_SIZE" -gt 20000 ]]; then
        fail "CLAUDE.md too large ($FILE_SIZE bytes), may have duplicates"
    else
        pass "File size reasonable: $FILE_SIZE bytes for $AGENT_COUNT_FOR_SIZE agents"
    fi

    # ========================================================================
    # Test: Instructions appear BEFORE code block (passive context pattern)
    # ========================================================================
    FIRST_INSTRUCTION_LINE=$(grep -n "retrieval-led reasoning" "$CLAUDE_MD" | head -1 | cut -d: -f1 || echo "999")
    FIRST_CODE_BLOCK_LINE=$(grep -n '```' "$CLAUDE_MD" | head -1 | cut -d: -f1 || echo "1")

    if [[ "$FIRST_INSTRUCTION_LINE" -lt "$FIRST_CODE_BLOCK_LINE" ]]; then
        pass "Instructions appear before code block (proper passive pattern)"
    else
        fail "Code block appears before instructions (wrong order)"
    fi

    echo ""
done

# ============================================================================
# Test: ork-core uses composite or plugin index appropriately
# ============================================================================
echo "▶ Testing index source selection"
echo "──────────────────────────────────────"

ORK_CORE_CLAUDE="$PLUGINS_DIR/ork-core/CLAUDE.md"
ORK_CORE_INDEX="$PLUGINS_DIR/ork-core/.claude-plugin/agent-index.md"

if [[ -f "$ORK_CORE_CLAUDE" ]]; then
    if [[ -f "$ORK_CORE_INDEX" ]]; then
        # ork-core has its own index, CLAUDE.md should use it
        pass "ork-core has its own agent-index.md"
    else
        # ork-core should use composite index
        if grep -q "OrchestKit Agent Routing Index" "$ORK_CORE_CLAUDE"; then
            pass "ork-core uses composite index (no local agents)"
        fi
    fi
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "=========================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT CLAUDE.md injection tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All CLAUDE.md injection tests passed${NC}"
    exit 0
fi
