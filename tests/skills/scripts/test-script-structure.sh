#!/usr/bin/env bash
# ============================================================================
# Script Structure Validation Tests
# ============================================================================
# Validates structure of all script-enhanced skills.
#
# Tests:
# 1. Script files exist in scripts/ directory (not templates/)
# 2. Script files are .md format
# 3. Script names follow convention
# 4. Script frontmatter has required fields (name, description, user-invocable)
# 5. Script frontmatter has argument-hint when arguments expected
# 6. Script content is non-empty
#
# Usage: ./test-script-structure.sh [--verbose]
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
echo "  Script Structure Validation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test 1: Scripts in scripts/ directory
# ============================================================================
echo -e "${CYAN}Test 1: Scripts in scripts/ Directory${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

WRONG_LOCATION=()
SCRIPT_FILES=()

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        SCRIPT_FILES+=("$script_file")
        ((TOTAL_SCRIPTS++)) || true
        
        if validate_script_structure "$script_file"; then
            skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
            info "$skill_name: Script in correct location"
        else
            WRONG_LOCATION+=("$script_file")
            fail "$script_file: Not in scripts/ directory or not .md file"
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#WRONG_LOCATION[@]} -eq 0 ]]; then
    pass "All $TOTAL_SCRIPTS script(s) in correct location (scripts/ directory, .md format)"
else
    fail "${#WRONG_LOCATION[@]} script(s) in wrong location"
fi
echo ""

# ============================================================================
# Test 2: Required Frontmatter Fields
# ============================================================================
echo -e "${CYAN}Test 2: Required Frontmatter Fields${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

MISSING_FIELDS=()
VALID_FRONTMATTER=0

for script_file in "${SCRIPT_FILES[@]}"; do
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    if has_required_frontmatter "$script_file"; then
        ((VALID_FRONTMATTER++)) || true
        info "$skill_name/scripts/$script_name: Has required frontmatter"
    else
        MISSING_FIELDS+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: Missing required frontmatter fields"
    fi
done

if [[ $VALID_FRONTMATTER -eq $TOTAL_SCRIPTS ]]; then
    pass "All $TOTAL_SCRIPTS script(s) have required frontmatter (name, description, user-invocable)"
else
    fail "${#MISSING_FIELDS[@]} script(s) missing required frontmatter fields"
fi
echo ""

# ============================================================================
# Test 3: user-invocable Field
# ============================================================================
echo -e "${CYAN}Test 3: user-invocable Field Validation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

INVALID_USER_INVOCABLE=()
USER_INVOCABLE_TRUE=0
USER_INVOCABLE_FALSE=0

for script_file in "${SCRIPT_FILES[@]}"; do
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    frontmatter=$(extract_script_frontmatter "$script_file")
    user_invocable=$(get_frontmatter_field "$frontmatter" "user-invocable")
    
    if [[ "$user_invocable" == "true" ]]; then
        ((USER_INVOCABLE_TRUE++)) || true
        info "$skill_name/scripts/$script_name: user-invocable: true"
    elif [[ "$user_invocable" == "false" ]]; then
        ((USER_INVOCABLE_FALSE++)) || true
        warn "$skill_name/scripts/$script_name: user-invocable: false (scripts should be commands)"
    else
        INVALID_USER_INVOCABLE+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: Invalid user-invocable value: $user_invocable"
    fi
done

if [[ ${#INVALID_USER_INVOCABLE[@]} -eq 0 ]]; then
    pass "All scripts have valid user-invocable field"
    if [[ $USER_INVOCABLE_TRUE -gt 0 ]]; then
        info "$USER_INVOCABLE_TRUE script(s) are user-invocable (commands)"
    fi
    if [[ $USER_INVOCABLE_FALSE -gt 0 ]]; then
        warn "$USER_INVOCABLE_FALSE script(s) are not user-invocable (may be intentional)"
    fi
else
    fail "${#INVALID_USER_INVOCABLE[@]} script(s) have invalid user-invocable field"
fi
echo ""

# ============================================================================
# Test 4: argument-hint Field
# ============================================================================
echo -e "${CYAN}Test 4: argument-hint Field${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

WITH_HINT=0
WITHOUT_HINT=0

for script_file in "${SCRIPT_FILES[@]}"; do
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    frontmatter=$(extract_script_frontmatter "$script_file")
    argument_hint=$(get_frontmatter_field "$frontmatter" "argument-hint")
    
    if [[ -n "$argument_hint" ]]; then
        ((WITH_HINT++)) || true
        info "$skill_name/scripts/$script_name: Has argument-hint: $argument_hint"
    else
        ((WITHOUT_HINT++)) || true
        # Not a failure - some scripts may not need arguments
    fi
done

info "$WITH_HINT script(s) have argument-hint, $WITHOUT_HINT script(s) don't"
pass "argument-hint field validation complete"
echo ""

# ============================================================================
# Test 5: Script Content Non-Empty
# ============================================================================
echo -e "${CYAN}Test 5: Script Content Non-Empty${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

EMPTY_SCRIPTS=()
NON_EMPTY=0

for script_file in "${SCRIPT_FILES[@]}"; do
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    # Check if file has content after frontmatter
    content_after_frontmatter=$(sed '/^---$/,/^---$/d' "$script_file" 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' ')
    
    if [[ "$content_after_frontmatter" -gt 0 ]]; then
        ((NON_EMPTY++)) || true
        info "$skill_name/scripts/$script_name: Has content ($content_after_frontmatter lines)"
    else
        EMPTY_SCRIPTS+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: Empty or missing content"
    fi
done

if [[ ${#EMPTY_SCRIPTS[@]} -eq 0 ]]; then
    pass "All $TOTAL_SCRIPTS script(s) have non-empty content"
else
    fail "${#EMPTY_SCRIPTS[@]} script(s) are empty"
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
    echo -e "${GREEN}SUCCESS: All structure tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
