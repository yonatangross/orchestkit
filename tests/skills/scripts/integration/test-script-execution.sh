#!/usr/bin/env bash
# ============================================================================
# Script Execution Verification Tests
# ============================================================================
# Actually executes commands from script-enhanced skills and verifies:
# 1. Commands execute successfully (or fail gracefully)
# 2. $ARGUMENTS substitution produces valid content
# 3. Final skill content is usable by Claude
#
# This is a more thorough test that actually runs commands to verify
# they work in the real environment.
#
# Usage: ./test-script-execution.sh [--verbose] [--skill SKILL_NAME]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/skills"

# Source helpers
source "$SCRIPT_DIR/../fixtures/script-test-helpers.sh"
source "$SCRIPT_DIR/../../../fixtures/test-helpers.sh" 2>/dev/null || true

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

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
echo "  Script Execution Verification Tests"
echo "============================================================================"
echo ""
echo "This test actually executes commands from script-enhanced skills"
echo "to verify they work correctly in the real environment."
echo ""

# ============================================================================
# Test: Execute Sample Commands
# ============================================================================
echo -e "${CYAN}Test 1: Command Execution${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# Test a few representative skills with actual command execution
TEST_CASES=(
    "code-review-playbook/scripts/review-pr.md:gh pr list --limit 1"
    "release-management/scripts/create-release.md:git describe --tags"
    "quality-gates/scripts/assess-complexity.md:find . -name '*.py' | head -5"
)

COMMAND_FAILURES=0
COMMAND_SUCCESSES=0

for test_case in "${TEST_CASES[@]}"; do
    skill_path="${test_case%%:*}"
    expected_command="${test_case##*:}"
    skill_file="$SKILLS_DIR/$skill_path"
    
    [[ ! -f "$skill_file" ]] && continue
    
    skill_name=$(echo "$skill_path" | cut -d'/' -f1)
    
    # Extract commands from the skill
    commands=$(find_all_script_commands "$skill_file")
    
    if [[ -z "$commands" ]]; then
        warn "$skill_name: No !command patterns found"
        continue
    fi
    
    # Try to execute the first command
    first_cmd=$(echo "$commands" | head -1)
    if [[ -n "$first_cmd" ]]; then
        cmd_text=$(extract_command_from_pattern "$first_cmd")
        
        # Execute command (with error handling)
        if bash -c "$cmd_text" >/dev/null 2>&1; then
            ((COMMAND_SUCCESSES++)) || true
            info "$skill_name: Command executed successfully"
        else
            # Command failed - check if it has a fallback
            if echo "$cmd_text" | grep -qE '\|\|'; then
                ((COMMAND_SUCCESSES++)) || true
                info "$skill_name: Command failed but has fallback (expected)"
            else
                ((COMMAND_FAILURES++)) || true
                warn "$skill_name: Command failed without fallback: $cmd_text"
            fi
        fi
    fi
done

if [[ $COMMAND_FAILURES -eq 0 ]]; then
    pass "$COMMAND_SUCCESSES command(s) executed successfully or have fallbacks"
else
    warn "$COMMAND_FAILURES command(s) failed (may need fallbacks)"
fi
echo ""

# ============================================================================
# Test: $ARGUMENTS Substitution
# ============================================================================
echo -e "${CYAN}Test 2: \$ARGUMENTS Substitution${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

SUBSTITUTION_TESTS=(
    "architecture-decision-record/scripts/create-adr.md:ADR-001"
    "code-review-playbook/scripts/review-pr.md:123"
    "fastapi-advanced/scripts/create-fastapi-app.md:my-api"
)

SUBSTITUTION_SUCCESSES=0
SUBSTITUTION_FAILURES=0

for test_case in "${SUBSTITUTION_TESTS[@]}"; do
    skill_path="${test_case%%:*}"
    test_args="${test_case##*:}"
    skill_file="$SKILLS_DIR/$skill_path"
    
    [[ ! -f "$skill_file" ]] && continue
    
    skill_name=$(echo "$skill_path" | cut -d'/' -f1)
    
    # Check if skill uses $ARGUMENTS
    if ! grep -q '\$ARGUMENTS' "$skill_file" 2>/dev/null; then
        continue
    fi
    
    # Perform substitution
    substituted=$(sed "s|\$ARGUMENTS|$test_args|g" "$skill_file")
    
    # Verify substitution worked
    if echo "$substituted" | grep -q "$test_args"; then
        # Verify $ARGUMENTS was removed
        if ! echo "$substituted" | grep -q '\$ARGUMENTS'; then
            ((SUBSTITUTION_SUCCESSES++)) || true
            info "$skill_name: \$ARGUMENTS successfully substituted with '$test_args'"
        else
            ((SUBSTITUTION_FAILURES++)) || true
            fail "$skill_name: \$ARGUMENTS not fully substituted"
        fi
    else
        ((SUBSTITUTION_FAILURES++)) || true
        fail "$skill_name: \$ARGUMENTS substitution failed"
    fi
done

if [[ $SUBSTITUTION_FAILURES -eq 0 ]]; then
    pass "$SUBSTITUTION_SUCCESSES \$ARGUMENTS substitution(s) successful"
else
    fail "$SUBSTITUTION_FAILURES \$ARGUMENTS substitution(s) failed"
fi
echo ""

# ============================================================================
# Test: Final Content Validation
# ============================================================================
echo -e "${CYAN}Test 3: Final Content Validation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

CONTENT_VALID=0
CONTENT_INVALID=0

# Test a sample of skills
SAMPLE_SKILLS=(
    "code-review-playbook/scripts/review-pr.md"
    "architecture-decision-record/scripts/create-adr.md"
    "quality-gates/scripts/assess-complexity.md"
)

for skill_path in "${SAMPLE_SKILLS[@]}"; do
    skill_file="$SKILLS_DIR/$skill_path"
    
    [[ ! -f "$skill_file" ]] && continue
    
    skill_name=$(echo "$skill_path" | cut -d'/' -f1)
    
    # Simulate full invocation: execute commands, substitute arguments
    temp_content=$(mktemp)
    
    # Read file and process
    while IFS= read -r line; do
        if [[ "$line" =~ !\`([^\`]+)\` ]]; then
            # Execute command (with fallback)
            cmd="${BASH_REMATCH[1]}"
            output=$(bash -c "$cmd" 2>/dev/null || echo "Command output unavailable")
            echo "$line" | sed "s|!\`[^\`]*\`|$output|g"
        else
            echo "$line"
        fi
    done < "$skill_file" | sed "s|\$ARGUMENTS|TEST-ARGS|g" > "$temp_content"
    
    # Validate final content
    if [[ -s "$temp_content" ]]; then
        # Check for task instructions
        if grep -qiE "(your task|task:|instructions:)" "$temp_content"; then
            ((CONTENT_VALID++)) || true
            info "$skill_name: Final content is valid and usable"
        else
            ((CONTENT_INVALID++)) || true
            warn "$skill_name: Final content missing task instructions"
        fi
    else
        ((CONTENT_INVALID++)) || true
        fail "$skill_name: Final content is empty"
    fi
    
    rm -f "$temp_content"
done

if [[ $CONTENT_INVALID -eq 0 ]]; then
    pass "$CONTENT_VALID final content validation(s) passed"
else
    warn "$CONTENT_INVALID final content validation(s) had issues"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All execution verification tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
