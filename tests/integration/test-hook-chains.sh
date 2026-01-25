#!/bin/bash
# Hook Chain Integration Tests
# Tests complete hook chains end-to-end
#
# Usage: ./test-hook-chains.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/src/hooks"
SETTINGS_FILE="$PROJECT_ROOT/.claude/settings.json"

VERBOSE="${1:-}"
FAILED=0
PASSED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Setup test environment
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
export CLAUDE_SESSION_ID="integration-test-$(date +%s)"

# Temp directory
TEST_TMP=$(mktemp -d)
trap "rm -rf $TEST_TMP" EXIT

echo "=========================================="
echo "  Hook Chain Integration Tests"
echo "=========================================="
echo ""

# Check settings.json exists
if [[ ! -f "$SETTINGS_FILE" ]]; then
    echo -e "${RED}ERROR: settings.json not found${NC}"
    exit 1
fi

# Extract hook chains from settings
get_hooks_for_event() {
    local event="$1"
    local matcher="${2:-*}"
    jq -r ".hooks.${event}[] | select(.matcher == \"$matcher\" or .matcher == null) | .hooks[].command" "$SETTINGS_FILE" 2>/dev/null | \
        sed "s|\"\$CLAUDE_PROJECT_DIR\"|$PROJECT_ROOT|g" || echo ""
}

# Run a chain of hooks
run_hook_chain() {
    local event="$1"
    local matcher="$2"
    local input="$3"
    local expected_exit="${4:-0}"

    echo -e "${CYAN}Chain: $event ($matcher)${NC}"

    local hooks=$(get_hooks_for_event "$event" "$matcher")
    if [[ -z "$hooks" ]]; then
        echo "  No hooks configured for this chain"
        return 0
    fi

    local chain_input="$input"
    local hook_num=1
    local chain_exit=0

    while IFS= read -r hook_cmd; do
        [[ -z "$hook_cmd" ]] && continue

        # Clean up the command (remove quotes)
        hook_cmd="${hook_cmd#\"}"
        hook_cmd="${hook_cmd%\"}"

        local hook_name=$(basename "$hook_cmd" .sh)
        echo -n "  $hook_num. $hook_name... "

        if [[ ! -f "$hook_cmd" ]]; then
            echo -e "${YELLOW}SKIP${NC} (not found)"
            ((hook_num++))
            continue
        fi

        local output_file="$TEST_TMP/chain_${hook_num}_out.txt"
        local error_file="$TEST_TMP/chain_${hook_num}_err.txt"

        local exit_code=0
        echo "$chain_input" | perl -e 'alarm 10; exec @ARGV' bash "$hook_cmd" > "$output_file" 2> "$error_file" || exit_code=$?
        # Normalize timeout exit code
        [[ $exit_code -eq 142 ]] && exit_code=124

        if [[ $exit_code -eq 0 ]]; then
            echo -e "${GREEN}OK${NC}"
            # Pass output to next hook (if any)
            if [[ -s "$output_file" ]]; then
                chain_input=$(cat "$output_file")
            fi
        elif [[ $exit_code -eq 2 ]]; then
            # Exit code 2 = blocked (expected for some hooks)
            echo -e "${YELLOW}BLOCKED${NC}"
            chain_exit=2
            break
        else
            echo -e "${RED}FAIL (exit $exit_code)${NC}"
            if [[ "$VERBOSE" == "--verbose" ]]; then
                echo "    STDERR: $(cat "$error_file")"
            fi
            chain_exit=$exit_code
        fi

        ((hook_num++))
    done <<< "$hooks"

    return $chain_exit
}

echo -e "${CYAN}Testing PreToolUse Chains${NC}"
echo "=========================================="

# Test Read chain
echo ""
read_input='{"tool_name":"Read","tool_input":{"file_path":"'"$PROJECT_ROOT"'/.claude-plugin/plugin.json"},"session_id":"test"}'
if run_hook_chain "PreToolUse" "Read|Write|Edit|Glob|Grep" "$read_input" 0; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi

# Test Bash chain (safe command)
echo ""
bash_input='{"tool_name":"Bash","tool_input":{"command":"git status"},"session_id":"test"}'
if run_hook_chain "PreToolUse" "Bash" "$bash_input" 0; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi

echo ""
echo -e "${CYAN}Testing PostToolUse Chains${NC}"
echo "=========================================="

# Test universal PostToolUse chain
echo ""
post_input='{"tool_name":"Read","tool_output":"test content","exit_code":0,"session_id":"test"}'
if run_hook_chain "PostToolUse" "*" "$post_input" 0; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi

echo ""
echo -e "${CYAN}Testing Permission Chains${NC}"
echo "=========================================="

# Test Read permission chain
echo ""
perm_input='{"tool_name":"Read","tool_input":{"file_path":"'"$PROJECT_ROOT"'/README.md"},"session_id":"test"}'
if run_hook_chain "PermissionRequest" "Read|Glob|Grep" "$perm_input" 0; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi

echo ""
echo "=========================================="
echo "  Results: $PASSED chains passed, $FAILED chains failed"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: Some chain tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All chain tests passed${NC}"
    exit 0
fi
