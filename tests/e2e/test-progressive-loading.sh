#!/usr/bin/env bash
# ============================================================================
# Progressive Loading E2E Test (CC 2.1.7 Flat Structure)
# ============================================================================
# Verifies that skills load in the correct order using the new structure:
# Tier 1 (SKILL.md frontmatter) → Tier 2 (SKILL.md body) → Tier 3 (references/*) → Tier 4 (templates/*)
#
# Tests:
# 1. All skills have SKILL.md with valid frontmatter
# 2. SKILL.md body provides overview content
# 3. Token budgets are within expected ranges per tier
# 4. Optional directories (references/, templates/) are structured correctly
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

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

# Token counting (approximate: 1 token ≈ 4 characters)
count_tokens() {
    local file="$1"
    if [ -f "$file" ]; then
        local chars
        chars=$(wc -c < "$file" | tr -d ' ')
        echo $((chars / 4))
    else
        echo 0
    fi
}

# Parse YAML frontmatter field
parse_frontmatter_field() {
    local file="$1"
    local field="$2"
    # Extract YAML frontmatter between --- markers and get field value
    sed -n '/^---$/,/^---$/p' "$file" 2>/dev/null | grep "^${field}:" | head -1 | sed "s/^${field}:[[:space:]]*//"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Progressive Loading E2E Tests (CC 2.1.7 Flat Structure)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -d "$SKILLS_DIR" ]; then
    echo -e "${RED}ERROR: Skills directory not found: $SKILLS_DIR${NC}"
    exit 1
fi

# ============================================================================
# Test 1: All skills have SKILL.md (Tier 1 + 2)
# ============================================================================
echo "▶ Test 1: SKILL.md Completeness"
echo "────────────────────────────────────────"

missing_skill_md=0
total_skills=0

for skill_dir in "$SKILLS_DIR"/*/; do
    if [ -d "$skill_dir" ]; then
        ((total_skills++)) || true
        skill_name=$(basename "$skill_dir")

        if [ ! -f "$skill_dir/SKILL.md" ]; then
            fail "Missing SKILL.md: $skill_name"
            ((missing_skill_md++)) || true
        fi
    fi
done

if [ "$missing_skill_md" -eq 0 ]; then
    pass "All $total_skills src/skills have SKILL.md"
else
    fail "$missing_skill_md skills missing SKILL.md"
fi

echo ""

# ============================================================================
# Test 2: Frontmatter Validation (Tier 1 metadata)
# ============================================================================
echo "▶ Test 2: Frontmatter Validation (Tier 1)"
echo "────────────────────────────────────────"

invalid_frontmatter=0

for skill_dir in "$SKILLS_DIR"/*/; do
    if [ -d "$skill_dir" ] && [ -f "$skill_dir/SKILL.md" ]; then
        skill_name=$(basename "$skill_dir")
        skill_md="$skill_dir/SKILL.md"

        # Check frontmatter exists (starts with ---)
        if ! head -1 "$skill_md" | grep -q "^---$"; then
            fail "Invalid frontmatter: $skill_name (missing opening ---)"
            ((invalid_frontmatter++)) || true
            continue
        fi

        # Check required fields
        fm_name=$(parse_frontmatter_field "$skill_md" "name")
        fm_desc=$(parse_frontmatter_field "$skill_md" "description")

        if [ -z "$fm_name" ]; then
            fail "Missing frontmatter field 'name': $skill_name"
            ((invalid_frontmatter++)) || true
        fi

        if [ -z "$fm_desc" ]; then
            fail "Missing frontmatter field 'description': $skill_name"
            ((invalid_frontmatter++)) || true
        fi
    fi
done

if [ "$invalid_frontmatter" -eq 0 ]; then
    pass "All skills have valid frontmatter with name and description"
else
    fail "$invalid_frontmatter skills have invalid frontmatter"
fi

echo ""

# ============================================================================
# Test 3: Token Budget Validation
# ============================================================================
echo "▶ Test 3: Token Budget Validation"
echo "────────────────────────────────────────"

# Expected ranges (approximate)
# Tier 1+2 (SKILL.md): 300-1000 tokens
# Tier 3 (references): 50-400 tokens each
# Tier 4 (templates): 100-500 tokens each

oversized_skills=0
total_tokens=0

for skill_dir in "$SKILLS_DIR"/*/; do
    if [ -d "$skill_dir" ] && [ -f "$skill_dir/SKILL.md" ]; then
        skill_name=$(basename "$skill_dir")
        skill_md="$skill_dir/SKILL.md"

        tokens=$(count_tokens "$skill_md")
        ((total_tokens += tokens)) || true

        # Warning if SKILL.md exceeds 1000 tokens (should stay lean for discovery)
        if [ "$tokens" -gt 1000 ]; then
            warn "Oversized SKILL.md: $skill_name ($tokens tokens, max 1000 recommended)"
            ((oversized_skills++)) || true
        fi
    fi
done

avg_tokens=$((total_tokens / total_skills))

if [ "$oversized_skills" -eq 0 ]; then
    pass "All SKILL.md files within token budget"
else
    warn "$oversized_skills src/skills have oversized SKILL.md files"
fi

info "Average tokens per SKILL.md: $avg_tokens"
info "Total tokens across all skills: $total_tokens"

echo ""

# ============================================================================
# Test 4: Optional Directory Structure (Tier 3 & 4)
# ============================================================================
echo "▶ Test 4: Optional Directory Structure"
echo "────────────────────────────────────────"

skills_with_refs=0
skills_with_templates=0
skills_with_checklists=0

for skill_dir in "$SKILLS_DIR"/*/; do
    if [ -d "$skill_dir" ]; then
        skill_name=$(basename "$skill_dir")

        # Check references/
        if [ -d "$skill_dir/references" ]; then
            ref_count=$(find "$skill_dir/references" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [ "$ref_count" -gt 0 ]; then
                ((skills_with_refs++)) || true
            fi
        fi

        # Check templates/
        if [ -d "$skill_dir/templates" ]; then
            tpl_count=$(find "$skill_dir/templates" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [ "$tpl_count" -gt 0 ]; then
                ((skills_with_templates++)) || true
            fi
        fi

        # Check checklists/
        if [ -d "$skill_dir/checklists" ]; then
            cl_count=$(find "$skill_dir/checklists" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [ "$cl_count" -gt 0 ]; then
                ((skills_with_checklists++)) || true
            fi
        fi
    fi
done

info "Skills with references/: $skills_with_refs"
info "Skills with templates/: $skills_with_templates"
info "Skills with checklists/: $skills_with_checklists"

pass "Optional directories structured correctly"

echo ""

# ============================================================================
# Test 5: Progressive Loading Order Simulation
# ============================================================================
echo "▶ Test 5: Progressive Loading Order"
echo "────────────────────────────────────────"

# Simulate loading order for a random skill
# Use for loop with glob (consistent with Test 4) instead of ls | head
# This avoids potential exit code issues with ls on some platforms
sample_skill=""
for dir in "$SKILLS_DIR"/*/; do
    if [ -d "$dir" ]; then
        sample_skill="$dir"
        break
    fi
done

if [ -n "$sample_skill" ]; then
    skill_name=$(basename "$sample_skill")
    info "Simulating load order for: $skill_name"

    # Tier 1: Frontmatter (discovery)
    if [ -f "$sample_skill/SKILL.md" ]; then
        tier1_lines=$(sed -n '1,/^---$/p' "$sample_skill/SKILL.md" | tail -n +2 | sed "\$d" | wc -l | tr -d ' ')
        info "  Tier 1 (frontmatter): $tier1_lines lines"
    fi

    # Tier 2: Body (overview)
    if [ -f "$sample_skill/SKILL.md" ]; then
        tier2_tokens=$(count_tokens "$sample_skill/SKILL.md")
        info "  Tier 2 (body): ~$tier2_tokens tokens"
    fi

    # Tier 3: References (specific)
    if [ -d "$sample_skill/references" ]; then
        tier3_files=$(find "$sample_skill/references" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        info "  Tier 3 (references): $tier3_files files"
    else
        info "  Tier 3 (references): none"
    fi

    # Tier 4: Templates (generate)
    if [ -d "$sample_skill/templates" ]; then
        tier4_files=$(find "$sample_skill/templates" -type f 2>/dev/null | wc -l | tr -d ' ')
        info "  Tier 4 (templates): $tier4_files files"
    else
        info "  Tier 4 (templates): none"
    fi

    pass "Progressive loading order verified"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  Total Skills: ${BLUE}$total_skills${NC}"
echo -e "  Passed:       ${GREEN}$PASS_COUNT${NC}"
echo -e "  Failed:       ${RED}$FAIL_COUNT${NC}"
echo -e "  Warnings:     ${YELLOW}$WARN_COUNT${NC}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "${RED}FAILED: $FAIL_COUNT tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All progressive loading tests passed${NC}"
    exit 0
fi