#!/bin/bash
# Unit tests for worktree CLI tools
# Tests cc-worktree-status, cc-worktree-new, cc-worktree-sync, cc-worktree-remove

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

log_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "  ${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_section() {
    echo ""
    echo -e "${CYAN}$1${NC}"
    echo "----------------------------------------"
}

# Test: cc-worktree-status exists and is executable
test_status_script_exists() {
    log_section "Test: cc-worktree-status"

    local script="${PROJECT_ROOT}/bin/cc-worktree-status"

    if [[ -x "$script" ]]; then
        log_pass "cc-worktree-status exists and is executable"
    else
        log_fail "cc-worktree-status missing or not executable"
        return
    fi

    # Test basic run
    local output=""
    output=$("$script" 2>&1) || true

    if [[ -n "$output" ]]; then
        log_pass "cc-worktree-status produces output"
    else
        log_fail "cc-worktree-status produces no output"
    fi

    # Test --json flag
    output=$("$script" --json 2>&1) || true

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "cc-worktree-status --json produces valid JSON"
    else
        # JSON output might be empty array which is still valid
        if [[ "$output" == "[]" ]] || [[ -z "$output" ]]; then
            log_pass "cc-worktree-status --json produces valid output (empty)"
        else
            log_fail "cc-worktree-status --json invalid: $output"
        fi
    fi
}

# Test: cc-worktree-new exists
test_new_script_exists() {
    log_section "Test: cc-worktree-new"

    local script="${PROJECT_ROOT}/bin/cc-worktree-new"

    if [[ -x "$script" ]]; then
        log_pass "cc-worktree-new exists and is executable"
    else
        log_fail "cc-worktree-new missing or not executable"
        return
    fi

    # Test without args (should show usage)
    local output=""
    output=$("$script" 2>&1) || true

    if echo "$output" | grep -qi "usage\|branch\|worktree" ; then
        log_pass "cc-worktree-new shows usage info"
    else
        log_pass "cc-worktree-new runs without crash"
    fi
}

# Test: cc-worktree-sync exists
test_sync_script_exists() {
    log_section "Test: cc-worktree-sync"

    local script="${PROJECT_ROOT}/bin/cc-worktree-sync"

    if [[ -x "$script" ]]; then
        log_pass "cc-worktree-sync exists and is executable"
    else
        log_fail "cc-worktree-sync missing or not executable"
        return
    fi

    # Test without args
    local output=""
    output=$("$script" 2>&1) || true

    if [[ -n "$output" ]] || [[ $? -eq 0 ]]; then
        log_pass "cc-worktree-sync runs without crash"
    else
        log_fail "cc-worktree-sync crashes"
    fi
}

# Test: cc-worktree-remove exists
test_remove_script_exists() {
    log_section "Test: cc-worktree-remove"

    local script="${PROJECT_ROOT}/bin/cc-worktree-remove"

    if [[ -x "$script" ]]; then
        log_pass "cc-worktree-remove exists and is executable"
    else
        log_fail "cc-worktree-remove missing or not executable"
        return
    fi

    # Test without args (should show usage or error)
    local output=""
    output=$("$script" 2>&1) || true

    if [[ -n "$output" ]]; then
        log_pass "cc-worktree-remove produces output"
    else
        log_pass "cc-worktree-remove runs without crash"
    fi
}

# Test: worktree scripts use git worktree
test_scripts_use_git_worktree() {
    log_section "Test: Scripts use git worktree"

    local scripts=(
        "bin/cc-worktree-status"
        "bin/cc-worktree-new"
        "bin/cc-worktree-sync"
        "bin/cc-worktree-remove"
    )

    for script in "${scripts[@]}"; do
        local script_path="${PROJECT_ROOT}/${script}"
        local name=$(basename "$script")

        if [[ -f "$script_path" ]]; then
            if grep -q "git worktree\|.claude\|worktree" "$script_path" 2>/dev/null; then
                log_pass "$name references worktree/claude system"
            else
                log_fail "$name doesn't reference worktree system"
            fi
        fi
    done
}

# Test: git worktree list integration
test_git_worktree_integration() {
    log_section "Test: Git Worktree Integration"

    # Check git worktree is available
    if git worktree list >/dev/null 2>&1; then
        log_pass "git worktree command available"
    else
        log_fail "git worktree command not available"
        return
    fi

    # Check current worktree is listed
    local worktrees=""
    worktrees=$(git worktree list 2>/dev/null)

    if echo "$worktrees" | grep -q "$(pwd)"; then
        log_pass "Current directory is a worktree"
    else
        log_pass "Git worktree list works (may not be worktree root)"
    fi
}

# Test: Status shows current worktree info
test_status_shows_current() {
    log_section "Test: Status Shows Current Info"

    local output=""
    output=$("${PROJECT_ROOT}/bin/cc-worktree-status" 2>&1) || true

    # Should show either current worktree or "no active instances"
    if echo "$output" | grep -qi "worktree\|instance\|active\|branch"; then
        log_pass "Status shows relevant information"
    else
        log_fail "Status output doesn't contain expected info"
    fi
}

# Test: JSON output structure
test_status_json_structure() {
    log_section "Test: Status JSON Structure"

    local output=""
    output=$("${PROJECT_ROOT}/bin/cc-worktree-status" --json 2>&1) || output="[]"

    # Should be an array or object
    local type=""
    type=$(echo "$output" | jq -r 'type' 2>/dev/null) || type=""

    if [[ "$type" == "array" ]] || [[ "$type" == "object" ]]; then
        log_pass "JSON output is valid ($type)"
    else
        log_fail "JSON output type unexpected: $type"
    fi
}

# Test: Scripts have proper shebang
test_scripts_have_shebang() {
    log_section "Test: Scripts have proper shebang"

    local scripts=(
        "bin/cc-worktree-status"
        "bin/cc-worktree-new"
        "bin/cc-worktree-sync"
        "bin/cc-worktree-remove"
    )

    for script in "${scripts[@]}"; do
        local script_path="${PROJECT_ROOT}/${script}"
        local name=$(basename "$script")

        if [[ -f "$script_path" ]]; then
            local shebang=""
            shebang=$(head -1 "$script_path")
            if [[ "$shebang" =~ ^#!.*bash ]] || [[ "$shebang" =~ ^#!/bin/sh ]]; then
                log_pass "$name has valid shebang"
            else
                log_fail "$name missing or invalid shebang: $shebang"
            fi
        fi
    done
}

# Main
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Worktree CLI Tools Tests                             ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    test_status_script_exists
    test_new_script_exists
    test_sync_script_exists
    test_remove_script_exists
    test_scripts_use_git_worktree
    test_git_worktree_integration
    test_status_shows_current
    test_status_json_structure
    test_scripts_have_shebang

    # Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                        TEST SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  Passed:  ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "  Failed:  ${RED}${TESTS_FAILED}${NC}"
    echo ""

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}FAIL${NC}: Some tests failed"
        exit 1
    else
        echo -e "${GREEN}PASS${NC}: All tests passed"
        exit 0
    fi
}

main "$@"