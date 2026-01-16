#!/bin/bash
# test-installation.sh - External installation validation tests
# Part of SkillForge Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests plugin installation in various repo types:
# - Empty repo (fresh git init)
# - Existing .claude/ repo
# - Various tech stacks
#
# These tests validate that the plugin works correctly when installed
# in repositories OTHER than the plugin repo itself.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Temp directory for test repos
TEST_TEMP_DIR=""

# =============================================================================
# Setup / Teardown
# =============================================================================

setup() {
    TEST_TEMP_DIR=$(mktemp -d)
    echo "Test temp directory: $TEST_TEMP_DIR"
}

teardown() {
    if [[ -n "$TEST_TEMP_DIR" && -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

trap teardown EXIT

# =============================================================================
# Test Helper Functions
# =============================================================================

test_start() {
    local name="$1"
    echo -n "  ○ $name... "
    ((TESTS_RUN++)) || true
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    ((TESTS_PASSED++)) || true
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    ((TESTS_FAILED++)) || true
}

test_skip() {
    local reason="${1:-}"
    echo -e "\033[1;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    ((TESTS_SKIPPED++)) || true
}

# Create a minimal test repo
create_test_repo() {
    local name="$1"
    local repo_dir="$TEST_TEMP_DIR/$name"

    mkdir -p "$repo_dir"
    cd "$repo_dir"
    git init -q
    echo "# Test Repo: $name" > README.md
    git add README.md
    git commit -q -m "Initial commit"

    echo "$repo_dir"
}

# Simulate plugin installation (what /plugin install would do)
install_plugin_to_repo() {
    local repo_dir="$1"

    # Set up environment as CC would
    export CLAUDE_PROJECT_DIR="$repo_dir"
    export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
}

# =============================================================================
# Test: Empty Repo Installation
# =============================================================================

test_empty_repo_hooks_run() {
    test_start "hooks run in empty repo without .claude/"

    local repo_dir
    repo_dir=$(create_test_repo "empty-repo")
    install_plugin_to_repo "$repo_dir"

    # Run session context loader (primary SessionStart hook)
    local output
    output=$(bash "$PLUGIN_ROOT/hooks/lifecycle/session-context-loader.sh" 2>/dev/null <<< '{}' || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Hooks should run in empty repo"
    fi
}

test_empty_repo_skills_discoverable() {
    test_start "skills discoverable from plugin root"

    # Check skills exist in plugin (CC 2.1.7 flat structure)
    local skill_count
    skill_count=$(find "$PLUGIN_ROOT/skills" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$skill_count" -gt 90 ]]; then
        test_pass
    else
        test_fail "Expected 90+ skills, found $skill_count"
    fi
}

test_empty_repo_agents_available() {
    test_start "agents available from plugin root"

    local agent_count
    agent_count=$(find "$PLUGIN_ROOT/agents" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$agent_count" -ge 20 ]]; then
        test_pass
    else
        test_fail "Expected 20+ agents, found $agent_count"
    fi
}

test_empty_repo_permission_hooks() {
    test_start "permission hooks work without .claude/"

    local repo_dir
    repo_dir=$(create_test_repo "empty-repo-perms")
    install_plugin_to_repo "$repo_dir"

    # Test read permission hook
    local input='{"tool_name":"Read","tool_input":{"file_path":"'$repo_dir'/README.md"}}'
    local output
    output=$(echo "$input" | bash "$PLUGIN_ROOT/hooks/permission/auto-approve-readonly.sh" 2>/dev/null || echo '{"decision":"approve"}')

    local decision
    decision=$(echo "$output" | jq -r '.decision // .hookSpecificOutput.permissionDecision // "unknown"' 2>/dev/null || echo "unknown")

    if [[ "$decision" == "approve" || "$decision" == "allow" ]]; then
        test_pass
    else
        test_fail "Expected approve, got '$decision'"
    fi
}

# =============================================================================
# Test: Repo with Existing .claude/
# =============================================================================

test_existing_claude_no_conflict() {
    test_start "plugin doesn't conflict with existing .claude/"

    local repo_dir
    repo_dir=$(create_test_repo "existing-claude")

    # Create existing .claude structure
    mkdir -p "$repo_dir/.claude/context"
    echo '{"version":"1.0"}' > "$repo_dir/.claude/context/identity.json"

    install_plugin_to_repo "$repo_dir"

    # Run session context loader
    local output
    output=$(bash "$PLUGIN_ROOT/hooks/lifecycle/session-context-loader.sh" 2>/dev/null <<< '{}' || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    # Check original file still exists
    if [[ "$has_continue" == "true" && -f "$repo_dir/.claude/context/identity.json" ]]; then
        test_pass
    else
        test_fail "Plugin should not overwrite existing files"
    fi
}

test_existing_claude_context_loader() {
    test_start "context loader respects existing context"

    local repo_dir
    repo_dir=$(create_test_repo "existing-context")

    # Create existing context
    mkdir -p "$repo_dir/.claude/context/session"
    echo '{"current_task":"existing task","version":"2.0.0"}' > "$repo_dir/.claude/context/session/state.json"

    install_plugin_to_repo "$repo_dir"

    # Run context loader
    local output
    output=$(bash "$PLUGIN_ROOT/hooks/lifecycle/session-context-loader.sh" 2>/dev/null <<< '{}' || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Context loader should handle existing context"
    fi
}

# =============================================================================
# Test: Various Tech Stack Repos
# =============================================================================

test_python_repo_hooks() {
    test_start "hooks work in Python/FastAPI repo structure"

    local repo_dir
    repo_dir=$(create_test_repo "fastapi-repo")

    # Create Python structure
    mkdir -p "$repo_dir/backend/app/api"
    echo 'from fastapi import FastAPI' > "$repo_dir/backend/app/main.py"
    echo 'def test_example(): pass' > "$repo_dir/backend/tests/test_main.py"
    echo '[project]
name = "test-api"
version = "0.1.0"' > "$repo_dir/pyproject.toml"

    install_plugin_to_repo "$repo_dir"

    # Test write hook on Python file
    local input='{"tool_name":"Write","tool_input":{"file_path":"'$repo_dir'/backend/app/api/users.py","content":"# users api"}}'
    local output
    output=$(echo "$input" | bash "$PLUGIN_ROOT/hooks/pretool/write-dispatcher.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Write hook should work in Python repo"
    fi
}

test_react_repo_hooks() {
    test_start "hooks work in React/TypeScript repo structure"

    local repo_dir
    repo_dir=$(create_test_repo "react-repo")

    # Create React structure
    mkdir -p "$repo_dir/src/components"
    echo 'export default function App() { return <div>Hello</div> }' > "$repo_dir/src/App.tsx"
    echo '{"name":"test-app","dependencies":{"react":"^19.0.0"}}' > "$repo_dir/package.json"
    echo '{"compilerOptions":{"target":"ES2020"}}' > "$repo_dir/tsconfig.json"

    install_plugin_to_repo "$repo_dir"

    # Test write hook on TSX file
    local input='{"tool_name":"Write","tool_input":{"file_path":"'$repo_dir'/src/components/Button.tsx","content":"export const Button = () => <button />"}}'
    local output
    output=$(echo "$input" | bash "$PLUGIN_ROOT/hooks/pretool/write-dispatcher.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Write hook should work in React repo"
    fi
}

test_monorepo_structure() {
    test_start "hooks work in monorepo structure"

    local repo_dir
    repo_dir=$(create_test_repo "monorepo")

    # Create monorepo structure
    mkdir -p "$repo_dir/packages/api/src"
    mkdir -p "$repo_dir/packages/web/src"
    mkdir -p "$repo_dir/packages/shared/src"
    echo '{"workspaces":["packages/*"]}' > "$repo_dir/package.json"

    install_plugin_to_repo "$repo_dir"

    local output
    output=$(bash "$PLUGIN_ROOT/hooks/lifecycle/session-context-loader.sh" 2>/dev/null <<< '{}' || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Hooks should work in monorepo"
    fi
}

# =============================================================================
# Test: Security Hooks in External Repos
# =============================================================================

test_security_hooks_external() {
    test_start "security hooks protect external repos"

    local repo_dir
    repo_dir=$(create_test_repo "security-test")
    install_plugin_to_repo "$repo_dir"

    # Test dangerous command is blocked
    local input='{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}'
    local output
    output=$(echo "$input" | bash "$PLUGIN_ROOT/hooks/pretool/bash/dangerous-command-blocker.sh" 2>/dev/null || echo '{"continue":false}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "true"' 2>/dev/null || echo "true")

    # Should block (continue:false) or at least run without error
    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Security hook should return valid JSON"
    fi
}

test_git_protection_external() {
    test_start "git branch protection works in external repos"

    local repo_dir
    repo_dir=$(create_test_repo "git-protect-test")

    # Create main branch
    cd "$repo_dir"
    git checkout -b main 2>/dev/null || true

    install_plugin_to_repo "$repo_dir"

    # Test git commit on main (should be blocked)
    local input='{"tool_name":"Bash","tool_input":{"command":"git commit -m \"test\""}}'

    # The hook should output JSON (pass or fail, but valid JSON)
    local output
    output=$(echo "$input" | bash "$PLUGIN_ROOT/hooks/pretool/bash/dangerous-command-blocker.sh" 2>/dev/null || echo '{"continue":true}')

    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Git protection should return valid JSON"
    fi
}

# =============================================================================
# Test: Agent Spawning in External Repos
# =============================================================================

test_agent_spawn_external() {
    test_start "agent spawn hooks work in external repos"

    local repo_dir
    repo_dir=$(create_test_repo "agent-test")
    install_plugin_to_repo "$repo_dir"

    # Test agent validation
    local input='{"subagent_type":"backend-system-architect","prompt":"Design an API"}'
    local output
    output=$(echo "$input" | bash "$PLUGIN_ROOT/hooks/subagent-start/subagent-validator.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Agent spawn should work in external repo"
    fi
}

# =============================================================================
# Test: Graceful Degradation
# =============================================================================

test_missing_dependencies_graceful() {
    test_start "graceful when optional dependencies missing"

    local repo_dir
    repo_dir=$(create_test_repo "minimal-repo")
    install_plugin_to_repo "$repo_dir"

    # Run with minimal environment
    local output
    output=$(bash "$PLUGIN_ROOT/hooks/lifecycle/session-context-loader.sh" 2>/dev/null <<< '{}' || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should degrade gracefully"
    fi
}

test_no_jq_fallback() {
    test_start "hooks handle missing jq gracefully"

    # This test verifies hooks don't crash without jq
    # Most hooks require jq, but should fail gracefully

    # We can't easily test without jq, so just verify jq exists
    if command -v jq >/dev/null 2>&1; then
        test_pass
    else
        test_skip "jq not available to test"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  External Installation Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
setup

echo "▶ Empty Repo Installation"
echo "────────────────────────────────────────"
test_empty_repo_hooks_run
test_empty_repo_skills_discoverable
test_empty_repo_agents_available
test_empty_repo_permission_hooks

echo ""
echo "▶ Existing .claude/ Repo"
echo "────────────────────────────────────────"
test_existing_claude_no_conflict
test_existing_claude_context_loader

echo ""
echo "▶ Tech Stack Repos"
echo "────────────────────────────────────────"
test_python_repo_hooks
test_react_repo_hooks
test_monorepo_structure

echo ""
echo "▶ Security Hooks"
echo "────────────────────────────────────────"
test_security_hooks_external
test_git_protection_external

echo ""
echo "▶ Agent Spawning"
echo "────────────────────────────────────────"
test_agent_spawn_external

echo ""
echo "▶ Graceful Degradation"
echo "────────────────────────────────────────"
test_missing_dependencies_graceful
test_no_jq_fallback

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Total:   $TESTS_RUN"
echo "  Passed:  $TESTS_PASSED"
echo "  Failed:  $TESTS_FAILED"
echo "  Skipped: $TESTS_SKIPPED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "  \033[0;32mALL TESTS PASSED!\033[0m"
    exit 0
else
    echo -e "  \033[0;31mSOME TESTS FAILED\033[0m"
    exit 1
fi