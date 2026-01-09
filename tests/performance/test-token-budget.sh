#!/usr/bin/env bash
# ============================================================================
# Token Budget Validation Test
# ============================================================================
# Verifies that all content stays within token budget limits.
# Uses relaxed limits that are informational rather than strict failures.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"
CONTEXT_DIR="$PROJECT_ROOT/.claude/context"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARN_COUNT++)) || true; }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

# Token limits per tier (relaxed - informational warnings, not hard failures)
TIER1_LIMIT=500     # capabilities.json should be < 500 tokens
TIER2_LIMIT=1500    # SKILL.md should be < 1500 tokens
TIER3_LIMIT=800     # references/*.md should be < 800 tokens each
TIER4_LIMIT=1000    # templates/* should be < 1000 tokens each
CONTEXT_LIMIT=1000  # context files should be < 1000 tokens
TOTAL_BUDGET=5000   # Total budget for typical session

# Token counting (approximate: 1 token ≈ 4 characters for English text)
count_tokens() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo 0
        return
    fi
    local chars
    chars=$(wc -c < "$file" | tr -d ' ')
    echo $((chars / 4))
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Token Budget Validation Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Recommended Limits (warnings if exceeded):"
echo "  - Tier 1 (capabilities.json): < $TIER1_LIMIT tokens"
echo "  - Tier 2 (SKILL.md): < $TIER2_LIMIT tokens"
echo "  - Tier 3 (references/*.md): < $TIER3_LIMIT tokens each"
echo "  - Tier 4 (templates/*): < $TIER4_LIMIT tokens each"
echo "  - Total context: < $TOTAL_BUDGET tokens"
echo ""

# ============================================================================
# Test 1: Tier 1 Token Budgets
# ============================================================================
echo "▶ Test 1: Tier 1 Token Budgets (capabilities.json)"
echo "────────────────────────────────────────"

tier1_total=0
tier1_over=0
tier1_max=0
tier1_max_skill=""
skill_count=0

for skill_dir in "$SKILLS_DIR"/*; do
    if [ -d "$skill_dir" ] && [ -f "$skill_dir/capabilities.json" ]; then
        skill_name=$(basename "$skill_dir")
        tokens=$(count_tokens "$skill_dir/capabilities.json")
        tier1_total=$((tier1_total + tokens))
        ((skill_count++)) || true

        if [ "$tokens" -gt "$tier1_max" ]; then
            tier1_max=$tokens
            tier1_max_skill=$skill_name
        fi

        if [ "$tokens" -gt "$TIER1_LIMIT" ]; then
            warn "$skill_name: $tokens tokens (recommended: <$TIER1_LIMIT)"
            ((tier1_over++)) || true
        fi
    fi
done

if [ "$tier1_over" -eq 0 ]; then
    pass "All Tier 1 files within recommended budget"
else
    info "$tier1_over Tier 1 files exceed recommended size (non-blocking)"
fi
info "Tier 1 total: ~$tier1_total tokens, max: $tier1_max ($tier1_max_skill)"
pass "Tier 1 analysis complete"

echo ""

# ============================================================================
# Test 2: Tier 2 Token Budgets
# ============================================================================
echo "▶ Test 2: Tier 2 Token Budgets (SKILL.md)"
echo "────────────────────────────────────────"

tier2_total=0
tier2_over=0
tier2_max=0
tier2_max_skill=""

for skill_dir in "$SKILLS_DIR"/*; do
    if [ -d "$skill_dir" ] && [ -f "$skill_dir/SKILL.md" ]; then
        skill_name=$(basename "$skill_dir")
        tokens=$(count_tokens "$skill_dir/SKILL.md")
        tier2_total=$((tier2_total + tokens))

        if [ "$tokens" -gt "$tier2_max" ]; then
            tier2_max=$tokens
            tier2_max_skill=$skill_name
        fi

        if [ "$tokens" -gt "$TIER2_LIMIT" ]; then
            warn "$skill_name: $tokens tokens (recommended: <$TIER2_LIMIT)"
            ((tier2_over++)) || true
        fi
    fi
done

if [ "$tier2_over" -eq 0 ]; then
    pass "All Tier 2 files within recommended budget"
else
    info "$tier2_over Tier 2 files exceed recommended size (non-blocking)"
fi
info "Tier 2 total: ~$tier2_total tokens, max: $tier2_max ($tier2_max_skill)"
pass "Tier 2 analysis complete"

echo ""

# ============================================================================
# Test 3: Tier 3 Token Budgets
# ============================================================================
echo "▶ Test 3: Tier 3 Token Budgets (references/*.md)"
echo "────────────────────────────────────────"

tier3_total=0
tier3_over=0
tier3_file_count=0

for skill_dir in "$SKILLS_DIR"/*; do
    if [ -d "$skill_dir/references" ]; then
        for ref_file in "$skill_dir/references"/*.md; do
            if [ -f "$ref_file" ]; then
                ((tier3_file_count++)) || true
                tokens=$(count_tokens "$ref_file")
                tier3_total=$((tier3_total + tokens))

                if [ "$tokens" -gt "$TIER3_LIMIT" ]; then
                    skill_name=$(basename "$skill_dir")
                    ref_name=$(basename "$ref_file")
                    warn "$skill_name/$ref_name: $tokens tokens (recommended: <$TIER3_LIMIT)"
                    ((tier3_over++)) || true
                fi
            fi
        done
    fi
done

if [ "$tier3_file_count" -eq 0 ]; then
    info "No Tier 3 files found"
elif [ "$tier3_over" -eq 0 ]; then
    pass "All $tier3_file_count Tier 3 files within recommended budget"
else
    info "$tier3_over Tier 3 files exceed recommended size (non-blocking)"
fi
info "Tier 3 total: ~$tier3_total tokens across $tier3_file_count files"
pass "Tier 3 analysis complete"

echo ""

# ============================================================================
# Test 4: Context Files Token Budgets
# ============================================================================
echo "▶ Test 4: Context Files Token Budgets"
echo "────────────────────────────────────────"

context_total=0

# Identity context
if [ -f "$CONTEXT_DIR/identity.json" ]; then
    tokens=$(count_tokens "$CONTEXT_DIR/identity.json")
    context_total=$((context_total + tokens))
    if [ "$tokens" -gt "$CONTEXT_LIMIT" ]; then
        warn "identity.json: $tokens tokens (recommended: <$CONTEXT_LIMIT)"
    else
        pass "identity.json: $tokens tokens"
    fi
fi

# Session state
if [ -f "$CONTEXT_DIR/session/state.json" ]; then
    tokens=$(count_tokens "$CONTEXT_DIR/session/state.json")
    context_total=$((context_total + tokens))
    if [ "$tokens" -gt "$CONTEXT_LIMIT" ]; then
        warn "session/state.json: $tokens tokens (recommended: <$CONTEXT_LIMIT)"
    else
        pass "session/state.json: $tokens tokens"
    fi
fi

# Knowledge index
if [ -f "$CONTEXT_DIR/knowledge/index.json" ]; then
    tokens=$(count_tokens "$CONTEXT_DIR/knowledge/index.json")
    context_total=$((context_total + tokens))
    info "knowledge/index.json: $tokens tokens"
fi

pass "Context analysis complete"

echo ""

# ============================================================================
# Test 5: Total Context Budget Simulation
# ============================================================================
echo "▶ Test 5: Total Context Budget Simulation"
echo "────────────────────────────────────────"

# Simulate loading:
# - Context files
# - 5 skills (Tier 1 only for discovery)
# - 2 skills (Tier 2 for active use)

if [ "$skill_count" -gt 0 ]; then
    avg_tier1=$((tier1_total / skill_count))
    avg_tier2=$((tier2_total / skill_count))
else
    avg_tier1=0
    avg_tier2=0
fi

DISCOVERY_SKILLS=5
ACTIVE_SKILLS=2

simulated_load=$((
    context_total +
    (avg_tier1 * DISCOVERY_SKILLS) +
    (avg_tier2 * ACTIVE_SKILLS)
))

echo "  Simulation:"
echo "  - Context files: ~$context_total tokens"
echo "  - Discovery ($DISCOVERY_SKILLS skills × ~$avg_tier1): ~$((DISCOVERY_SKILLS * avg_tier1)) tokens"
echo "  - Active use ($ACTIVE_SKILLS skills × ~$avg_tier2): ~$((ACTIVE_SKILLS * avg_tier2)) tokens"
echo "  ────────────────────────────────"
echo "  - Total simulated: ~$simulated_load tokens"
echo ""

if [ "$simulated_load" -lt "$TOTAL_BUDGET" ]; then
    pass "Simulated load within budget ($simulated_load < $TOTAL_BUDGET)"
else
    warn "Simulated load exceeds recommended budget ($simulated_load > $TOTAL_BUDGET)"
    info "Consider optimizing large skills or reducing context"
fi

# Calculate headroom
headroom=$((TOTAL_BUDGET - simulated_load))
if [ "$headroom" -gt 0 ]; then
    headroom_pct=$((headroom * 100 / TOTAL_BUDGET))
    info "Budget headroom: ~$headroom tokens ($headroom_pct%)"
fi

pass "Budget simulation complete"

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Token Budget Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "  %-20s %10s %10s\n" "Tier" "Total" "Files"
printf "  %-20s %10s %10s\n" "────────────────────" "──────────" "──────────"
printf "  %-20s %10s %10s\n" "Tier 1 (caps.json)" "~$tier1_total" "$skill_count"
printf "  %-20s %10s %10s\n" "Tier 2 (SKILL.md)" "~$tier2_total" "$skill_count"
printf "  %-20s %10s %10s\n" "Tier 3 (refs)" "~$tier3_total" "$tier3_file_count"
printf "  %-20s %10s %10s\n" "Context" "~$context_total" "-"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Token budget tests are informational - don't fail the build
exit 0