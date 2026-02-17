#!/usr/bin/env bash
# ============================================================================
# Category Grouping Correctness Tests
# ============================================================================
# Verifies that agents appear under the correct category in generated indexes.
# Ensures no agent is missing, duplicated, or miscategorized.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SRC_AGENTS="$PROJECT_ROOT/src/agents"
INDEX_FILE="$PROJECT_ROOT/plugins/ork/.claude-plugin/agent-index.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN_COUNT=$((WARN_COUNT + 1)); }

# Expected category mappings (must match agent frontmatter)
declare -A EXPECTED_CATEGORIES=(
    ["backend-system-architect"]="backend"
    ["database-engineer"]="backend"
    ["event-driven-architect"]="backend"
    ["python-performance-engineer"]="backend"
    ["frontend-ui-developer"]="frontend"
    ["frontend-performance-engineer"]="frontend"
    ["rapid-ui-designer"]="frontend"
    ["accessibility-specialist"]="frontend"
    ["security-auditor"]="security"
    ["security-layer-auditor"]="security"
    ["ai-safety-auditor"]="security"
    ["ci-cd-engineer"]="devops"
    ["deployment-manager"]="devops"
    ["infrastructure-architect"]="devops"
    ["monitoring-engineer"]="devops"
    ["release-engineer"]="devops"
    ["llm-integrator"]="llm"
    ["multimodal-specialist"]="llm"
    ["prompt-engineer"]="llm"
    ["workflow-architect"]="llm"
    ["test-generator"]="testing"
    ["debug-investigator"]="testing"
    ["code-quality-reviewer"]="testing"
    ["product-strategist"]="product"
    ["requirements-translator"]="product"
    ["prioritization-analyst"]="product"
    ["metrics-architect"]="product"
    ["market-intelligence"]="product"
    ["business-case-builder"]="product"
    ["ux-researcher"]="product"
    ["documentation-specialist"]="docs"
    ["data-pipeline-engineer"]="data"
    ["git-operations-engineer"]="git"
    ["demo-producer"]="design"
    ["system-design-reviewer"]="design"
    ["web-research-analyst"]="research"
)

# Category to header label mapping
declare -A CATEGORY_LABELS=(
    ["backend"]="Backend & Data"
    ["frontend"]="Frontend & UI"
    ["security"]="Security"
    ["devops"]="DevOps & Infrastructure"
    ["llm"]="LLM & AI"
    ["testing"]="Testing & Quality"
    ["product"]="Product & Strategy"
    ["docs"]="Documentation"
    ["data"]="Data Pipelines"
    ["git"]="Git Operations"
    ["design"]="Design & Architecture"
    ["research"]="Research & Analysis"
)

echo "=========================================="
echo "  Category Grouping Correctness Tests"
echo "=========================================="
echo ""

# ============================================================================
# Test 1: Each agent appears exactly once in index
# ============================================================================
echo "▶ Test 1: Agent uniqueness in index"
echo "──────────────────────────────────────"

DUPLICATE_AGENTS=0

for agent_md in "$SRC_AGENTS"/*.md; do
    [[ ! -f "$agent_md" ]] && continue
    agent_name=$(basename "$agent_md" .md)

    # Count occurrences in index
    count=$(grep -c "^|${agent_name}:" "$INDEX_FILE" || true)

    if [[ "$count" -eq 0 ]]; then
        fail "Agent '$agent_name' not found in index"
        DUPLICATE_AGENTS=$((DUPLICATE_AGENTS + 1))
    elif [[ "$count" -gt 1 ]]; then
        fail "Agent '$agent_name' appears $count times (should be 1)"
        DUPLICATE_AGENTS=$((DUPLICATE_AGENTS + 1))
    fi
done

if [[ "$DUPLICATE_AGENTS" -eq 0 ]]; then
    pass "Each agent appears exactly once in index"
else
    fail "$DUPLICATE_AGENTS agents have duplicates or are missing"
fi

echo ""

# ============================================================================
# Test 2: Agents appear under correct category header
# ============================================================================
echo "▶ Test 2: Agents in correct category sections"
echo "──────────────────────────────────────"

MISCATEGORIZED=0

# Parse the index to find which category each agent is under
current_category=""
declare -A AGENT_ACTUAL_CATEGORY

while IFS= read -r line; do
    # Category header line
    if [[ "$line" =~ ^\|#[[:space:]](.+)$ ]]; then
        header="${BASH_REMATCH[1]}"
        # Map header back to category key
        for cat in "${!CATEGORY_LABELS[@]}"; do
            if [[ "${CATEGORY_LABELS[$cat]}" == "$header" ]]; then
                current_category="$cat"
                break
            fi
        done
    # Agent entry line
    elif [[ "$line" =~ ^\|([a-z][a-z0-9-]+): ]]; then
        agent_name="${BASH_REMATCH[1]}"
        AGENT_ACTUAL_CATEGORY[$agent_name]="$current_category"
    fi
done < "$INDEX_FILE"

# Verify each agent is in expected category
for agent_name in "${!EXPECTED_CATEGORIES[@]}"; do
    expected="${EXPECTED_CATEGORIES[$agent_name]}"
    actual="${AGENT_ACTUAL_CATEGORY[$agent_name]:-}"

    if [[ "$actual" == "$expected" ]]; then
        : # Correct
    elif [[ -z "$actual" ]]; then
        fail "Agent '$agent_name' not found under any category"
        MISCATEGORIZED=$((MISCATEGORIZED + 1))
    else
        fail "Agent '$agent_name' in '$actual' (expected '$expected')"
        MISCATEGORIZED=$((MISCATEGORIZED + 1))
    fi
done

if [[ "$MISCATEGORIZED" -eq 0 ]]; then
    pass "All ${#EXPECTED_CATEGORIES[@]} agents in correct categories"
else
    fail "$MISCATEGORIZED agents miscategorized"
fi

echo ""

# ============================================================================
# Test 3: Agent frontmatter matches expected category
# ============================================================================
echo "▶ Test 3: Frontmatter category matches expected"
echo "──────────────────────────────────────"

FRONTMATTER_MISMATCHES=0

for agent_name in "${!EXPECTED_CATEGORIES[@]}"; do
    expected="${EXPECTED_CATEGORIES[$agent_name]}"
    agent_md="$SRC_AGENTS/${agent_name}.md"

    [[ ! -f "$agent_md" ]] && continue

    actual=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep "^category:" | head -1 | sed 's/^category:[[:space:]]*//')

    if [[ "$actual" != "$expected" ]]; then
        fail "Agent '$agent_name' frontmatter has '$actual' (expected '$expected')"
        FRONTMATTER_MISMATCHES=$((FRONTMATTER_MISMATCHES + 1))
    fi
done

if [[ "$FRONTMATTER_MISMATCHES" -eq 0 ]]; then
    pass "All agent frontmatter categories match expected values"
else
    fail "$FRONTMATTER_MISMATCHES frontmatter mismatches"
fi

echo ""

# ============================================================================
# Test 4: Category order in index
# ============================================================================
echo "▶ Test 4: Categories appear in correct order"
echo "──────────────────────────────────────"

EXPECTED_ORDER=("Backend & Data" "Frontend & UI" "Security" "DevOps & Infrastructure" "LLM & AI" "Testing & Quality" "Product & Strategy" "Data Pipelines" "Git Operations" "Design & Architecture" "Research & Analysis" "Documentation")

# Extract actual order from index
ACTUAL_ORDER=()
while IFS= read -r line; do
    if [[ "$line" =~ ^\|#[[:space:]](.+)$ ]]; then
        ACTUAL_ORDER+=("${BASH_REMATCH[1]}")
    fi
done < "$INDEX_FILE"

# Compare orders
ORDER_CORRECT=true
for i in "${!EXPECTED_ORDER[@]}"; do
    expected="${EXPECTED_ORDER[$i]}"
    actual="${ACTUAL_ORDER[$i]:-MISSING}"

    if [[ "$expected" != "$actual" ]]; then
        fail "Position $i: expected '$expected', got '$actual'"
        ORDER_CORRECT=false
    fi
done

if $ORDER_CORRECT; then
    pass "All ${#EXPECTED_ORDER[@]} categories in correct order"
fi

echo ""

# ============================================================================
# Test 5: No orphan agents (agents without category in frontmatter)
# ============================================================================
echo "▶ Test 5: No orphan agents"
echo "──────────────────────────────────────"

ORPHANS=0

for agent_md in "$SRC_AGENTS"/*.md; do
    [[ ! -f "$agent_md" ]] && continue
    agent_name=$(basename "$agent_md" .md)

    category=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep "^category:" | head -1 | sed 's/^category:[[:space:]]*//')

    if [[ -z "$category" ]]; then
        fail "Agent '$agent_name' has no category in frontmatter"
        ORPHANS=$((ORPHANS + 1))
    elif [[ "$category" == "other" ]]; then
        warn "Agent '$agent_name' has generic 'other' category"
    fi
done

if [[ "$ORPHANS" -eq 0 ]]; then
    pass "No orphan agents (all have categories)"
else
    fail "$ORPHANS agents are orphans"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
echo "=========================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT category grouping tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All category grouping tests passed${NC}"
    exit 0
fi
