#!/bin/bash
# Unit tests for hook stdin consumption compliance
# Verifies all hooks read stdin to prevent broken pipe errors
#
# CC 2.1.7 Requirement: All hooks must consume stdin even if not used
# When Claude Code pipes JSON to hooks and the hook doesn't read it,
# a broken pipe occurs causing "hook error" messages despite success.
#
# Root cause identified: 2026-01-18
# Affected hooks: context-budget-monitor.sh, coordination-heartbeat.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Test result tracking
declare -a FAILED_TESTS=()

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++)) || true
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++)) || true
    FAILED_TESTS+=("$1")
}

log_skip() {
    echo -e "${YELLOW}⊘${NC} $1 (skipped)"
    ((TESTS_SKIPPED++)) || true
}

log_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════"
}

# Check if a hook file consumes stdin
# Valid patterns:
#   _HOOK_INPUT=$(cat)
#   _HOOK_INPUT=$(cat 2>/dev/null || true)
#   cat > /dev/null
#   read -r HOOK_INPUT
check_stdin_consumption() {
    local hook_path="$1"
    local hook_name=$(basename "$hook_path")
    local hook_rel_path="${hook_path#$PROJECT_ROOT/}"

    # Skip non-executable or non-bash files
    if [[ ! -x "$hook_path" ]]; then
        log_skip "$hook_rel_path: Not executable"
        return 0
    fi

    # Check for stdin consumption patterns
    # Valid patterns:
    #   - _HOOK_INPUT=$(cat) or INPUT=$(cat) or OUTPUT=$(cat) - direct stdin read
    #   - init_hook_input - common.sh helper that reads stdin
    #   - cat > /dev/null - discard stdin
    #   - read -r INPUT - bash read
    if grep -qE '(_HOOK_)?(INPUT|OUTPUT)=\$\(cat|init_hook_input|cat\s*>\s*/dev/null|read\s+-r\s+.*INPUT|cat\s+2>/dev/null' "$hook_path" 2>/dev/null; then
        log_pass "$hook_rel_path"
        return 0
    else
        log_fail "$hook_rel_path: Missing stdin consumption (add: _HOOK_INPUT=\$(cat 2>/dev/null || true))"
        return 1
    fi
}

# Find all hooks in a directory
find_hooks() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        find "$dir" -name "*.sh" -type f 2>/dev/null | sort
    fi
}

# ASCII art explanation
show_explanation() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              WHY HOOKS MUST CONSUME STDIN                                 ║${NC}"
    echo -e "${CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║                                                                           ║${NC}"
    echo -e "${CYAN}║  Claude Code Hook Runner                                                  ║${NC}"
    echo -e "${CYAN}║         │                                                                 ║${NC}"
    echo -e "${CYAN}║         │ pipes JSON via stdin                                            ║${NC}"
    echo -e "${CYAN}║         ▼                                                                 ║${NC}"
    echo -e "${CYAN}║  ┌─────────────────────────────────────────────────────────────────┐     ║${NC}"
    echo -e "${CYAN}║  │  Hook Script                                                    │     ║${NC}"
    echo -e "${CYAN}║  │                                                                 │     ║${NC}"
    echo -e "${CYAN}║  │  ✅ WITH stdin read:    _HOOK_INPUT=\$(cat)                      │     ║${NC}"
    echo -e "${CYAN}║  │     stdin consumed → clean exit → no error                      │     ║${NC}"
    echo -e "${CYAN}║  │                                                                 │     ║${NC}"
    echo -e "${CYAN}║  │  ❌ WITHOUT stdin read: (no cat/read)                           │     ║${NC}"
    echo -e "${CYAN}║  │     stdin unconsumed → broken pipe → 'hook error' shown         │     ║${NC}"
    echo -e "${CYAN}║  └─────────────────────────────────────────────────────────────────┘     ║${NC}"
    echo -e "${CYAN}║                                                                           ║${NC}"
    echo -e "${CYAN}║  FIX: Add this line after 'set -euo pipefail':                           ║${NC}"
    echo -e "${CYAN}║       _HOOK_INPUT=\$(cat 2>/dev/null || true)                             ║${NC}"
    echo -e "${CYAN}║       export _HOOK_INPUT                                                  ║${NC}"
    echo -e "${CYAN}║                                                                           ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Main test execution
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Hook Stdin Consumption Compliance Tests              ║"
    echo "║          CC 2.1.7 Broken Pipe Prevention                      ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    # Hook directories to check
    local HOOK_DIRS=(
        "src/hooks/src/posttool"
        "src/hooks/src/pretool"
        "src/hooks/src/lifecycle"
        "src/hooks/src/stop"
        "src/hooks/src/subagent-stop"
        "src/hooks/src/permission"
        "src/hooks/src/notification"
        "src/hooks/src/skill"
        "src/hooks/src/prompt"
    )

    for dir in "${HOOK_DIRS[@]}"; do
        local full_dir="${PROJECT_ROOT}/${dir}"
        if [[ -d "$full_dir" ]]; then
            log_section "Checking $dir"
            while IFS= read -r hook; do
                check_stdin_consumption "$hook"
            done < <(find_hooks "$full_dir")
        fi
    done

    # Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                        TEST SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  Passed:  ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "  Failed:  ${RED}${TESTS_FAILED}${NC}"
    echo -e "  Skipped: ${YELLOW}${TESTS_SKIPPED}${NC}"
    echo ""

    if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
        echo "Failed tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "  ${RED}✗${NC} $test"
        done
        show_explanation
    fi

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}FAIL${NC}: Some hooks missing stdin consumption"
        echo "This will cause 'hook error' messages in Claude Code."
        exit 1
    else
        echo -e "${GREEN}PASS${NC}: All hooks consume stdin properly"
        exit 0
    fi
}

main "$@"
