#!/usr/bin/env bash
# ============================================================================
# Vercel AGENTS.md Format Contract Tests
# ============================================================================
# Validates that generated indexes match Vercel's AGENTS.md specification exactly.
# Reference: https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
ORK_INDEX="$PLUGINS_DIR/ork/.claude-plugin/agent-index.md"
ORK_CLAUDE_MD="$PLUGINS_DIR/ork/CLAUDE.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }

echo "=========================================="
echo "  Vercel AGENTS.md Format Contract Tests"
echo "=========================================="
echo ""

# ============================================================================
# Test 1: Header format matches Vercel spec
# ============================================================================
echo "▶ Test 1: Index header format"
echo "──────────────────────────────────────"

# Line 1: [Name Agent Routing Index]
if head -1 "$ORK_INDEX" | grep -qE "^\[.+ Agent Routing Index\]$"; then
    pass "Line 1: Has [Name Agent Routing Index] header"
else
    fail "Line 1: Missing proper header format"
fi

# Line 2: |root: directive (Vercel requirement)
if sed -n '2p' "$ORK_INDEX" | grep -qE "^\|root: \./"; then
    pass "Line 2: Has |root: directive"
else
    fail "Line 2: Missing |root: directive (Vercel requirement)"
fi

# Line 3: Retrieval-led reasoning instruction
if sed -n '3p' "$ORK_INDEX" | grep -qi "retrieval-led reasoning"; then
    pass "Line 3: Has 'retrieval-led reasoning' instruction"
else
    fail "Line 3: Missing 'retrieval-led reasoning' phrase (Vercel key phrase)"
fi

# Line with "Do NOT rely on training data"
if grep -q "Do NOT rely on training data" "$ORK_INDEX"; then
    pass "Has 'Do NOT rely on training data' instruction"
else
    fail "Missing 'Do NOT rely on training data' instruction"
fi

echo ""

# ============================================================================
# Test 2: Agent entry format |name:{file}|keywords
# ============================================================================
echo "▶ Test 2: Agent entry format"
echo "──────────────────────────────────────"

# Count entries with new format |name:{name.md}|keywords
NEW_FORMAT_COUNT=$(grep -cE "^\|[a-z][a-z0-9-]+:\{[^}]+\.md\}\|" "$ORK_INDEX" || true)

# Count entries with old format |name|keywords (should be 0)
OLD_FORMAT_COUNT=$(grep -cE "^\|[a-z][a-z0-9-]+\|[^:{]" "$ORK_INDEX" || true)

if [[ "$NEW_FORMAT_COUNT" -gt 0 ]]; then
    pass "Found $NEW_FORMAT_COUNT entries with |name:{file}|keywords format"
else
    fail "No entries found with Vercel format |name:{file}|keywords"
fi

if [[ "$OLD_FORMAT_COUNT" -eq 0 ]]; then
    pass "No legacy format entries (|name|keywords)"
else
    fail "Found $OLD_FORMAT_COUNT legacy format entries (should be 0)"
fi

echo ""

# ============================================================================
# Test 3: Category headers with # prefix
# ============================================================================
echo "▶ Test 3: Category grouping headers"
echo "──────────────────────────────────────"

# Count category headers
CATEGORY_HEADERS=$(grep -cE "^\|# " "$ORK_INDEX" || true)

if [[ "$CATEGORY_HEADERS" -gt 0 ]]; then
    pass "Found $CATEGORY_HEADERS category headers (|# Category)"
else
    fail "No category headers found (Vercel recommends section grouping)"
fi

# Verify known categories exist
EXPECTED_CATEGORIES=("Backend & Data" "Frontend & UI" "Security" "DevOps & Infrastructure" "LLM & AI" "Testing & Quality" "Product & Strategy")

for cat in "${EXPECTED_CATEGORIES[@]}"; do
    if grep -q "|# $cat" "$ORK_INDEX"; then
        pass "Category '$cat' present"
    else
        fail "Category '$cat' missing"
    fi
done

echo ""

# ============================================================================
# Test 4: CLAUDE.md passive injection
# ============================================================================
echo "▶ Test 4: CLAUDE.md contains full index"
echo "──────────────────────────────────────"

if [[ -f "$ORK_CLAUDE_MD" ]]; then
    pass "CLAUDE.md exists for ork plugin"
else
    fail "CLAUDE.md missing for ork plugin"
    exit 1
fi

# Check it contains the index in a code block
if grep -q '```' "$ORK_CLAUDE_MD" && grep -q "Agent Routing Index" "$ORK_CLAUDE_MD"; then
    pass "CLAUDE.md contains index in code block"
else
    fail "CLAUDE.md missing index code block"
fi

# Check it has the retrieval instruction outside the code block
if head -5 "$ORK_CLAUDE_MD" | grep -qi "retrieval-led reasoning"; then
    pass "CLAUDE.md has retrieval instruction in prose"
else
    fail "CLAUDE.md missing retrieval instruction in prose"
fi

# Verify agent count matches between index and CLAUDE.md
INDEX_AGENT_COUNT=$(grep -cE "^\|[a-z][a-z0-9-]+:" "$ORK_INDEX" || true)
CLAUDE_MD_AGENT_COUNT=$(grep -cE "^\|[a-z][a-z0-9-]+:" "$ORK_CLAUDE_MD" || true)

if [[ "$INDEX_AGENT_COUNT" -eq "$CLAUDE_MD_AGENT_COUNT" ]]; then
    pass "Agent count matches: $INDEX_AGENT_COUNT in both files"
else
    fail "Agent count mismatch: index=$INDEX_AGENT_COUNT, CLAUDE.md=$CLAUDE_MD_AGENT_COUNT"
fi

echo ""

# ============================================================================
# Test 5: Tier 2 skill index format
# ============================================================================
echo "▶ Test 5: Tier 2 skill index format"
echo "──────────────────────────────────────"

SKILL_INDEX="$PLUGINS_DIR/ork/.claude-plugin/skill-indexes/frontend-ui-developer.md"

if [[ -f "$SKILL_INDEX" ]]; then
    pass "Tier 2 skill index exists"
else
    fail "Tier 2 skill index missing"
    exit 1
fi

# Check for |root: ./skills directive
if grep -q "|root: ./skills" "$SKILL_INDEX"; then
    pass "Tier 2 has |root: ./skills directive"
else
    fail "Tier 2 missing |root: directive"
fi

# Check for retrieval instruction
if grep -qi "Do NOT rely on training data" "$SKILL_INDEX"; then
    pass "Tier 2 has retrieval instruction"
else
    fail "Tier 2 missing retrieval instruction"
fi

# Check skill entry format |skill:{SKILL.md,references/{...}}|tags
if grep -qE "^\|[a-z][a-z0-9-]+:\{SKILL\.md" "$SKILL_INDEX"; then
    pass "Tier 2 has proper skill entry format"
else
    fail "Tier 2 missing proper skill entry format"
fi

echo ""

# ============================================================================
# Test 6: Pipe-delimited compression ratio
# ============================================================================
echo "▶ Test 6: Compression efficiency"
echo "──────────────────────────────────────"

INDEX_SIZE=$(wc -c < "$ORK_INDEX" | tr -d ' ')
INDEX_LINES=$(wc -l < "$ORK_INDEX" | tr -d ' ')
AGENT_COUNT=$(grep -cE "^\|[a-z][a-z0-9-]+:" "$ORK_INDEX" || true)

# Calculate bytes per agent
BYTES_PER_AGENT=$((INDEX_SIZE / AGENT_COUNT))

if [[ "$BYTES_PER_AGENT" -lt 200 ]]; then
    pass "Compression: $BYTES_PER_AGENT bytes/agent (excellent, <200)"
elif [[ "$BYTES_PER_AGENT" -lt 300 ]]; then
    pass "Compression: $BYTES_PER_AGENT bytes/agent (good, <300)"
else
    fail "Compression: $BYTES_PER_AGENT bytes/agent (poor, should be <300)"
fi

# Verify total budget (Vercel suggests ~8KB for ~40KB of docs = 80% reduction)
if [[ "$INDEX_SIZE" -lt 8192 ]]; then
    pass "Total size: $INDEX_SIZE bytes (within 8KB budget)"
else
    fail "Total size: $INDEX_SIZE bytes (exceeds 8KB budget)"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "=========================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT Vercel format tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All Vercel format contract tests passed${NC}"
    exit 0
fi
