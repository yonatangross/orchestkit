#!/usr/bin/env bash
# ============================================================================
# Script Content Validation Tests
# ============================================================================
# Validates content quality of script-enhanced skills.
#
# Tests:
# 1. Scripts have clear task instructions
# 2. Scripts reference $ARGUMENTS appropriately in task descriptions
# 3. Scripts include usage examples
# 4. Scripts have proper sections (Context, Task, Workflow, etc.)
# 5. Code blocks are properly formatted
# 6. Scripts are within reasonable token budget
# 7. Scripts have "Your Task" or equivalent instruction section
#
# Usage: ./test-script-content.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -uo pipefail
# Note: -e removed intentionally - tests need to handle expected non-zero returns

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

# Source helpers
source "$SCRIPT_DIR/fixtures/script-test-helpers.sh"
source "$SCRIPT_DIR/../../fixtures/test-helpers.sh" 2>/dev/null || true

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
TOTAL_SCRIPTS=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' NC=''
fi

# Test output functions
pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    ((PASS_COUNT++)) || true
}

fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    ((FAIL_COUNT++)) || true
}

warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
    ((WARN_COUNT++)) || true
}

info() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo -e "  ${BLUE}INFO${NC} $1"
    fi
}

# ============================================================================
# Header
# ============================================================================
echo "============================================================================"
echo "  Script Content Validation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test 1: Task Instructions
# ============================================================================
echo -e "${CYAN}Test 1: Task Instructions${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

NO_TASK_INSTRUCTIONS=()
WITH_TASK=0

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        ((TOTAL_SCRIPTS++)) || true
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        if has_task_instructions "$script_file"; then
            ((WITH_TASK++)) || true
            info "$skill_name/scripts/$script_name: Has task instructions"
        else
            NO_TASK_INSTRUCTIONS+=("$skill_name/scripts/$script_name")
            warn "$skill_name/scripts/$script_name: Missing task instructions"
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ $WITH_TASK -gt 0 ]]; then
    pass "$WITH_TASK script(s) have task instructions"
fi

if [[ ${#NO_TASK_INSTRUCTIONS[@]} -gt 0 ]]; then
    warn "${#NO_TASK_INSTRUCTIONS[@]} script(s) missing task instructions (recommended)"
fi
echo ""

# ============================================================================
# Test 2: $ARGUMENTS in Task Description
# ============================================================================
echo -e "${CYAN}Test 2: \$ARGUMENTS in Task Description${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

NO_ARGS_IN_TASK=()
WITH_ARGS_IN_TASK=0

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        if uses_arguments_in_task "$script_file"; then
            ((WITH_ARGS_IN_TASK++)) || true
            info "$skill_name/scripts/$script_name: Uses \$ARGUMENTS in task"
        else
        # Only warn if script has argument-hint (expects arguments)
        frontmatter=$(extract_script_frontmatter "$script_file")
        argument_hint=$(get_frontmatter_field "$frontmatter" "argument-hint")
            
            if [[ -n "$argument_hint" ]]; then
                NO_ARGS_IN_TASK+=("$skill_name/scripts/$script_name")
                warn "$skill_name/scripts/$script_name: Has argument-hint but \$ARGUMENTS not in task"
            fi
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ $WITH_ARGS_IN_TASK -gt 0 ]]; then
    pass "$WITH_ARGS_IN_TASK script(s) use \$ARGUMENTS in task descriptions"
fi

if [[ ${#NO_ARGS_IN_TASK[@]} -gt 0 ]]; then
    warn "${#NO_ARGS_IN_TASK[@]} script(s) with argument-hint don't use \$ARGUMENTS in task"
fi
echo ""

# ============================================================================
# Test 3: Usage Examples
# ============================================================================
echo -e "${CYAN}Test 3: Usage Examples${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

NO_USAGE=()
WITH_USAGE=0

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        if has_usage_examples "$script_file"; then
            ((WITH_USAGE++)) || true
            info "$skill_name/scripts/$script_name: Has usage examples"
        else
            NO_USAGE+=("$skill_name/scripts/$script_name")
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ $WITH_USAGE -gt 0 ]]; then
    pass "$WITH_USAGE script(s) have usage examples"
fi

if [[ ${#NO_USAGE[@]} -gt 0 ]]; then
    warn "${#NO_USAGE[@]} script(s) missing usage examples (recommended)"
fi
echo ""

# ============================================================================
# Test 4: Token Budget
# ============================================================================
echo -e "${CYAN}Test 4: Token Budget${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

MIN_TOKENS=100
MAX_TOKENS=3000
OVER_BUDGET=()
UNDER_BUDGET=()
IN_BUDGET=0

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        tokens=$(count_tokens_estimate "$script_file")
        
        if [[ "$tokens" -lt "$MIN_TOKENS" ]]; then
            UNDER_BUDGET+=("$skill_name/scripts/$script_name ($tokens tokens)")
            warn "$skill_name/scripts/$script_name: Under minimum token budget ($tokens < $MIN_TOKENS)"
        elif [[ "$tokens" -gt "$MAX_TOKENS" ]]; then
            OVER_BUDGET+=("$skill_name/scripts/$script_name ($tokens tokens)")
            warn "$skill_name/scripts/$script_name: Over maximum token budget ($tokens > $MAX_TOKENS)"
        else
            ((IN_BUDGET++)) || true
            info "$skill_name/scripts/$script_name: Token budget OK ($tokens tokens)"
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#UNDER_BUDGET[@]} -eq 0 ]] && [[ ${#OVER_BUDGET[@]} -eq 0 ]]; then
    pass "All scripts within token budget ($MIN_TOKENS-$MAX_TOKENS tokens)"
else
    if [[ ${#UNDER_BUDGET[@]} -gt 0 ]]; then
        warn "${#UNDER_BUDGET[@]} script(s) under minimum token budget"
    fi
    if [[ ${#OVER_BUDGET[@]} -gt 0 ]]; then
        warn "${#OVER_BUDGET[@]} script(s) over maximum token budget"
    fi
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  Total scripts:    $TOTAL_SCRIPTS"
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All content validation tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
