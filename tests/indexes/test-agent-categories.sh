#!/usr/bin/env bash
# ============================================================================
# Agent Category Schema Validation Tests
# ============================================================================
# Validates that all agents have a valid `category` field from the allowed list.
# Part of Vercel AGENTS.md compliance testing.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SRC_AGENTS="$PROJECT_ROOT/src/agents"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }

# Valid categories (must match generate-indexes.sh CATEGORY_ORDER)
VALID_CATEGORIES="backend frontend security devops llm testing product docs data git design other"

echo "=========================================="
echo "  Agent Category Schema Validation"
echo "=========================================="
echo ""

# ============================================================================
# Test 1: All agents have category field
# ============================================================================
echo "▶ Test 1: Category field presence"
echo "──────────────────────────────────────"

AGENTS_WITHOUT_CATEGORY=0
TOTAL_AGENTS=0

for agent_md in "$SRC_AGENTS"/*.md; do
    [[ ! -f "$agent_md" ]] && continue
    agent_name=$(basename "$agent_md" .md)
    TOTAL_AGENTS=$((TOTAL_AGENTS + 1))

    # Check if category exists in frontmatter
    if ! sed -n '/^---$/,/^---$/p' "$agent_md" | grep -q "^category:"; then
        fail "Agent '$agent_name' missing category field"
        AGENTS_WITHOUT_CATEGORY=$((AGENTS_WITHOUT_CATEGORY + 1))
    fi
done

if [[ "$AGENTS_WITHOUT_CATEGORY" -eq 0 ]]; then
    pass "All $TOTAL_AGENTS agents have category field"
else
    fail "$AGENTS_WITHOUT_CATEGORY of $TOTAL_AGENTS agents missing category"
fi

echo ""

# ============================================================================
# Test 2: All categories are valid
# ============================================================================
echo "▶ Test 2: Category values are valid"
echo "──────────────────────────────────────"

INVALID_CATEGORIES=0

for agent_md in "$SRC_AGENTS"/*.md; do
    [[ ! -f "$agent_md" ]] && continue
    agent_name=$(basename "$agent_md" .md)

    # Extract category value
    category=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep "^category:" | head -1 | sed 's/^category:[[:space:]]*//')

    if [[ -z "$category" ]]; then
        continue  # Already reported in Test 1
    fi

    # Check if category is in valid list
    if ! echo "$VALID_CATEGORIES" | grep -qw "$category"; then
        fail "Agent '$agent_name' has invalid category: '$category'"
        INVALID_CATEGORIES=$((INVALID_CATEGORIES + 1))
    fi
done

if [[ "$INVALID_CATEGORIES" -eq 0 ]]; then
    pass "All agent categories are valid values"
else
    fail "$INVALID_CATEGORIES agents have invalid category values"
fi

echo ""

# ============================================================================
# Test 3: Category distribution (informational)
# ============================================================================
echo "▶ Test 3: Category distribution"
echo "──────────────────────────────────────"

declare -A CATEGORY_COUNTS

for agent_md in "$SRC_AGENTS"/*.md; do
    [[ ! -f "$agent_md" ]] && continue

    category=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep "^category:" | head -1 | sed 's/^category:[[:space:]]*//')

    if [[ -n "$category" ]]; then
        CATEGORY_COUNTS[$category]=$((${CATEGORY_COUNTS[$category]:-0} + 1))
    fi
done

# Print distribution
for cat in $VALID_CATEGORIES; do
    count="${CATEGORY_COUNTS[$cat]:-0}"
    if [[ "$count" -gt 0 ]]; then
        echo -e "  ${GREEN}$cat${NC}: $count agents"
    fi
done

pass "Category distribution logged"

echo ""

# ============================================================================
# Test 4: No duplicate agents in same category check
# ============================================================================
echo "▶ Test 4: Agent names are unique"
echo "──────────────────────────────────────"

DUPLICATE_NAMES=$(find "$SRC_AGENTS" -name "*.md" -exec basename {} .md \; | sort | uniq -d)

if [[ -z "$DUPLICATE_NAMES" ]]; then
    pass "All agent names are unique"
else
    fail "Duplicate agent names found: $DUPLICATE_NAMES"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "=========================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All category schema tests passed${NC}"
    exit 0
fi
