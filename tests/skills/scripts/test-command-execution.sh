#!/usr/bin/env bash
# ============================================================================
# !command Execution Validation Tests
# ============================================================================
# Validates !command syntax and execution patterns in script-enhanced skills.
#
# Tests:
# 1. All !command syntax is valid (balanced backticks, proper escaping)
# 2. Commands use fallback patterns (|| echo "default")
# 3. Commands don't reference $ARGUMENTS (static only)
# 4. Commands are safe (no dangerous operations)
# 5. Commands are properly escaped (no injection risks)
#
# Usage: ./test-command-execution.sh [--verbose]
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
TOTAL_COMMANDS=0

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
echo "  !command Execution Validation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test 1: !command Syntax Validation
# ============================================================================
echo -e "${CYAN}Test 1: !command Syntax Validation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

SYNTAX_ERRORS=()
TOTAL_COMMANDS=0

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        errors=$(validate_command_syntax "$script_file" 2>&1)
        command_count=$(count_script_commands "$script_file")
        ((TOTAL_COMMANDS += command_count)) || true
        
        if [[ -n "$errors" ]]; then
            SYNTAX_ERRORS+=("$skill_name/scripts/$script_name: $errors")
            fail "$skill_name/scripts/$script_name: Syntax errors in !command"
            if [[ -n "$VERBOSE" ]]; then
                echo "$errors" | sed 's/^/    /'
            fi
        else
            if [[ $command_count -gt 0 ]]; then
                info "$skill_name/scripts/$script_name: $command_count !command(s) with valid syntax"
            fi
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#SYNTAX_ERRORS[@]} -eq 0 ]]; then
    pass "All !command syntax is valid ($TOTAL_COMMANDS commands checked)"
else
    fail "${#SYNTAX_ERRORS[@]} script(s) have syntax errors"
fi
echo ""

# ============================================================================
# Test 2: Fallback Patterns
# ============================================================================
echo -e "${CYAN}Test 2: Fallback Patterns${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

NO_FALLBACK=()
WITH_FALLBACK=0

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        commands=$(find_all_script_commands "$script_file")
        has_fallback=false
        no_fallback_count=0
        
        while IFS= read -r command_pattern; do
            [[ -z "$command_pattern" ]] && continue
            cmd=$(extract_command_from_pattern "$command_pattern")
            
            if has_fallback_pattern "$cmd"; then
                has_fallback=true
            else
                ((no_fallback_count++)) || true
            fi
        done <<< "$commands"
        
        if [[ $no_fallback_count -gt 0 ]]; then
            NO_FALLBACK+=("$skill_name/scripts/$script_name ($no_fallback_count command(s) without fallback)")
            warn "$skill_name/scripts/$script_name: $no_fallback_count command(s) without fallback"
        else
            if [[ -n "$commands" ]]; then
                ((WITH_FALLBACK++)) || true
                info "$skill_name/scripts/$script_name: All commands have fallbacks"
            fi
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#NO_FALLBACK[@]} -eq 0 ]]; then
    pass "All commands have fallback patterns"
else
    warn "${#NO_FALLBACK[@]} script(s) have commands without fallbacks (recommended but not required)"
fi
echo ""

# ============================================================================
# Test 3: No $ARGUMENTS in Commands (Static Only)
# ============================================================================
echo -e "${CYAN}Test 3: No \$ARGUMENTS in Commands (Static Only)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# This is already tested in test-arguments-usage.sh, but we verify here too
ARGUMENTS_IN_COMMANDS=()

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        if check_arguments_in_command "$script_file"; then
            skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
            script_name=$(basename "$script_file")
            ARGUMENTS_IN_COMMANDS+=("$skill_name/scripts/$script_name")
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#ARGUMENTS_IN_COMMANDS[@]} -eq 0 ]]; then
    pass "No \$ARGUMENTS in !command backticks (all commands are static)"
else
    fail "${#ARGUMENTS_IN_COMMANDS[@]} script(s) have \$ARGUMENTS in commands (CRITICAL)"
fi
echo ""

# ============================================================================
# Test 4: Dangerous Commands Check
# ============================================================================
echo -e "${CYAN}Test 4: Dangerous Commands Check${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

DANGEROUS_FOUND=()

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        dangerous=$(check_dangerous_commands "$script_file" 2>&1)
        if [[ -n "$dangerous" ]]; then
            skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
            script_name=$(basename "$script_file")
            DANGEROUS_FOUND+=("$skill_name/scripts/$script_name: $dangerous")
            fail "$skill_name/scripts/$script_name: Dangerous command detected"
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#DANGEROUS_FOUND[@]} -eq 0 ]]; then
    pass "No dangerous commands found"
else
    fail "${#DANGEROUS_FOUND[@]} script(s) contain dangerous commands"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  Total commands checked: $TOTAL_COMMANDS"
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All command execution tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
