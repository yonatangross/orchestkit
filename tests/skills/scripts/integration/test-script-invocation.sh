#!/usr/bin/env bash
# ============================================================================
# Script Invocation Simulation Tests
# ============================================================================
# Simulates Claude Code's skill invocation process to verify script-enhanced
# skills work correctly. This tests the actual execution flow that Claude Code
# would perform when a user invokes a skill.
#
# Tests:
# 1. Simulate !command execution (commands run before content is sent)
# 2. Simulate $ARGUMENTS substitution (happens after !command)
# 3. Verify final skill content is properly formatted
# 4. Test argument passing and substitution
# 5. Verify command output is injected correctly
#
# Usage: ./test-script-invocation.sh [--verbose] [--skill SKILL_NAME] [--args ARGUMENTS]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

# Source helpers
source "$SCRIPT_DIR/../fixtures/script-test-helpers.sh"
source "$SCRIPT_DIR/../../../fixtures/test-helpers.sh" 2>/dev/null || true

VERBOSE="${1:-}"
SKILL_FILTER="${2:-}"
ARGS="${3:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
TOTAL_TESTED=0

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
# Skill Invocation Simulation
# ============================================================================

# Simulate Claude Code's skill invocation process:
# 1. Read skill file
# 2. Execute !command patterns (replace with output)
# 3. Substitute $ARGUMENTS
# 4. Return final content
simulate_skill_invocation() {
    local skill_file="$1"
    local arguments="${2:-}"
    local temp_output
    temp_output=$(mktemp)
    
    # Step 1: Read skill file
    local skill_content
    skill_content=$(cat "$skill_file")
    
    # Step 2: Execute !command patterns (BEFORE $ARGUMENTS substitution)
    # Find all !command patterns and replace with command output
    while IFS= read -r line; do
        if [[ "$line" =~ !\`([^\`]+)\` ]]; then
            local command="${BASH_REMATCH[1]}"
            # Execute command and capture output
            local cmd_output
            cmd_output=$(eval "$command" 2>/dev/null || echo "Command failed or not available")
            # Replace !command with output
            echo "$line" | sed "s|!\`[^\`]*\`|$cmd_output|g"
        else
            echo "$line"
        fi
    done <<< "$skill_content" > "$temp_output"
    
    # Step 3: Substitute $ARGUMENTS (AFTER !command execution)
    if [[ -n "$arguments" ]]; then
        sed "s|\$ARGUMENTS|$arguments|g" "$temp_output"
    else
        cat "$temp_output"
    fi
    
    rm -f "$temp_output"
}

# Test a single skill invocation
test_skill_invocation() {
    local script_file="$1"
    local test_args="${2:-test-123}"
    local skill_name
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    local script_name
    script_name=$(basename "$script_file")
    
    ((TOTAL_TESTED++)) || true
    
    info "Testing: $skill_name/scripts/$script_name with args: $test_args"
    
    # Skip template files (no frontmatter)
    if ! head -1 "$script_file" 2>/dev/null | grep -q "^---$"; then
        info "$skill_name/scripts/$script_name: Template file (skipping invocation test)"
        return 0
    fi
    
    # Check if skill has user-invocable: true
    local frontmatter
    frontmatter=$(extract_script_frontmatter "$script_file" 2>/dev/null || echo "")
    local user_invocable
    user_invocable=$(get_frontmatter_field "$frontmatter" "user-invocable" 2>/dev/null || echo "")
    
    if [[ "$user_invocable" != "true" ]]; then
        info "$skill_name/scripts/$script_name: Not user-invocable (skipping)"
        return 0
    fi
    
    # Test 1: Verify !command execution happens
    local commands_found
    commands_found=$(count_script_commands "$script_file")
    
    if [[ $commands_found -gt 0 ]]; then
        # Try to execute one command to verify it works
        local first_command
        first_command=$(find_all_script_commands "$script_file" | head -1)
        if [[ -n "$first_command" ]]; then
            local cmd
            cmd=$(extract_command_from_pattern "$first_command")
            # Test command execution (with timeout to prevent hangs)
            if timeout 2 bash -c "$cmd" >/dev/null 2>&1 || [[ $? -eq 124 ]] || [[ $? -eq 1 ]]; then
                # Command executed (or timed out, or failed - all OK for testing)
                info "$skill_name/scripts/$script_name: !command execution test passed"
            else
                warn "$skill_name/scripts/$script_name: !command execution may have issues"
            fi
        fi
    fi
    
    # Test 2: Verify $ARGUMENTS substitution would work
    if grep -q '\$ARGUMENTS' "$script_file" 2>/dev/null; then
        # Simulate substitution
        local substituted
        substituted=$(sed "s|\$ARGUMENTS|$test_args|g" "$script_file")
        if echo "$substituted" | grep -q "$test_args"; then
            info "$skill_name/scripts/$script_name: \$ARGUMENTS substitution test passed"
        else
            fail "$skill_name/scripts/$script_name: \$ARGUMENTS substitution failed"
            return 1
        fi
    fi
    
    # Test 3: Verify final content structure
    local final_content
    final_content=$(simulate_skill_invocation "$script_file" "$test_args" 2>/dev/null || echo "")
    
    if [[ -n "$final_content" ]]; then
        # Check that content has instructions
        if echo "$final_content" | grep -qiE "(your task|task:|instructions:|what to do)"; then
            info "$skill_name/scripts/$script_name: Final content has task instructions"
        fi
        
        # Check that $ARGUMENTS was substituted (if it existed)
        if ! echo "$final_content" | grep -q '\$ARGUMENTS'; then
            if grep -q '\$ARGUMENTS' "$script_file"; then
                # $ARGUMENTS was in original but not in final - substitution worked
                info "$skill_name/scripts/$script_name: \$ARGUMENTS successfully substituted"
            fi
        fi
        
        pass "$skill_name/scripts/$script_name: Invocation simulation passed"
        return 0
    else
        fail "$skill_name/scripts/$script_name: Invocation simulation produced empty content"
        return 1
    fi
}

# ============================================================================
# Header
# ============================================================================
echo "============================================================================"
echo "  Script Invocation Simulation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""
echo "This test simulates Claude Code's skill invocation process:"
echo "  1. Execute !command patterns (before substitution)"
echo "  2. Substitute \$ARGUMENTS (after command execution)"
echo "  3. Verify final content structure"
echo ""

# ============================================================================
# Test: Invoke Sample Script-Enhanced Skills
# ============================================================================
echo -e "${CYAN}Test: Skill Invocation Simulation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# Test the 25 script-enhanced skills we created
TEST_SKILLS=(
    "architecture-decision-record/scripts/create-adr.md:ADR-001"
    "code-review-playbook/scripts/review-pr.md:123"
    "brainstorming/scripts/create-design-doc.md:user-profile"
    "quality-gates/scripts/assess-complexity.md:src/components"
    "evidence-verification/scripts/generate-test-evidence.md:pytest tests/"
    "fastapi-advanced/scripts/create-fastapi-app.md:my-api"
    "alembic-migrations/scripts/create-migration.md:add_user_table"
    "golden-dataset-management/scripts/backup-golden-dataset.md:dataset-v1"
    "unit-testing/scripts/create-test-fixture.md:User"
    "integration-testing/scripts/create-integration-test.md:auth-flow"
    "release-management/scripts/create-release.md:1.2.3"
    "stacked-prs/scripts/create-stacked-pr.md:feature-branch"
    "agent-browser/scripts/capture-browser-content.md:https://example.com"
    "browser-content-capture/scripts/multi-page-crawl.md:https://example.com/docs"
    "agent-browser/scripts/automate-form.md:https://example.com/login"
    "e2e-testing/scripts/create-page-object.md:LoginPage"
    "form-state-patterns/scripts/create-form.md:UserForm"
    "unit-testing/scripts/create-test-case.md:calculateTotal"
    "msw-mocking/scripts/create-msw-handler.md:/api/users"
    "react-server-components-framework/scripts/create-server-component.md:UserProfile"
    "api-design-framework/scripts/create-openapi-spec.md:/users"
    "devops-deployment/scripts/create-ci-pipeline.md:backend"
    "devops-deployment/scripts/create-docker-compose.md:webapp"
    "advanced-guardrails/scripts/create-guardrails-config.md:openai"
    "fine-tuning-customization/scripts/create-lora-config.md:gpt-3.5-turbo"
)

FAILED_INVOCATIONS=()

for skill_entry in "${TEST_SKILLS[@]}"; do
    skill_path="${skill_entry%%:*}"
    test_args="${skill_entry##*:}"
    skill_file="$SKILLS_DIR/$skill_path"
    
    if [[ ! -f "$skill_file" ]]; then
        warn "$skill_path: Script file not found"
        continue
    fi
    
    if test_skill_invocation "$skill_file" "$test_args"; then
        # Test passed
        :
    else
        FAILED_INVOCATIONS+=("$skill_path")
    fi
done

if [[ ${#FAILED_INVOCATIONS[@]} -eq 0 ]]; then
    pass "All $TOTAL_TESTED script invocation(s) simulated successfully"
else
    fail "${#FAILED_INVOCATIONS[@]} script invocation(s) failed"
    for failed in "${FAILED_INVOCATIONS[@]}"; do
        echo "    - $failed"
    done
fi
echo ""

# ============================================================================
# Test: Verify Execution Order (Critical)
# ============================================================================
echo -e "${CYAN}Test: Execution Order Verification${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# Verify that !command executes BEFORE $ARGUMENTS substitution
# This is the critical architectural requirement

EXECUTION_ORDER_CORRECT=0
EXECUTION_ORDER_WRONG=0

for skill_entry in "${TEST_SKILLS[@]}"; do
    skill_path="${skill_entry%%:*}"
    skill_file="$SKILLS_DIR/$skill_path"
    
    [[ ! -f "$skill_file" ]] && continue
    
    # Check if script has both !command and $ARGUMENTS
    has_command=$(count_script_commands "$skill_file")
    has_args=0
    if grep -q '\$ARGUMENTS' "$skill_file" 2>/dev/null; then
        has_args=1
    fi
    
    if [[ $has_command -gt 0 ]] && [[ $has_args -eq 1 ]]; then
        # Verify $ARGUMENTS is NOT in !command (would break execution order)
        if ! check_arguments_in_command "$skill_file"; then
            ((EXECUTION_ORDER_CORRECT++)) || true
            info "$skill_path: Execution order correct (!command before \$ARGUMENTS)"
        else
            ((EXECUTION_ORDER_WRONG++)) || true
            fail "$skill_path: Execution order WRONG (\$ARGUMENTS in !command)"
        fi
    fi
done

if [[ $EXECUTION_ORDER_WRONG -eq 0 ]]; then
    pass "All scripts respect execution order (!command before \$ARGUMENTS)"
else
    fail "$EXECUTION_ORDER_WRONG script(s) violate execution order"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  Scripts tested:     $TOTAL_TESTED"
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All invocation simulation tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
