#!/usr/bin/env bash
# ============================================================================
# $ARGUMENTS Usage Validation Tests (CRITICAL)
# ============================================================================
# Validates that $ARGUMENTS is used correctly in script-enhanced skills.
#
# CRITICAL: Ensures no $ARGUMENTS inside !command backticks (executes before
# substitution). Validates correct usage in markdown content and code blocks.
#
# Tests:
# 1. No $ARGUMENTS inside !command backticks (CRITICAL - must be 0)
# 2. $ARGUMENTS appears in markdown content (correct usage)
# 3. $ARGUMENTS appears in code blocks (correct usage)
# 4. Skills with argument-hint actually use $ARGUMENTS
# 5. All 25 script-enhanced skills validated
#
# Usage: ./test-arguments-usage.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/skills"

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
echo "  \$ARGUMENTS Usage Validation Tests (CRITICAL)"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test 1: CRITICAL - No $ARGUMENTS in !command backticks
# ============================================================================
echo -e "${CYAN}Test 1: No \$ARGUMENTS in !command Backticks (CRITICAL)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

VIOLATIONS=()
SCRIPT_FILES=()

# Find all script files
while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        SCRIPT_FILES+=("$script_file")
        ((TOTAL_SCRIPTS++)) || true
        
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        # Check for $ARGUMENTS in !command
        if check_arguments_in_command "$script_file"; then
            violations=$(find_arguments_in_commands "$script_file")
            VIOLATIONS+=("$skill_name/scripts/$script_name")
            fail "$skill_name/scripts/$script_name: \$ARGUMENTS found in !command backticks"
            if [[ -n "$VERBOSE" ]]; then
                echo "$violations" | sed 's/^/    /'
            fi
        else
            info "$skill_name/scripts/$script_name: No \$ARGUMENTS in !command (correct)"
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
    pass "No \$ARGUMENTS in !command backticks (0 violations found)"
else
    fail "${#VIOLATIONS[@]} script(s) have \$ARGUMENTS in !command backticks (CRITICAL ERROR)"
    echo ""
    echo "Violations:"
    for violation in "${VIOLATIONS[@]}"; do
        echo "  - $violation"
    done
fi
echo ""

# ============================================================================
# Test 2: $ARGUMENTS in Markdown Content (Correct Usage)
# ============================================================================
echo -e "${CYAN}Test 2: \$ARGUMENTS in Markdown Content (Correct Usage)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

NO_MARKDOWN_USAGE=()
MARKDOWN_USAGE_COUNT=0

for script_file in "${SCRIPT_FILES[@]}"; do
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    if check_arguments_in_markdown "$script_file"; then
        ((MARKDOWN_USAGE_COUNT++)) || true
        info "$skill_name/scripts/$script_name: Uses \$ARGUMENTS in markdown (correct)"
    else
        NO_MARKDOWN_USAGE+=("$skill_name/scripts/$script_name")
        warn "$skill_name/scripts/$script_name: No \$ARGUMENTS in markdown content"
    fi
done

if [[ $MARKDOWN_USAGE_COUNT -gt 0 ]]; then
    pass "$MARKDOWN_USAGE_COUNT script(s) use \$ARGUMENTS in markdown content (correct)"
fi

if [[ ${#NO_MARKDOWN_USAGE[@]} -gt 0 ]]; then
    warn "${#NO_MARKDOWN_USAGE[@]} script(s) don't use \$ARGUMENTS in markdown (may be intentional)"
fi
echo ""

# ============================================================================
# Test 3: $ARGUMENTS in Code Blocks (Correct Usage)
# ============================================================================
echo -e "${CYAN}Test 3: \$ARGUMENTS in Code Blocks (Correct Usage)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

CODE_BLOCK_USAGE_COUNT=0

for script_file in "${SCRIPT_FILES[@]}"; do
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    if check_arguments_in_code_blocks "$script_file"; then
        ((CODE_BLOCK_USAGE_COUNT++)) || true
        info "$skill_name/scripts/$script_name: Uses \$ARGUMENTS in code blocks (correct)"
    fi
done

if [[ $CODE_BLOCK_USAGE_COUNT -gt 0 ]]; then
    pass "$CODE_BLOCK_USAGE_COUNT script(s) use \$ARGUMENTS in code blocks (correct)"
else
    info "No scripts use \$ARGUMENTS in code blocks (not required)"
fi
echo ""

# ============================================================================
# Test 4: argument-hint Validation
# ============================================================================
echo -e "${CYAN}Test 4: argument-hint Validation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

HINT_MISMATCH=()
HINT_MATCH=0

for script_file in "${SCRIPT_FILES[@]}"; do
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    if validate_argument_hint "$script_file"; then
        ((HINT_MATCH++)) || true
        info "$skill_name/scripts/$script_name: argument-hint matches \$ARGUMENTS usage"
    else
        HINT_MISMATCH+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: argument-hint present but \$ARGUMENTS not used"
    fi
done

if [[ $HINT_MATCH -gt 0 ]]; then
    pass "$HINT_MATCH script(s) have valid argument-hint"
fi

if [[ ${#HINT_MISMATCH[@]} -gt 0 ]]; then
    fail "${#HINT_MISMATCH[@]} script(s) have argument-hint mismatch"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  Total scripts checked: $TOTAL_SCRIPTS"
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Critical: Fail if any $ARGUMENTS in !command
if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
    echo -e "${RED}CRITICAL ERROR: \$ARGUMENTS found in !command backticks${NC}"
    echo "This violates Claude Code execution order (commands run before substitution)"
    echo ""
    exit 1
fi

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All critical tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
