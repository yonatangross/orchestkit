#!/usr/bin/env bash
# ============================================================================
# Passive Index Generation Tests
# ============================================================================
# Validates that the build step generates correct Tier 1 (agent) and
# Tier 2 (skill) indexes for passive routing.
#
# Tests:
#   1. Composite index exists and is non-empty
#   2. All agents from src/agents/ are present in the composite index
#   3. Per-plugin agent-index.md files exist for plugins with agents
#   4. Per-agent skill-index files exist for agents with skills
#   5. Skill index references point to real files
#   6. Index size stays within budget (<8KB per Tier 1, <4KB per Tier 2)
#   7. Index format is valid (pipe-delimited, no empty keywords)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
SRC_DIR="$PROJECT_ROOT/src"
COMPOSITE_INDEX="$PLUGINS_DIR/.composite-agent-index.md"

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

echo "=========================================="
echo "  Passive Index Generation Tests"
echo "=========================================="
echo ""

# ============================================================================
# Test 1: Composite index exists and is non-empty
# ============================================================================
echo "▶ Test 1: Composite index existence"
echo "──────────────────────────────────────"

if [[ ! -f "$COMPOSITE_INDEX" ]]; then
    fail "Composite index not found at $COMPOSITE_INDEX"
    echo ""
    echo -e "${RED}FATAL: Cannot continue without composite index. Run 'npm run build' first.${NC}"
    exit 1
fi

COMPOSITE_SIZE=$(wc -c < "$COMPOSITE_INDEX" | tr -d ' ')
if [[ "$COMPOSITE_SIZE" -gt 0 ]]; then
    pass "Composite index exists (${COMPOSITE_SIZE} bytes)"
else
    fail "Composite index is empty"
fi

# Check header
if head -1 "$COMPOSITE_INDEX" | grep -q "^\[OrchestKit Agent Routing Index\]"; then
    pass "Composite index has valid header"
else
    fail "Composite index missing header"
fi

echo ""

# ============================================================================
# Test 2: All agents are indexed
# ============================================================================
echo "▶ Test 2: Agent coverage"
echo "──────────────────────────────────────"

# Get all agent names from source
TOTAL_AGENTS=0
MISSING_AGENTS=0

for agent_md in "$SRC_DIR/agents"/*.md; do
    [[ ! -f "$agent_md" ]] && continue
    agent_name=$(basename "$agent_md" .md)
    TOTAL_AGENTS=$((TOTAL_AGENTS + 1))

    # Check if agent appears in the ork mega-plugin section of the composite index
    # New format: |agent:{agent.md}|keywords
    if grep -q "^|${agent_name}:" "$COMPOSITE_INDEX"; then
        : # Found
    else
        fail "Agent '$agent_name' missing from composite index"
        MISSING_AGENTS=$((MISSING_AGENTS + 1))
    fi
done

if [[ "$MISSING_AGENTS" -eq 0 ]]; then
    pass "All $TOTAL_AGENTS agents present in composite index"
else
    fail "$MISSING_AGENTS of $TOTAL_AGENTS agents missing"
fi

echo ""

# ============================================================================
# Test 3: Per-plugin Tier 1 indexes
# ============================================================================
echo "▶ Test 3: Per-plugin agent indexes (Tier 1)"
echo "──────────────────────────────────────"

PLUGINS_WITH_AGENTS=0
PLUGINS_WITH_INDEX=0

for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ ! -d "$plugin_dir" ]] && continue
    plugin_name=$(basename "$plugin_dir")

    if [[ -d "$plugin_dir/agents" ]]; then
        agent_count=$(find "$plugin_dir/agents" -name "*.md" -type f | wc -l | tr -d ' ')
        if [[ "$agent_count" -gt 0 ]]; then
            PLUGINS_WITH_AGENTS=$((PLUGINS_WITH_AGENTS + 1))

            index_file="$plugin_dir/.claude-plugin/agent-index.md"
            if [[ -f "$index_file" ]]; then
                PLUGINS_WITH_INDEX=$((PLUGINS_WITH_INDEX + 1))

                # Check size budget: Tier 1 should be <8KB
                size=$(wc -c < "$index_file" | tr -d ' ')
                if [[ "$size" -gt 8192 ]]; then
                    fail "$plugin_name: agent-index.md exceeds 8KB budget (${size} bytes)"
                fi
            else
                fail "$plugin_name: has $agent_count agents but no agent-index.md"
            fi
        fi
    fi
done

if [[ "$PLUGINS_WITH_AGENTS" -eq "$PLUGINS_WITH_INDEX" ]]; then
    pass "All $PLUGINS_WITH_AGENTS plugins with agents have Tier 1 indexes"
else
    fail "$PLUGINS_WITH_INDEX of $PLUGINS_WITH_AGENTS plugins have Tier 1 indexes"
fi

echo ""

# ============================================================================
# Test 4: Per-agent Tier 2 skill indexes
# ============================================================================
echo "▶ Test 4: Per-agent skill indexes (Tier 2)"
echo "──────────────────────────────────────"

# Check the ork mega-plugin (has all 35 agents)
ORK_SKILL_INDEXES="$PLUGINS_DIR/ork/.claude-plugin/skill-indexes"
AGENTS_WITH_SKILLS=0
AGENTS_WITH_INDEX=0

for agent_md in "$SRC_DIR/agents"/*.md; do
    [[ ! -f "$agent_md" ]] && continue
    agent_name=$(basename "$agent_md" .md)

    # Check if agent has skills in frontmatter
    has_skills=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep -c "^skills:" || true)
    if [[ "$has_skills" -gt 0 ]]; then
        skill_count=$(sed -n '/^skills:/,/^[a-z].*:/p' "$agent_md" | grep -c "^  - " || true)
        if [[ "$skill_count" -gt 0 ]]; then
            AGENTS_WITH_SKILLS=$((AGENTS_WITH_SKILLS + 1))

            if [[ -f "$ORK_SKILL_INDEXES/${agent_name}.md" ]]; then
                AGENTS_WITH_INDEX=$((AGENTS_WITH_INDEX + 1))

                # Check size budget: Tier 2 should be <4KB
                size=$(wc -c < "$ORK_SKILL_INDEXES/${agent_name}.md" | tr -d ' ')
                if [[ "$size" -gt 4096 ]]; then
                    warn "$agent_name: skill index exceeds 4KB budget (${size} bytes)"
                fi
            else
                fail "Agent '$agent_name' has $skill_count skills but no Tier 2 index"
            fi
        fi
    fi
done

if [[ "$AGENTS_WITH_SKILLS" -eq "$AGENTS_WITH_INDEX" ]]; then
    pass "All $AGENTS_WITH_SKILLS agents with skills have Tier 2 indexes"
else
    fail "$AGENTS_WITH_INDEX of $AGENTS_WITH_SKILLS agents have Tier 2 indexes"
fi

echo ""

# ============================================================================
# Test 5: Skill index references point to real files
# ============================================================================
echo "▶ Test 5: Skill index reference validity"
echo "──────────────────────────────────────"

BROKEN_REFS=0
TOTAL_REFS=0
ORK_SKILLS="$PLUGINS_DIR/ork/skills"

for index_file in "$ORK_SKILL_INDEXES"/*.md; do
    [[ ! -f "$index_file" ]] && continue

    # Extract skill names from index entries (lines starting with |skillname:)
    while IFS= read -r line; do
        skill_name=$(echo "$line" | sed 's/^|\([^:]*\):.*/\1/')
        if [[ -n "$skill_name" && -d "$ORK_SKILLS/$skill_name" ]]; then
            TOTAL_REFS=$((TOTAL_REFS + 1))
            if [[ ! -f "$ORK_SKILLS/$skill_name/SKILL.md" ]]; then
                fail "Index references '$skill_name' but SKILL.md doesn't exist"
                BROKEN_REFS=$((BROKEN_REFS + 1))
            fi
        fi
    done < <(grep "^|[a-z].*:{" "$index_file" 2>/dev/null || true)
done

if [[ "$BROKEN_REFS" -eq 0 ]]; then
    pass "All $TOTAL_REFS skill references are valid"
else
    fail "$BROKEN_REFS of $TOTAL_REFS references are broken"
fi

echo ""

# ============================================================================
# Test 6: Index format validation
# ============================================================================
echo "▶ Test 6: Index format validation"
echo "──────────────────────────────────────"

FORMAT_ERRORS=0

# Check composite index format
while IFS= read -r line; do
    # Skip header, comments, and empty lines
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^\[ ]] && continue
    [[ "$line" =~ ^\|# ]] && continue
    [[ "$line" =~ ^\|IMPORTANT ]] && continue
    [[ "$line" =~ ^\|Prefer ]] && continue
    [[ "$line" =~ ^\|Do ]] && continue
    [[ "$line" == "|" ]] && continue

    # Agent entries should be: |name:{name.md}|keywords (new format)
    # or |name|keywords (legacy format)
    if [[ "$line" =~ ^\|([a-z][a-z0-9-]+):\{[^}]+\}\|(.+)$ ]]; then
        agent_name="${BASH_REMATCH[1]}"
        keywords="${BASH_REMATCH[2]}"

        # Keywords should not be empty
        if [[ -z "$keywords" || "$keywords" == " " ]]; then
            fail "Agent '$agent_name' has empty keywords"
            FORMAT_ERRORS=$((FORMAT_ERRORS + 1))
        fi
    elif [[ "$line" =~ ^\|([a-z][a-z0-9-]+)\|(.+)$ ]]; then
        # Legacy format without file reference
        agent_name="${BASH_REMATCH[1]}"
        keywords="${BASH_REMATCH[2]}"

        if [[ -z "$keywords" || "$keywords" == " " ]]; then
            fail "Agent '$agent_name' has empty keywords"
            FORMAT_ERRORS=$((FORMAT_ERRORS + 1))
        fi
    elif [[ "$line" =~ ^\|root: ]]; then
        # Root directive - valid header line
        :
    elif [[ "$line" =~ ^\|When ]]; then
        # Instruction line - valid header line
        :
    elif [[ "$line" =~ ^\| ]]; then
        # Line starts with | but doesn't match agent pattern — could be header continuation
        :
    fi
done < "$COMPOSITE_INDEX"

if [[ "$FORMAT_ERRORS" -eq 0 ]]; then
    pass "Composite index format is valid"
else
    fail "$FORMAT_ERRORS format errors found"
fi

echo ""

# ============================================================================
# Test 7: Size budget summary
# ============================================================================
echo "▶ Test 7: Size budget check"
echo "──────────────────────────────────────"

# Composite index should be <16KB (contains duplicates across plugins)
if [[ "$COMPOSITE_SIZE" -lt 16384 ]]; then
    pass "Composite index within 16KB budget (${COMPOSITE_SIZE} bytes)"
else
    fail "Composite index exceeds 16KB budget (${COMPOSITE_SIZE} bytes)"
fi

# Per-plugin Tier 1 check (already done above, just report)
ORK_T1_SIZE=$(wc -c < "$PLUGINS_DIR/ork/.claude-plugin/agent-index.md" | tr -d ' ')
if [[ "$ORK_T1_SIZE" -lt 8192 ]]; then
    pass "ork Tier 1 index: ${ORK_T1_SIZE} bytes (budget: 8KB)"
else
    fail "ork Tier 1 index exceeds 8KB: ${ORK_T1_SIZE} bytes"
fi

# Total Tier 2 size for ork (all agent skill indexes combined)
TOTAL_T2_SIZE=$(cat "$ORK_SKILL_INDEXES"/*.md 2>/dev/null | wc -c | tr -d ' ')
AVG_T2_SIZE=$((TOTAL_T2_SIZE / AGENTS_WITH_INDEX))
pass "ork Tier 2 total: ${TOTAL_T2_SIZE} bytes, avg ${AVG_T2_SIZE} bytes/agent"

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
echo "=========================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All index generation tests passed${NC}"
    exit 0
fi
