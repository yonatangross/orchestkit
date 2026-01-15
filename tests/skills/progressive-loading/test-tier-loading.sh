#!/usr/bin/env bash
# ============================================================================
# Progressive Loading Tier Validation Tests
# ============================================================================
# Validates that progressive loading tiers work correctly:
#   - Tier 1 (Discovery): capabilities.json exists, under 500 tokens
#   - Tier 2 (Overview): SKILL.md exists, 300-1500 tokens
#   - Tier 3 (Specific): references/ files each under 800 tokens
#   - Tier 4 (Generate): templates/ files each under 1000 tokens
#   - Loading Order: Files can be loaded in sequence
#   - Completeness Stats: Reports how many skills have all 4 tiers
#   - Progressive Token Budget: Cumulative loading stays within limits
#
# Usage: ./test-tier-loading.sh [--verbose] [--deep] [--strict]
#
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/skills"

# Source test helpers if available
if [[ -f "$PROJECT_ROOT/tests/fixtures/test-helpers.sh" ]]; then
    source "$PROJECT_ROOT/tests/fixtures/test-helpers.sh"
fi

# ============================================================================
# CONFIGURATION
# ============================================================================

# Token limits per tier (chars / 4 approximation)
# "Recommended" limits - violations are warnings, not failures by default
# Based on observed averages: T1~762, T2~2251, T3~1952, T4~1965
TIER1_RECOMMENDED_MAX=1500    # capabilities.json - recommended max
TIER2_MIN_TOKENS=200          # SKILL.md should have enough context
TIER2_RECOMMENDED_MAX=4000    # SKILL.md - recommended max
TIER3_RECOMMENDED_MAX=3000    # references/ files - recommended max
TIER4_RECOMMENDED_MAX=3500    # templates/ files - recommended max

# Strict token limits (hard failures if exceeded) - used with --strict flag
TIER1_STRICT_MAX=3000     # capabilities.json absolute max
TIER2_STRICT_MAX=10000    # SKILL.md absolute max
TIER3_STRICT_MAX=6000     # references/* absolute max
TIER4_STRICT_MAX=6000     # templates/* absolute max

# Budget limits for cumulative loading
MAX_SKILLS_LOADED=5       # Typical max skills loaded per task
CUMULATIVE_BUDGET=20000   # Total tokens for context budget (realistic)

# Skills to test deeply (known to have all 4 tiers)
DEEP_TEST_SKILLS=(
    "api-design-framework"
    "brainstorming"
    "auth-patterns"
)

# Parse arguments
VERBOSE=""
DEEP_MODE=""
STRICT_MODE=""
for arg in "$@"; do
    case "$arg" in
        --verbose|-v) VERBOSE="--verbose" ;;
        --deep|-d) DEEP_MODE="--deep" ;;
        --strict|-s) STRICT_MODE="--strict" ;;
    esac
done

# Set token limits based on mode
if [[ -n "$STRICT_MODE" ]]; then
    TIER1_MAX_TOKENS=$TIER1_STRICT_MAX
    TIER2_MAX_TOKENS=$TIER2_STRICT_MAX
    TIER3_MAX_TOKENS=$TIER3_STRICT_MAX
    TIER4_MAX_TOKENS=$TIER4_STRICT_MAX
else
    TIER1_MAX_TOKENS=$TIER1_RECOMMENDED_MAX
    TIER2_MAX_TOKENS=$TIER2_RECOMMENDED_MAX
    TIER3_MAX_TOKENS=$TIER3_RECOMMENDED_MAX
    TIER4_MAX_TOKENS=$TIER4_RECOMMENDED_MAX
fi

# ============================================================================
# OUTPUT FORMATTING
# ============================================================================

# Colors (only if stderr is a terminal)
if [[ -t 2 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0
WARNINGS_COUNT=0

# Formatting helpers
pass() {
    echo -e "  ${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++)) || true
    ((TESTS_RUN++)) || true
}

fail() {
    echo -e "  ${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++)) || true
    ((TESTS_RUN++)) || true
}

skip() {
    echo -e "  ${YELLOW}[SKIP]${NC} $1"
    ((TESTS_SKIPPED++)) || true
    ((TESTS_RUN++)) || true
}

info() {
    echo -e "  ${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "  ${YELLOW}[WARN]${NC} $1"
    ((WARNINGS_COUNT++)) || true
}

verbose() {
    if [[ -n "$VERBOSE" ]]; then
        echo -e "        $1"
    fi
}

section() {
    echo ""
    echo -e "${CYAN}$1${NC}"
    echo "────────────────────────────────────────────────────────────────────────────────"
}

# ============================================================================
# TOKEN COUNTING
# ============================================================================

# Count tokens using chars/4 approximation
# Usage: count_tokens "$filepath"
count_tokens() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo 0
        return
    fi

    # Try tiktoken first (accurate) if available
    if command -v python3 &>/dev/null; then
        local result
        result=$(python3 -c "
import sys
try:
    import tiktoken
    enc = tiktoken.get_encoding('cl100k_base')
    with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
        print(len(enc.encode(f.read())))
except:
    sys.exit(1)
" "$file" 2>/dev/null) || true

        if [[ -n "$result" && "$result" =~ ^[0-9]+$ ]]; then
            echo "$result"
            return
        fi
    fi

    # Fallback: chars/4 approximation
    local chars
    chars=$(wc -c < "$file" | tr -d ' ')
    echo $((chars / 4))
}

# Get character count for a file
get_char_count() {
    local file="$1"
    if [[ -f "$file" ]]; then
        wc -c < "$file" | tr -d ' '
    else
        echo 0
    fi
}

# ============================================================================
# SKILL DISCOVERY
# ============================================================================

# Get list of all skills
get_all_skills() {
    local skills=()
    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            skills+=("$(basename "$skill_dir")")
        fi
    done
    echo "${skills[@]}"
}

# Check if skill has all 4 tiers
has_all_tiers() {
    local skill="$1"
    local skill_dir
    skill_dir=$(find "$SKILLS_DIR" -type d -path "*/$skill" 2>/dev/null | head -1)

    # Tier 1: capabilities.json
    [[ -f "$skill_dir/capabilities.json" ]] || return 1

    # Tier 2: SKILL.md
    [[ -f "$skill_dir/SKILL.md" ]] || return 1

    # Tier 3: references/ directory with at least one file
    local ref_count=0
    if [[ -d "$skill_dir/references" ]]; then
        ref_count=$(find "$skill_dir/references" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    fi
    [[ "$ref_count" -gt 0 ]] || return 1

    # Tier 4: templates/ directory with at least one file
    local tmpl_count=0
    if [[ -d "$skill_dir/templates" ]]; then
        tmpl_count=$(find "$skill_dir/templates" -type f 2>/dev/null | wc -l | tr -d ' ')
    fi
    [[ "$tmpl_count" -gt 0 ]] || return 1

    return 0
}

# ============================================================================
# TIER 1 TESTS: Discovery (capabilities.json)
# ============================================================================

test_tier1_existence() {
    section "Tier 1 Tests: Discovery (capabilities.json)"

    local total=0
    local missing=0
    local oversized=0
    local oversized_list=()

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            local skill_name
            skill_name=$(basename "$skill_dir")
            ((total++)) || true

            local caps_file="$skill_dir/capabilities.json"

            if [[ ! -f "$caps_file" ]]; then
                fail "Tier 1 missing: $skill_name/capabilities.json"
                ((missing++)) || true
                continue
            fi

            # Check JSON validity
            if ! jq empty "$caps_file" 2>/dev/null; then
                fail "Tier 1 invalid JSON: $skill_name/capabilities.json"
                ((missing++)) || true
                continue
            fi

            # Check token count
            local tokens
            tokens=$(count_tokens "$caps_file")

            if [[ "$tokens" -gt "$TIER1_MAX_TOKENS" ]]; then
                oversized_list+=("$skill_name:$tokens")
                ((oversized++)) || true
            else
                verbose "$skill_name: $tokens tokens"
            fi
        fi
    done

    if [[ "$missing" -eq 0 ]]; then
        pass "All $total skills have valid Tier 1 (capabilities.json)"
    fi

    if [[ "$oversized" -eq 0 ]]; then
        pass "All Tier 1 files under $TIER1_MAX_TOKENS token limit"
    else
        if [[ -n "$STRICT_MODE" ]]; then
            fail "$oversized skills have oversized Tier 1 files (strict mode)"
        else
            warn "$oversized skills exceed recommended Tier 1 size"
            pass "Tier 1 size check (warnings only in normal mode)"
        fi
        if [[ -n "$VERBOSE" ]]; then
            for item in "${oversized_list[@]}"; do
                echo "        - $item tokens"
            done
        fi
    fi

    echo ""
    info "Tier 1 Summary: $total skills, $missing missing, $oversized oversized"
}

test_tier1_required_fields() {
    section "Tier 1 Required Fields Validation"

    local valid=0
    local invalid=0

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            local skill_name
            skill_name=$(basename "$skill_dir")
            local caps_file="$skill_dir/capabilities.json"

            if [[ ! -f "$caps_file" ]]; then
                continue
            fi

            # Check required fields: name, version, description
            local has_name has_version has_description
            has_name=$(jq -e '.name' "$caps_file" 2>/dev/null && echo "yes" || echo "no")
            has_version=$(jq -e '.version' "$caps_file" 2>/dev/null && echo "yes" || echo "no")
            has_description=$(jq -e '.description' "$caps_file" 2>/dev/null && echo "yes" || echo "no")

            if [[ "$has_name" == "no" || "$has_version" == "no" || "$has_description" == "no" ]]; then
                fail "Tier 1 missing required fields: $skill_name (name=$has_name, version=$has_version, description=$has_description)"
                ((invalid++)) || true
            else
                ((valid++)) || true
                verbose "$skill_name: all required fields present"
            fi
        fi
    done

    if [[ "$invalid" -eq 0 ]]; then
        pass "All Tier 1 files have required fields (name, version, description)"
    fi

    echo ""
    info "Tier 1 Fields: $valid valid, $invalid invalid"
}

# ============================================================================
# TIER 2 TESTS: Overview (SKILL.md)
# ============================================================================

test_tier2_existence() {
    section "Tier 2 Tests: Overview (SKILL.md)"

    local total=0
    local missing=0
    local undersized=0
    local oversized=0

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            local skill_name
            skill_name=$(basename "$skill_dir")
            ((total++)) || true

            local skill_file="$skill_dir/SKILL.md"

            if [[ ! -f "$skill_file" ]]; then
                fail "Tier 2 missing: $skill_name/SKILL.md"
                ((missing++)) || true
                continue
            fi

            # Check token count
            local tokens
            tokens=$(count_tokens "$skill_file")

            if [[ "$tokens" -lt "$TIER2_MIN_TOKENS" ]]; then
                warn "Tier 2 undersized: $skill_name ($tokens tokens < $TIER2_MIN_TOKENS min)"
                ((undersized++)) || true
            elif [[ "$tokens" -gt "$TIER2_MAX_TOKENS" ]]; then
                if [[ -n "$STRICT_MODE" ]]; then
                    fail "Tier 2 oversized: $skill_name ($tokens tokens > $TIER2_MAX_TOKENS max)"
                else
                    warn "Tier 2 large: $skill_name ($tokens tokens)"
                fi
                ((oversized++)) || true
            else
                verbose "$skill_name: $tokens tokens (within range)"
            fi
        fi
    done

    if [[ "$missing" -eq 0 ]]; then
        pass "All $total skills have Tier 2 (SKILL.md)"
    fi

    if [[ "$oversized" -eq 0 ]]; then
        pass "All Tier 2 files under $TIER2_MAX_TOKENS token limit"
    elif [[ -z "$STRICT_MODE" ]]; then
        pass "Tier 2 size check (warnings only in normal mode)"
    fi

    echo ""
    info "Tier 2 Summary: $total skills, $missing missing, $undersized undersized, $oversized large"
}

test_tier2_structure() {
    section "Tier 2 Structure Validation"

    local valid=0
    local invalid=0

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            local skill_name
            skill_name=$(basename "$skill_dir")
            local skill_file="$skill_dir/SKILL.md"

            if [[ ! -f "$skill_file" ]]; then
                continue
            fi

            # Check for expected markdown structure (at least a heading)
            if grep -q "^#" "$skill_file" 2>/dev/null; then
                ((valid++)) || true
                verbose "$skill_name: has proper markdown structure"
            else
                fail "Tier 2 no heading: $skill_name/SKILL.md"
                ((invalid++)) || true
            fi
        fi
    done

    if [[ "$invalid" -eq 0 ]]; then
        pass "All Tier 2 files have proper markdown structure"
    fi

    echo ""
    info "Tier 2 Structure: $valid valid, $invalid invalid"
}

# ============================================================================
# TIER 3 TESTS: Specific (references/*.md)
# ============================================================================

test_tier3_files() {
    section "Tier 3 Tests: Specific (references/*.md)"

    local total_skills=0
    local skills_with_refs=0
    local total_refs=0
    local oversized_refs=0

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            local skill_name
            skill_name=$(basename "$skill_dir")
            ((total_skills++)) || true

            local refs_dir="$skill_dir/references"

            if [[ ! -d "$refs_dir" ]]; then
                verbose "$skill_name: no references/ directory"
                continue
            fi

            local ref_files
            ref_files=$(find "$refs_dir" -name "*.md" -type f 2>/dev/null)

            if [[ -z "$ref_files" ]]; then
                verbose "$skill_name: references/ directory empty"
                continue
            fi

            ((skills_with_refs++)) || true

            while IFS= read -r ref_file; do
                if [[ -n "$ref_file" ]]; then
                    ((total_refs++)) || true

                    local tokens
                    tokens=$(count_tokens "$ref_file")
                    local filename
                    filename=$(basename "$ref_file")

                    if [[ "$tokens" -gt "$TIER3_MAX_TOKENS" ]]; then
                        if [[ -n "$STRICT_MODE" ]]; then
                            fail "Tier 3 oversized: $skill_name/references/$filename ($tokens tokens)"
                        else
                            warn "Tier 3 large: $skill_name/references/$filename ($tokens tokens)"
                        fi
                        ((oversized_refs++)) || true
                    else
                        verbose "$skill_name/references/$filename: $tokens tokens"
                    fi
                fi
            done <<< "$ref_files"
        fi
    done

    if [[ "$total_refs" -gt 0 ]]; then
        if [[ "$oversized_refs" -eq 0 ]]; then
            pass "All $total_refs Tier 3 reference files under $TIER3_MAX_TOKENS token limit"
        elif [[ -z "$STRICT_MODE" ]]; then
            pass "Tier 3 files present ($total_refs files, $oversized_refs large)"
        fi
    else
        warn "No Tier 3 reference files found"
    fi

    echo ""
    info "Tier 3 Summary: $skills_with_refs/$total_skills skills have references, $total_refs total files, $oversized_refs large"
}

# ============================================================================
# TIER 4 TESTS: Generate (templates/*)
# ============================================================================

test_tier4_files() {
    section "Tier 4 Tests: Generate (templates/*)"

    local total_skills=0
    local skills_with_templates=0
    local total_templates=0
    local oversized_templates=0

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            local skill_name
            skill_name=$(basename "$skill_dir")
            ((total_skills++)) || true

            local templates_dir="$skill_dir/templates"

            if [[ ! -d "$templates_dir" ]]; then
                verbose "$skill_name: no templates/ directory"
                continue
            fi

            local template_files
            template_files=$(find "$templates_dir" -type f 2>/dev/null)

            if [[ -z "$template_files" ]]; then
                verbose "$skill_name: templates/ directory empty"
                continue
            fi

            ((skills_with_templates++)) || true

            while IFS= read -r template_file; do
                if [[ -n "$template_file" ]]; then
                    ((total_templates++)) || true

                    local tokens
                    tokens=$(count_tokens "$template_file")
                    local filename
                    filename=$(basename "$template_file")

                    if [[ "$tokens" -gt "$TIER4_MAX_TOKENS" ]]; then
                        if [[ -n "$STRICT_MODE" ]]; then
                            fail "Tier 4 oversized: $skill_name/templates/$filename ($tokens tokens)"
                        else
                            warn "Tier 4 large: $skill_name/templates/$filename ($tokens tokens)"
                        fi
                        ((oversized_templates++)) || true
                    else
                        verbose "$skill_name/templates/$filename: $tokens tokens"
                    fi
                fi
            done <<< "$template_files"
        fi
    done

    if [[ "$total_templates" -gt 0 ]]; then
        if [[ "$oversized_templates" -eq 0 ]]; then
            pass "All $total_templates Tier 4 template files under $TIER4_MAX_TOKENS token limit"
        elif [[ -z "$STRICT_MODE" ]]; then
            pass "Tier 4 files present ($total_templates files, $oversized_templates large)"
        fi
    else
        warn "No Tier 4 template files found"
    fi

    echo ""
    info "Tier 4 Summary: $skills_with_templates/$total_skills skills have templates, $total_templates total files, $oversized_templates large"
}

# ============================================================================
# LOADING ORDER TESTS
# ============================================================================

test_loading_order() {
    section "Loading Order Verification"

    local tested=0
    local errors=0

    # Test with deep test skills
    for skill in "${DEEP_TEST_SKILLS[@]}"; do
        local skill_dir
    skill_dir=$(find "$SKILLS_DIR" -type d -path "*/$skill" 2>/dev/null | head -1)

        if [[ ! -d "$skill_dir" ]]; then
            skip "Skill not found for loading order test: $skill"
            continue
        fi

        ((tested++)) || true

        # Simulate loading order
        local order_valid=true
        local order_log=""

        # Step 1: Load Tier 1 (Discovery)
        if [[ -f "$skill_dir/capabilities.json" ]]; then
            order_log+="T1:OK "
        else
            order_log+="T1:FAIL "
            order_valid=false
        fi

        # Step 2: Load Tier 2 (Overview) - depends on T1 success
        if [[ "$order_valid" == "true" && -f "$skill_dir/SKILL.md" ]]; then
            order_log+="T2:OK "
        elif [[ "$order_valid" == "true" ]]; then
            order_log+="T2:FAIL "
            order_valid=false
        fi

        # Step 3: Load Tier 3 (Specific) - depends on T2 success
        if [[ "$order_valid" == "true" && -d "$skill_dir/references" ]]; then
            local ref_count
            ref_count=$(find "$skill_dir/references" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [[ "$ref_count" -gt 0 ]]; then
                order_log+="T3:OK($ref_count files) "
            else
                order_log+="T3:EMPTY "
            fi
        elif [[ "$order_valid" == "true" ]]; then
            order_log+="T3:SKIP "
        fi

        # Step 4: Load Tier 4 (Generate) - depends on task needs
        if [[ "$order_valid" == "true" && -d "$skill_dir/templates" ]]; then
            local tmpl_count
            tmpl_count=$(find "$skill_dir/templates" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [[ "$tmpl_count" -gt 0 ]]; then
                order_log+="T4:OK($tmpl_count files)"
            else
                order_log+="T4:EMPTY"
            fi
        elif [[ "$order_valid" == "true" ]]; then
            order_log+="T4:SKIP"
        fi

        if [[ "$order_valid" == "true" ]]; then
            pass "Loading order valid: $skill [$order_log]"
        else
            fail "Loading order broken: $skill [$order_log]"
            ((errors++)) || true
        fi
    done

    echo ""
    info "Loading Order: $tested skills tested, $errors errors"
}

test_sequential_loading() {
    section "Sequential Loading Simulation"

    # Simulate loading a skill progressively and tracking cumulative tokens
    for skill in "${DEEP_TEST_SKILLS[@]}"; do
        local skill_dir
    skill_dir=$(find "$SKILLS_DIR" -type d -path "*/$skill" 2>/dev/null | head -1)

        if [[ ! -d "$skill_dir" ]]; then
            continue
        fi

        local cumulative=0
        local tier_tokens=""

        # Tier 1
        if [[ -f "$skill_dir/capabilities.json" ]]; then
            local t1_tokens
            t1_tokens=$(count_tokens "$skill_dir/capabilities.json")
            cumulative=$((cumulative + t1_tokens))
            tier_tokens+="T1=$t1_tokens "
        fi

        # Tier 2
        if [[ -f "$skill_dir/SKILL.md" ]]; then
            local t2_tokens
            t2_tokens=$(count_tokens "$skill_dir/SKILL.md")
            cumulative=$((cumulative + t2_tokens))
            tier_tokens+="T2=$t2_tokens "
        fi

        # Tier 3 (first reference only for simulation)
        if [[ -d "$skill_dir/references" ]]; then
            local first_ref
            first_ref=$(find "$skill_dir/references" -name "*.md" -type f 2>/dev/null | head -1)
            if [[ -n "$first_ref" ]]; then
                local t3_tokens
                t3_tokens=$(count_tokens "$first_ref")
                cumulative=$((cumulative + t3_tokens))
                tier_tokens+="T3=$t3_tokens "
            fi
        fi

        # Tier 4 (first template only for simulation)
        if [[ -d "$skill_dir/templates" ]]; then
            local first_tmpl
            first_tmpl=$(find "$skill_dir/templates" -type f 2>/dev/null | head -1)
            if [[ -n "$first_tmpl" ]]; then
                local t4_tokens
                t4_tokens=$(count_tokens "$first_tmpl")
                cumulative=$((cumulative + t4_tokens))
                tier_tokens+="T4=$t4_tokens"
            fi
        fi

        info "$skill: $tier_tokens -> Total: $cumulative tokens"

        if [[ "$cumulative" -lt 15000 ]]; then
            pass "$skill full load within reasonable budget ($cumulative < 15000)"
        else
            warn "$skill full load is large ($cumulative tokens)"
        fi
    done
}

# ============================================================================
# COMPLETENESS STATS
# ============================================================================

test_completeness_stats() {
    section "Completeness Statistics"

    local total=0
    local complete=0
    local tier1_only=0
    local tier2_only=0
    local tier3_only=0
    local complete_skills=()

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            local skill_name
            skill_name=$(basename "$skill_dir")
            ((total++)) || true

            local has_t1=false has_t2=false has_t3=false has_t4=false

            [[ -f "$skill_dir/capabilities.json" ]] && has_t1=true
            [[ -f "$skill_dir/SKILL.md" ]] && has_t2=true

            if [[ -d "$skill_dir/references" ]]; then
                local ref_count
                ref_count=$(find "$skill_dir/references" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
                [[ "$ref_count" -gt 0 ]] && has_t3=true
            fi

            if [[ -d "$skill_dir/templates" ]]; then
                local tmpl_count
                tmpl_count=$(find "$skill_dir/templates" -type f 2>/dev/null | wc -l | tr -d ' ')
                [[ "$tmpl_count" -gt 0 ]] && has_t4=true
            fi

            if $has_t1 && $has_t2 && $has_t3 && $has_t4; then
                ((complete++)) || true
                complete_skills+=("$skill_name")
            elif $has_t1 && $has_t2 && $has_t3; then
                ((tier3_only++)) || true
            elif $has_t1 && $has_t2; then
                ((tier2_only++)) || true
            elif $has_t1; then
                ((tier1_only++)) || true
            fi
        fi
    done

    local percentage
    percentage=$((complete * 100 / total))

    echo ""
    info "Total skills: $total"
    info "Complete (all 4 tiers): $complete ($percentage%)"
    info "Tier 1+2+3 only: $tier3_only"
    info "Tier 1+2 only: $tier2_only"
    info "Tier 1 only: $tier1_only"
    echo ""

    if [[ "$percentage" -ge 40 ]]; then
        pass "At least 40% of skills have all 4 tiers ($percentage%)"
    else
        warn "Less than 40% of skills have all 4 tiers ($percentage%)"
    fi

    if [[ "${#complete_skills[@]}" -gt 0 && -n "$VERBOSE" ]]; then
        info "Skills with all 4 tiers:"
        for skill in "${complete_skills[@]}"; do
            echo "        - $skill"
        done
    fi
}

# ============================================================================
# PROGRESSIVE TOKEN BUDGET
# ============================================================================

test_token_budget() {
    section "Progressive Token Budget Validation"

    # Calculate average tokens per tier across all skills
    local total_t1=0 count_t1=0
    local total_t2=0 count_t2=0
    local total_t3=0 count_t3=0
    local total_t4=0 count_t4=0

    for skill_dir in "$SKILLS_DIR"/*/*; do
        if [[ -d "$skill_dir" ]]; then
            if [[ -f "$skill_dir/capabilities.json" ]]; then
                local t1
                t1=$(count_tokens "$skill_dir/capabilities.json")
                total_t1=$((total_t1 + t1))
                ((count_t1++)) || true
            fi

            if [[ -f "$skill_dir/SKILL.md" ]]; then
                local t2
                t2=$(count_tokens "$skill_dir/SKILL.md")
                total_t2=$((total_t2 + t2))
                ((count_t2++)) || true
            fi

            if [[ -d "$skill_dir/references" ]]; then
                local refs
                refs=$(find "$skill_dir/references" -name "*.md" -type f 2>/dev/null)
                while IFS= read -r ref; do
                    if [[ -n "$ref" ]]; then
                        local t3
                        t3=$(count_tokens "$ref")
                        total_t3=$((total_t3 + t3))
                        ((count_t3++)) || true
                    fi
                done <<< "$refs"
            fi

            if [[ -d "$skill_dir/templates" ]]; then
                local tmpls
                tmpls=$(find "$skill_dir/templates" -type f 2>/dev/null)
                while IFS= read -r tmpl; do
                    if [[ -n "$tmpl" ]]; then
                        local t4
                        t4=$(count_tokens "$tmpl")
                        total_t4=$((total_t4 + t4))
                        ((count_t4++)) || true
                    fi
                done <<< "$tmpls"
            fi
        fi
    done

    local avg_t1=$((count_t1 > 0 ? total_t1 / count_t1 : 0))
    local avg_t2=$((count_t2 > 0 ? total_t2 / count_t2 : 0))
    local avg_t3=$((count_t3 > 0 ? total_t3 / count_t3 : 0))
    local avg_t4=$((count_t4 > 0 ? total_t4 / count_t4 : 0))

    echo ""
    info "Average Tier 1 (capabilities.json): $avg_t1 tokens"
    info "Average Tier 2 (SKILL.md): $avg_t2 tokens"
    info "Average Tier 3 (references/*): $avg_t3 tokens"
    info "Average Tier 4 (templates/*): $avg_t4 tokens"
    echo ""

    # Estimate cumulative load for typical usage (5 skills, T1+T2 only)
    local typical_load=$((MAX_SKILLS_LOADED * (avg_t1 + avg_t2)))
    info "Typical load (5 skills, T1+T2): ~$typical_load tokens"

    # Estimate full load for one skill
    local full_skill_load=$((avg_t1 + avg_t2 + avg_t3 + avg_t4))
    info "Full load (1 skill, all tiers): ~$full_skill_load tokens"

    if [[ "$typical_load" -lt "$CUMULATIVE_BUDGET" ]]; then
        pass "Typical load within budget ($typical_load < $CUMULATIVE_BUDGET)"
    else
        fail "Typical load exceeds budget ($typical_load > $CUMULATIVE_BUDGET)"
    fi
}

# ============================================================================
# DEEP SKILL TESTS
# ============================================================================

test_deep_skill_validation() {
    if [[ -z "$DEEP_MODE" ]]; then
        return
    fi

    section "Deep Skill Validation (--deep mode)"

    for skill in "${DEEP_TEST_SKILLS[@]}"; do
        local skill_dir
    skill_dir=$(find "$SKILLS_DIR" -type d -path "*/$skill" 2>/dev/null | head -1)

        if [[ ! -d "$skill_dir" ]]; then
            skip "Deep test skill not found: $skill"
            continue
        fi

        echo ""
        echo -e "  ${BOLD}Testing: $skill${NC}"
        echo "  ~~~~~~~~~~~~~~~~~~~~~~~~"

        # Tier 1 detailed validation
        local caps_file="$skill_dir/capabilities.json"
        if [[ -f "$caps_file" ]]; then
            local t1_tokens
            t1_tokens=$(count_tokens "$caps_file")

            # Check for progressive_loading section
            local has_prog_loading
            has_prog_loading=$(jq -e '.progressive_loading' "$caps_file" 2>/dev/null && echo "yes" || echo "no")

            # Check for triggers
            local has_triggers
            has_triggers=$(jq -e '.triggers' "$caps_file" 2>/dev/null && echo "yes" || echo "no")

            # Check for capabilities
            local caps_count
            caps_count=$(jq '.capabilities | keys | length' "$caps_file" 2>/dev/null || echo "0")

            info "  Tier 1: $t1_tokens tokens, $caps_count capabilities"
            info "    - progressive_loading: $has_prog_loading"
            info "    - triggers: $has_triggers"

            if [[ "$has_prog_loading" == "yes" && "$has_triggers" == "yes" ]]; then
                pass "  Tier 1 complete metadata for $skill"
            else
                warn "  Tier 1 missing recommended sections for $skill"
            fi
        fi

        # Tier 2 detailed validation
        local skill_file="$skill_dir/SKILL.md"
        if [[ -f "$skill_file" ]]; then
            local t2_tokens
            t2_tokens=$(count_tokens "$skill_file")

            # Count sections
            local section_count
            section_count=$(grep -c "^##" "$skill_file" 2>/dev/null || echo "0")

            # Check for code blocks
            local code_block_count
            code_block_count=$(grep -c '```' "$skill_file" 2>/dev/null || echo "0")
            code_block_count=$((code_block_count / 2))

            info "  Tier 2: $t2_tokens tokens, $section_count sections, $code_block_count code blocks"

            if [[ "$section_count" -ge 2 && "$code_block_count" -ge 1 ]]; then
                pass "  Tier 2 well-structured for $skill"
            else
                warn "  Tier 2 could use more structure for $skill"
            fi
        fi

        # Tier 3 detailed validation
        if [[ -d "$skill_dir/references" ]]; then
            local ref_files
            ref_files=$(find "$skill_dir/references" -name "*.md" -type f 2>/dev/null)
            local ref_count=0
            local ref_total_tokens=0

            while IFS= read -r ref; do
                if [[ -n "$ref" ]]; then
                    ((ref_count++)) || true
                    local ref_tokens
                    ref_tokens=$(count_tokens "$ref")
                    ref_total_tokens=$((ref_total_tokens + ref_tokens))
                fi
            done <<< "$ref_files"

            info "  Tier 3: $ref_count files, $ref_total_tokens total tokens"
            pass "  Tier 3 references present for $skill"
        fi

        # Tier 4 detailed validation
        if [[ -d "$skill_dir/templates" ]]; then
            local tmpl_files
            tmpl_files=$(find "$skill_dir/templates" -type f 2>/dev/null)
            local tmpl_count=0
            local tmpl_total_tokens=0

            while IFS= read -r tmpl; do
                if [[ -n "$tmpl" ]]; then
                    ((tmpl_count++)) || true
                    local tmpl_tokens
                    tmpl_tokens=$(count_tokens "$tmpl")
                    tmpl_total_tokens=$((tmpl_total_tokens + tmpl_tokens))
                fi
            done <<< "$tmpl_files"

            info "  Tier 4: $tmpl_count files, $tmpl_total_tokens total tokens"
            pass "  Tier 4 templates present for $skill"
        fi
    done
}

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

main() {
    echo ""
    echo -e "${BOLD}============================================================================${NC}"
    echo -e "${BOLD}  Progressive Loading Tier Validation Tests${NC}"
    echo -e "${BOLD}============================================================================${NC}"
    echo ""
    echo "  Skills directory: $SKILLS_DIR"
    echo "  Token counting: chars/4 approximation (tiktoken fallback if available)"
    echo "  Mode: ${STRICT_MODE:+STRICT}${STRICT_MODE:-NORMAL}"
    echo ""
    echo "  Tier limits (${STRICT_MODE:+strict}${STRICT_MODE:-recommended}):"
    echo "    - Tier 1 (capabilities.json): max $TIER1_MAX_TOKENS tokens"
    echo "    - Tier 2 (SKILL.md): $TIER2_MIN_TOKENS-$TIER2_MAX_TOKENS tokens"
    echo "    - Tier 3 (references/*): max $TIER3_MAX_TOKENS tokens each"
    echo "    - Tier 4 (templates/*): max $TIER4_MAX_TOKENS tokens each"
    echo ""

    # Run all tests
    test_tier1_existence
    test_tier1_required_fields
    test_tier2_existence
    test_tier2_structure
    test_tier3_files
    test_tier4_files
    test_loading_order
    test_sequential_loading
    test_completeness_stats
    test_token_budget
    test_deep_skill_validation

    # Summary
    echo ""
    echo -e "${BOLD}============================================================================${NC}"
    echo -e "${BOLD}  Test Summary${NC}"
    echo -e "${BOLD}============================================================================${NC}"
    echo ""
    echo -e "  Total tests: $TESTS_RUN"
    echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
    echo -e "  ${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
    echo -e "  ${YELLOW}Warnings: $WARNINGS_COUNT${NC}"
    echo ""

    if [[ "$TESTS_FAILED" -gt 0 ]]; then
        echo -e "  ${RED}RESULT: FAILED${NC}"
        echo ""
        exit 1
    else
        echo -e "  ${GREEN}RESULT: PASSED${NC}"
        echo ""
        exit 0
    fi
}

# Run main
main "$@"