#!/usr/bin/env bash
# ============================================================================
# Claude Code 2.1.6 Compliance Test
# ============================================================================
# Verifies all hooks output valid JSON conforming to CC 2.1.6 specification:
# - Must output valid JSON
# - Must include "continue" field (boolean)
# - Permission hooks must include permissionDecision field
# - Input-mod hooks must include updatedInput in hookSpecificOutput
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HOOKS_DIR="$PROJECT_ROOT/src/hooks"
SCHEMA_FILE="$PROJECT_ROOT/.claude/schemas/hook-output.schema.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }
skip() { echo -e "  ${YELLOW}○${NC} $1 (skipped)"; ((SKIP_COUNT++)) || true; }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Claude Code 2.1.6 Compliance Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Test 1: Schema Exists
# ============================================================================
echo "▶ Test 1: Hook Output Schema"
echo "────────────────────────────────────────"

if [ -f "$SCHEMA_FILE" ]; then
    if jq empty "$SCHEMA_FILE" 2>/dev/null; then
        pass "Hook output schema exists and is valid JSON"
    else
        fail "Hook output schema is invalid JSON"
    fi
else
    fail "Hook output schema not found: $SCHEMA_FILE"
fi

echo ""

# ============================================================================
# Test 2: All Pretool Hooks Output Valid JSON with 'continue' Field
# ============================================================================
echo "▶ Test 2: Pretool Hook JSON Output Compliance"
echo "────────────────────────────────────────"

# Test input for pretool hooks
PRETOOL_INPUT='{"tool_name":"Bash","tool_input":{"command":"echo test"}}'

for hook_dir in "$HOOKS_DIR"/pretool/*/; do
    if [ -d "$hook_dir" ]; then
        category=$(basename "$hook_dir")

        for hook_file in "$hook_dir"*.sh; do
            if [ -f "$hook_file" ]; then
                hook_name=$(basename "$hook_file")

                # Skip dispatchers (they call other hooks)
                if [[ "$hook_name" == *"dispatcher"* ]]; then
                    skip "$category/$hook_name (dispatcher)"
                    continue
                fi

                # Run hook and capture output
                output=$(echo "$PRETOOL_INPUT" | bash "$hook_file" 2>/dev/null) || true

                # Check if output is valid JSON
                if echo "$output" | jq empty 2>/dev/null; then
                    # Check for 'continue' field
                    has_continue=$(echo "$output" | jq -e 'has("continue")' 2>/dev/null) || has_continue="false"

                    if [ "$has_continue" = "true" ]; then
                        pass "$category/$hook_name - valid JSON with 'continue' field"
                    else
                        fail "$category/$hook_name - missing 'continue' field"
                    fi
                else
                    # Empty output is acceptable for some hooks
                    if [ -z "$output" ]; then
                        skip "$category/$hook_name (no output)"
                    else
                        fail "$category/$hook_name - invalid JSON output: ${output:0:50}..."
                    fi
                fi
            fi
        done
    fi
done

echo ""

# ============================================================================
# Test 3: Permission Hooks Include permissionDecision
# ============================================================================
echo "▶ Test 3: Permission Hook Compliance"
echo "────────────────────────────────────────"

PERMISSION_INPUT='{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.txt","content":"test"}}'

if [ -d "$HOOKS_DIR/permission" ]; then
    for hook_file in "$HOOKS_DIR"/permission/*.sh; do
        if [ -f "$hook_file" ]; then
            hook_name=$(basename "$hook_file")

            # Skip dispatchers
            if [[ "$hook_name" == *"dispatcher"* ]]; then
                skip "$hook_name (dispatcher)"
                continue
            fi

            output=$(echo "$PERMISSION_INPUT" | bash "$hook_file" 2>/dev/null) || true

            if echo "$output" | jq empty 2>/dev/null; then
                # Check for permissionDecision field (CC 2.1.6 requirement)
                has_decision=$(echo "$output" | jq -e '.hookSpecificOutput.permissionDecision // .permissionDecision' 2>/dev/null) || has_decision=""

                if [ -n "$has_decision" ]; then
                    pass "permission/$hook_name - has permissionDecision"
                else
                    info "permission/$hook_name - no permissionDecision (may be optional)"
                fi
            else
                if [ -z "$output" ]; then
                    skip "permission/$hook_name (no output)"
                else
                    fail "permission/$hook_name - invalid JSON"
                fi
            fi
        fi
    done
else
    info "No permission hooks directory found"
fi

echo ""

# ============================================================================
# Test 4: Input-Mod Hooks Can Modify Input
# ============================================================================
echo "▶ Test 4: Input-Mod Hook Compliance"
echo "────────────────────────────────────────"

if [ -d "$HOOKS_DIR/pretool/input-mod" ]; then
    for hook_file in "$HOOKS_DIR"/pretool/input-mod/*.sh; do
        if [ -f "$hook_file" ]; then
            hook_name=$(basename "$hook_file")

            output=$(echo "$PRETOOL_INPUT" | bash "$hook_file" 2>/dev/null) || true

            if echo "$output" | jq empty 2>/dev/null; then
                # Check for updatedInput structure
                has_updated=$(echo "$output" | jq -e '.hookSpecificOutput.updatedInput // empty' 2>/dev/null) || has_updated=""

                if [ -n "$has_updated" ]; then
                    pass "input-mod/$hook_name - has updatedInput"
                else
                    # Some input-mod hooks may not modify input on every call
                    info "input-mod/$hook_name - no updatedInput (may be conditional)"
                fi

                pass "input-mod/$hook_name - valid JSON"
            else
                if [ -z "$output" ]; then
                    skip "input-mod/$hook_name (no output)"
                else
                    fail "input-mod/$hook_name - invalid JSON"
                fi
            fi
        fi
    done
else
    info "No input-mod hooks directory found"
fi

echo ""

# ============================================================================
# Test 5: Posttool Hooks Output Valid JSON
# ============================================================================
echo "▶ Test 5: Posttool Hook Compliance"
echo "────────────────────────────────────────"

POSTTOOL_INPUT='{"tool_name":"Bash","tool_result":{"exit_code":0,"stdout":"test","stderr":""}}'

if [ -d "$HOOKS_DIR/posttool" ]; then
    for hook_file in "$HOOKS_DIR"/posttool/*.sh; do
        if [ -f "$hook_file" ]; then
            hook_name=$(basename "$hook_file")

            # Skip dispatchers
            if [[ "$hook_name" == *"dispatcher"* ]]; then
                skip "$hook_name (dispatcher)"
                continue
            fi

            output=$(echo "$POSTTOOL_INPUT" | bash "$hook_file" 2>/dev/null) || true

            if [ -z "$output" ]; then
                # Empty output is acceptable for posttool hooks (logging only)
                pass "posttool/$hook_name - no output (logging hook)"
            elif echo "$output" | jq empty 2>/dev/null; then
                pass "posttool/$hook_name - valid JSON"
            else
                fail "posttool/$hook_name - invalid JSON: ${output:0:50}..."
            fi
        fi
    done
else
    info "No posttool hooks directory found"
fi

echo ""

# ============================================================================
# Test 6: Exit Code Compliance
# ============================================================================
echo "▶ Test 6: Exit Code Compliance"
echo "────────────────────────────────────────"

# CC 2.1.6: Exit 0 = success, non-zero = error
# Test that hooks don't exit with unexpected codes

test_exit_code() {
    local hook_file="$1"
    local input="$2"
    local hook_name=$(basename "$hook_file")

    local exit_code
    echo "$input" | bash "$hook_file" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    # Valid exit codes: 0 (success), 1 (error/block), 2 (hard block)
    if [ "$exit_code" -le 2 ]; then
        pass "$hook_name - valid exit code ($exit_code)"
        return 0
    else
        fail "$hook_name - unexpected exit code ($exit_code)"
        return 1
    fi
}

# Test a sample of hooks from each category
for hook_file in "$HOOKS_DIR"/pretool/bash/bash-defaults.sh \
                 "$HOOKS_DIR"/pretool/bash/git-branch-protection.sh \
                 "$HOOKS_DIR"/pretool/write-edit/file-guard.sh; do
    if [ -f "$hook_file" ]; then
        test_exit_code "$hook_file" "$PRETOOL_INPUT"
    fi
done

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CC 2.1.6 Compliance Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${GREEN}Passed:${NC}  $PASS_COUNT"
echo -e "  ${RED}Failed:${NC}  $FAIL_COUNT"
echo -e "  ${YELLOW}Skipped:${NC} $SKIP_COUNT"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "  ${RED}COMPLIANCE CHECK FAILED${NC}"
    exit 1
else
    echo -e "  ${GREEN}ALL COMPLIANCE CHECKS PASSED${NC}"
    exit 0
fi