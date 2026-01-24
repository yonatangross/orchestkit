#!/usr/bin/env bash
# Test: Validates runtime skill validation in subagent-validator
# Ensures agents referencing non-existent skills produce warnings
# GitHub Issue: #60
# Updated for Phase 4 TypeScript migration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/agents"
SKILLS_DIR="$REPO_ROOT/skills"
# Phase 4: Use TypeScript hook via run-hook.mjs
HOOK_RUNNER="$REPO_ROOT/hooks/bin/run-hook.mjs"
HOOK_HANDLER="subagent-start/subagent-validator"

# Function to run the TypeScript hook
run_hook() {
  local input="$1"
  echo "$input" | node "$HOOK_RUNNER" "$HOOK_HANDLER" 2>&1
}

# Test temp directory
TEST_TMP="${TMPDIR:-/tmp}/orchestkit-skill-validation-test-$$"
mkdir -p "$TEST_TMP"
trap 'rm -rf "$TEST_TMP"' EXIT

FAILED=0
PASSED=0

echo "=== Agent Skill Validation Test ==="
echo ""

# Test 1: Valid agent with all existing skills should produce no warnings
test_valid_agent_no_warnings() {
  echo -n "Test 1: Valid agent (backend-system-architect) produces no warnings... "

  local input='{"tool_input":{"subagent_type":"backend-system-architect","description":"Test"},"session_id":"test-123"}'
  local output

  # Run hook and capture all output
  output=$(CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook "$input") || true

  # Should not contain "missing skill" warning
  if [[ "$output" == *"missing skill"* ]]; then
    echo "FAIL"
    echo "  Unexpected warning: $output"
    return 1
  else
    echo "PASS"
    return 0
  fi
}

# Test 2: Create agent with fake skill and verify warning
test_missing_skill_warning() {
  echo -n "Test 2: Agent with missing skill produces warning... "

  # Create a test agent with a non-existent skill
  local test_agent="$TEST_TMP/test-missing-skill-agent.md"
  cat > "$test_agent" << 'EOF'
---
name: test-missing-skill-agent
description: Test agent with missing skill
model: sonnet
tools:
  - Read
skills:
  - non-existent-skill-12345
  - another-fake-skill-67890
---
Test agent for validation
EOF

  # Create test agents directory structure
  mkdir -p "$TEST_TMP/agents"
  cp "$test_agent" "$TEST_TMP/agents/test-missing-skill-agent.md"

  local input='{"tool_input":{"subagent_type":"test-missing-skill-agent","description":"Test"},"session_id":"test-123"}'
  local output

  # Run hook with our test directory
  # CLAUDE_PLUGIN_ROOT points to real repo for hooks/bin/run-hook.mjs
  # CLAUDE_PROJECT_DIR points to test dir for agents/skills lookup
  output=$(CLAUDE_PLUGIN_ROOT="$REPO_ROOT" CLAUDE_PROJECT_DIR="$TEST_TMP" run_hook "$input") || true

  # Should contain warning about missing skills
  if [[ "$output" == *"missing skill"* ]] && [[ "$output" == *"non-existent-skill-12345"* ]]; then
    echo "PASS"
    return 0
  else
    echo "FAIL"
    echo "  Expected warning about missing skills, got: $output"
    return 1
  fi
}

# Test 3: Builtin type should not produce skill warnings (no agent file)
test_builtin_type_no_warning() {
  echo -n "Test 3: Builtin type (Explore) produces no skill warnings... "

  local input='{"tool_input":{"subagent_type":"Explore","description":"Test"},"session_id":"test-123"}'
  local output

  output=$(CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook "$input") || true

  # Should not contain any warnings
  if [[ "$output" == *"missing skill"* ]]; then
    echo "FAIL"
    echo "  Unexpected warning for builtin type: $output"
    return 1
  else
    echo "PASS"
    return 0
  fi
}

# Test 4: Hook still returns valid JSON and continues
test_hook_continues_on_warning() {
  echo -n "Test 4: Hook returns valid JSON even with missing skills... "

  # Create a test agent with a non-existent skill
  mkdir -p "$TEST_TMP/agents"
  cat > "$TEST_TMP/agents/test-continue-agent.md" << 'EOF'
---
name: test-continue-agent
description: Test agent
model: sonnet
tools:
  - Read
skills:
  - totally-fake-skill
---
Test
EOF

  local input='{"tool_input":{"subagent_type":"test-continue-agent","description":"Test"},"session_id":"test-123"}'
  local output

  # CLAUDE_PLUGIN_ROOT points to real repo for hooks/bin/run-hook.mjs
  output=$(CLAUDE_PLUGIN_ROOT="$REPO_ROOT" CLAUDE_PROJECT_DIR="$TEST_TMP" run_hook "$input" 2>/dev/null) || true

  # Output may contain warning lines + JSON. Extract the last line which should be JSON.
  local json_line
  json_line=$(echo "$output" | grep -E '^\{.*\}$' | tail -1)

  # Should output valid JSON with continue: true
  if echo "$json_line" | jq -e '.continue == true' >/dev/null 2>&1; then
    echo "PASS"
    return 0
  else
    echo "FAIL"
    echo "  Expected JSON with continue:true, got: $output"
    return 1
  fi
}

# Test 5: Verify all real agents have valid skills
test_all_real_agents_valid() {
  echo -n "Test 5: All production agents reference valid skills... "

  local invalid_agents=()

  for agent_file in "$AGENTS_DIR"/*.md; do
    [[ -f "$agent_file" ]] || continue
    local agent_name
    agent_name=$(basename "$agent_file" .md)

    local input="{\"tool_input\":{\"subagent_type\":\"$agent_name\",\"description\":\"Test\"},\"session_id\":\"test-123\"}"
    local output

    output=$(CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook "$input") || true

    if [[ "$output" == *"missing skill"* ]]; then
      invalid_agents+=("$agent_name: $output")
    fi
  done

  if [[ ${#invalid_agents[@]} -eq 0 ]]; then
    echo "PASS"
    return 0
  else
    echo "FAIL"
    echo "  Agents with missing skills:"
    for msg in "${invalid_agents[@]}"; do
      echo "    - $msg"
    done
    return 1
  fi
}

# Test 6: Performance test - validation should complete quickly
test_validation_performance() {
  echo -n "Test 6: Skill validation completes in <200ms... "

  local input='{"tool_input":{"subagent_type":"backend-system-architect","description":"Test"},"session_id":"test-123"}'

  # Run 5 times and measure (TypeScript hooks have more overhead than shell)
  local start_ms end_ms duration_ms
  start_ms=$(python3 -c 'import time; print(int(time.time() * 1000))' 2>/dev/null || date +%s%3N)

  for i in {1..5}; do
    CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook "$input" >/dev/null 2>&1 || true
  done

  end_ms=$(python3 -c 'import time; print(int(time.time() * 1000))' 2>/dev/null || date +%s%3N)
  duration_ms=$((end_ms - start_ms))
  local avg_ms=$((duration_ms / 5))

  # TypeScript hooks have ~50-100ms JIT overhead, allow 200ms
  if [[ $avg_ms -lt 200 ]]; then
    echo "PASS (${avg_ms}ms avg)"
    return 0
  else
    echo "FAIL (${avg_ms}ms avg, expected <200ms)"
    return 1
  fi
}

# Run all tests
run_test() {
  if "$1"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
}

run_test test_valid_agent_no_warnings
run_test test_missing_skill_warning
run_test test_builtin_type_no_warning
run_test test_hook_continues_on_warning
run_test test_all_real_agents_valid
run_test test_validation_performance

echo ""
echo "=== Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo "All agent skill validation tests PASSED"
  exit 0
else
  echo "Some agent skill validation tests FAILED"
  exit 1
fi