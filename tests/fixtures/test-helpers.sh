#!/bin/bash
# SkillForge Plugin Test Helpers
# Source this file in test scripts: source "$(dirname "$0")/../fixtures/test-helpers.sh"
#
# Version: 1.0.0
# Part of Comprehensive Test Suite v4.5.0

set -euo pipefail

# ============================================================================
# TEST FRAMEWORK CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"
FIXTURES_DIR="$PROJECT_ROOT/tests/fixtures"
TEMP_DIR="${TMPDIR:-/tmp}/skillforge-tests-$$"

# Export for hooks to use
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Colors (only if stderr is a terminal)
if [[ -t 2 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' NC=''
fi

# ============================================================================
# TEST LIFECYCLE
# ============================================================================

# Setup test environment
setup_test_env() {
  mkdir -p "$TEMP_DIR"
  mkdir -p "$TEMP_DIR/logs"
  mkdir -p "$TEMP_DIR/context"

  # Create empty log files
  touch "$TEMP_DIR/logs/hooks.log"
  touch "$TEMP_DIR/logs/audit.log"
  touch "$TEMP_DIR/logs/subagent-spawns.jsonl"

  # Override log directory for tests
  export HOOK_LOG_DIR="$TEMP_DIR/logs"
  export SKILLFORGE_TEST_MODE=1
}

# Cleanup test environment
cleanup_test_env() {
  # Only cleanup in the main shell, not subshells
  # Check if we're in the main shell by comparing BASHPID with the stored main PID
  if [[ "${MAIN_SHELL_PID:-}" == "$$" ]] && [[ -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}

# Store main shell PID for cleanup check
MAIN_SHELL_PID=$$

# Register cleanup on exit (only runs in main shell)
trap cleanup_test_env EXIT

# ============================================================================
# TEST ASSERTIONS
# ============================================================================

# Assert exit code matches expected
# Usage: assert_exit_code <expected> [actual]
assert_exit_code() {
  local expected="$1"
  local actual="${2:-$?}"

  if [[ "$actual" -eq "$expected" ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: Expected exit code $expected, got $actual" >&2
    return 1
  fi
}

# Assert string contains substring
# Usage: assert_contains "$string" "$substring"
assert_contains() {
  local string="$1"
  local substring="$2"

  if [[ "$string" == *"$substring"* ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: String does not contain '$substring'" >&2
    echo "  String: ${string:0:200}..." >&2
    return 1
  fi
}

# Assert string does NOT contain substring
# Usage: assert_not_contains "$string" "$substring"
assert_not_contains() {
  local string="$1"
  local substring="$2"

  if [[ "$string" != *"$substring"* ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: String should not contain '$substring'" >&2
    return 1
  fi
}

# Assert string matches regex
# Usage: assert_matches "$string" "$regex"
assert_matches() {
  local string="$1"
  local regex="$2"

  if [[ "$string" =~ $regex ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: String does not match regex '$regex'" >&2
    return 1
  fi
}

# Assert file exists
# Usage: assert_file_exists "$path"
assert_file_exists() {
  local path="$1"

  if [[ -f "$path" ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: File does not exist: $path" >&2
    return 1
  fi
}

# Assert file contains string
# Usage: assert_file_contains "$path" "$substring"
assert_file_contains() {
  local path="$1"
  local substring="$2"

  if [[ -f "$path" ]] && grep -q "$substring" "$path" 2>/dev/null; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: File '$path' does not contain '$substring'" >&2
    return 1
  fi
}

# Assert value equals expected
# Usage: assert_equals "$expected" "$actual"
assert_equals() {
  local expected="$1"
  local actual="$2"

  if [[ "$expected" == "$actual" ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: Expected '$expected', got '$actual'" >&2
    return 1
  fi
}

# Assert value is less than
# Usage: assert_less_than $value $max
assert_less_than() {
  local value="$1"
  local max="$2"

  if [[ "$value" -lt "$max" ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: $value is not less than $max" >&2
    return 1
  fi
}

# Assert value is greater than
# Usage: assert_greater_than $value $min
assert_greater_than() {
  local value="$1"
  local min="$2"

  if [[ "$value" -gt "$min" ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: $value is not greater than $min" >&2
    return 1
  fi
}

# Assert stderr contains string
# Usage: assert_stderr_contains "$output" "$substring"
assert_stderr_contains() {
  local output="$1"
  local substring="$2"
  assert_contains "$output" "$substring"
}

# Assert log file contains message
# Usage: assert_log_contains "$substring"
assert_log_contains() {
  local substring="$1"
  local logfile="$HOOK_LOG_DIR/hooks.log"

  if [[ -f "$logfile" ]] && grep -q "$substring" "$logfile" 2>/dev/null; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: Log does not contain '$substring'" >&2
    return 1
  fi
}

# Assert JSON is valid
# Usage: assert_valid_json "$json"
assert_valid_json() {
  local json="$1"

  if echo "$json" | jq empty 2>/dev/null; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: Invalid JSON: ${json:0:100}..." >&2
    return 1
  fi
}

# Assert JSON field equals value
# Usage: assert_json_field "$json" ".field" "expected_value"
assert_json_field() {
  local json="$1"
  local field="$2"
  local expected="$3"

  local actual=$(echo "$json" | jq -r "$field" 2>/dev/null)

  if [[ "$actual" == "$expected" ]]; then
    return 0
  else
    echo -e "${RED}ASSERTION FAILED${NC}: JSON field $field: expected '$expected', got '$actual'" >&2
    return 1
  fi
}

# ============================================================================
# HOOK EXECUTION HELPERS
# ============================================================================

# Run a hook script with input
# Usage: run_hook "path/to/hook.sh" "$input"
run_hook() {
  local hook_path="$1"
  local input="${2:-{}}"
  local full_path="$HOOKS_DIR/$hook_path"

  if [[ ! -f "$full_path" ]]; then
    echo "Hook not found: $full_path" >&2
    return 127
  fi

  echo "$input" | bash "$full_path" 2>&1
}

# Run hook and capture exit code
# Usage: run_hook_capture "path/to/hook.sh" "$input"
# Returns: Sets HOOK_OUTPUT and HOOK_EXIT_CODE
run_hook_capture() {
  local hook_path="$1"
  local input="${2:-{}}"

  HOOK_OUTPUT=$(run_hook "$hook_path" "$input" 2>&1) && HOOK_EXIT_CODE=0 || HOOK_EXIT_CODE=$?
}

# Run a hook chain
# Usage: run_hook_chain "PreToolUse" "Bash" "$input"
run_hook_chain() {
  local hook_type="$1"
  local matcher="$2"
  local input="${3:-{}}"
  local settings_file="$PROJECT_ROOT/.claude/settings.json"

  if [[ ! -f "$settings_file" ]]; then
    echo "Settings file not found" >&2
    return 1
  fi

  # Get hooks for this type and matcher
  local hooks=$(jq -r ".hooks.\"$hook_type\"[] | select(.matcher == \"$matcher\" or .matcher == \"*\") | .hooks[].command" "$settings_file" 2>/dev/null)

  local chain_output="$input"
  while IFS= read -r hook_cmd; do
    if [[ -n "$hook_cmd" ]]; then
      # Substitute CLAUDE_PROJECT_DIR
      hook_cmd="${hook_cmd//\$CLAUDE_PROJECT_DIR/$PROJECT_ROOT}"
      hook_cmd="${hook_cmd//\"\$CLAUDE_PROJECT_DIR\"/$PROJECT_ROOT}"

      chain_output=$(echo "$chain_output" | bash -c "$hook_cmd" 2>&1) || return $?
    fi
  done <<< "$hooks"

  echo "$chain_output"
}

# ============================================================================
# TEST FIXTURES
# ============================================================================

# Load fixture from JSON file
# Usage: load_fixture "hook-inputs" "pretool_bash_safe"
load_fixture() {
  local fixture_file="$1"
  local fixture_key="$2"

  jq -r ".\"$fixture_key\"" "$FIXTURES_DIR/${fixture_file}.json" 2>/dev/null
}

# Create temporary test file
# Usage: create_test_file "content" "filename"
create_test_file() {
  local content="$1"
  local filename="${2:-test-file.txt}"
  local filepath="$TEMP_DIR/$filename"

  mkdir -p "$(dirname "$filepath")"
  echo "$content" > "$filepath"
  echo "$filepath"
}

# Create symlink for testing
# Usage: create_test_symlink "target" "linkname"
create_test_symlink() {
  local target="$1"
  local linkname="$2"
  local linkpath="$TEMP_DIR/$linkname"

  mkdir -p "$(dirname "$linkpath")"
  ln -sf "$target" "$linkpath"
  echo "$linkpath"
}

# Simulate subagent spawn log entries
# Usage: simulate_spawns $count
simulate_spawns() {
  local count="$1"
  local spawn_log="$HOOK_LOG_DIR/subagent-spawns.jsonl"

  for i in $(seq 1 "$count"); do
    local ts=$(date -Iseconds)
    echo "{\"timestamp\":\"$ts\",\"subagent_type\":\"test-agent-$i\",\"description\":\"Test spawn $i\"}" >> "$spawn_log"
    # Small delay to ensure distinct timestamps
    sleep 0.1
  done
}

# Clear spawn log
clear_spawn_log() {
  local spawn_log="$HOOK_LOG_DIR/subagent-spawns.jsonl"
  > "$spawn_log"
}

# ============================================================================
# TEST RUNNER FRAMEWORK
# ============================================================================

# Current test suite name
CURRENT_SUITE=""

# Describe a test suite
# Usage: describe "Suite Name"
describe() {
  CURRENT_SUITE="$1"
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $CURRENT_SUITE${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Run a single test
# Usage: it "test description" test_function
it() {
  local description="$1"
  local test_func="$2"

  TESTS_RUN=$((TESTS_RUN + 1))

  echo -n "  ○ $description... "

  # Setup fresh temp env for each test
  setup_test_env

  # Run test and capture result
  # Note: We wrap in a subshell and clear the trap to prevent cleanup during test
  local output
  local result
  if output=$(trap - EXIT; "$test_func" 2>&1); then
    result=0
  else
    result=$?
  fi

  if [[ $result -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  elif [[ $result -eq 77 ]]; then
    echo -e "${YELLOW}SKIP${NC}"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
  else
    echo -e "${RED}FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    if [[ -n "$output" ]]; then
      echo "    $output" | head -10
    fi
  fi
}

# Skip a test
# Usage: skip "reason"
skip() {
  local reason="${1:-No reason given}"
  echo "  (skipped: $reason)" >&2
  exit 77
}

# Print test summary
print_summary() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════════════════${NC}"
  echo -e "  TEST SUMMARY"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  Total:   $TESTS_RUN"
  echo -e "  ${GREEN}Passed:  $TESTS_PASSED${NC}"
  echo -e "  ${RED}Failed:  $TESTS_FAILED${NC}"
  echo -e "  ${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
  echo ""

  if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "  ${GREEN}ALL TESTS PASSED!${NC}"
    return 0
  else
    echo -e "  ${RED}SOME TESTS FAILED${NC}"
    return 1
  fi
}

# Run all test functions in current file
# Usage: run_tests
run_tests() {
  # Find all functions starting with "test_"
  local test_funcs=$(declare -F | awk '{print $3}' | grep '^test_' | sort)

  for func in $test_funcs; do
    # Convert function name to description
    local desc=$(echo "$func" | sed 's/^test_//' | tr '_' ' ')
    it "$desc" "$func"
  done

  print_summary
}

# ============================================================================
# SECURITY TESTING HELPERS
# ============================================================================

# Check for command injection vulnerability (helper function)
# Usage: check_command_injection "$payload" "$hook_path"
check_command_injection() {
  local payload="${1:-}"
  local hook_path="${2:-}"

  if [[ -z "$payload" ]] || [[ -z "$hook_path" ]]; then
    echo "Usage: check_command_injection payload hook_path" >&2
    return 1
  fi
  local marker="/tmp/skillforge-injection-test-$$"

  # Clean up any existing marker
  rm -f "$marker"

  # The payload should NOT create the marker file
  local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')
  run_hook "$hook_path" "$input" >/dev/null 2>&1 || true

  if [[ -f "$marker" ]]; then
    rm -f "$marker"
    return 1  # Injection succeeded - vulnerability found!
  fi

  return 0  # Injection blocked - secure!
}

# Check for path traversal vulnerability (helper function)
# Usage: check_path_traversal "$payload" "$hook_path"
check_path_traversal() {
  local payload="${1:-}"
  local hook_path="${2:-}"

  if [[ -z "$payload" ]] || [[ -z "$hook_path" ]]; then
    echo "Usage: check_path_traversal payload hook_path" >&2
    return 1
  fi

  local input=$(jq -n --arg path "$payload" '{"tool_input":{"file_path":$path}}')
  local result
  result=$(run_hook "$hook_path" "$input" 2>&1) && local exit_code=0 || local exit_code=$?

  # Should be blocked (exit code 2) or sanitized
  if [[ $exit_code -eq 2 ]] || [[ "$result" == *"BLOCKED"* ]]; then
    return 0  # Path traversal blocked - secure!
  fi

  # Check if path was sanitized (no .. remaining)
  if [[ "$result" != *".."* ]]; then
    return 0  # Path sanitized - secure!
  fi

  return 1  # Path traversal allowed - vulnerability!
}

# Check for JQ filter injection (helper function)
# Usage: check_jq_injection "$malicious_filter"
check_jq_injection() {
  local malicious_filter="${1:-}"

  if [[ -z "$malicious_filter" ]]; then
    echo "Usage: check_jq_injection malicious_filter" >&2
    return 1
  fi
  local safe_json='{"tool_input":{"command":"test"}}'

  # Try to execute malicious filter
  local result
  result=$(echo "$safe_json" | jq -r "$malicious_filter // \"\"" 2>&1) && local exit_code=0 || local exit_code=$?

  # Check if debug or other dangerous functions were called
  if [[ "$result" == *"debug"* ]] || [[ "$result" == *"error"* ]] || [[ "$exit_code" -eq 0 && -n "$result" && "$result" != "test" && "$result" != "" ]]; then
    return 1  # Potential injection vector
  fi

  return 0  # Filter appears safe
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Convert string to lowercase (bash 3.x compatible)
# Usage: lowercase "$string"
lowercase() {
  echo "$1" | tr '[:upper:]' '[:lower:]'
}

# Convert string to uppercase (bash 3.x compatible)
# Usage: uppercase "$string"
uppercase() {
  echo "$1" | tr '[:lower:]' '[:upper:]'
}

# Count tokens in a file using tiktoken (accurate) or fallback to chars/4
# Usage: estimate_tokens "$filepath"
estimate_tokens() {
  local filepath="$1"
  if [[ ! -f "$filepath" ]]; then
    echo 0
    return
  fi
  # Try tiktoken (Python) - most accurate for Claude
  if command -v python3 &>/dev/null; then
    local result
    result=$(python3 -c "
import sys
try:
    import tiktoken
    enc = tiktoken.get_encoding('cl100k_base')
    with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
        print(len(enc.encode(f.read())))
except:
    sys.exit(1)
" "$filepath" 2>/dev/null)
    if [[ $? -eq 0 && -n "$result" ]]; then
      echo "$result"
      return
    fi
  fi
  # Fallback: chars/4 approximation
  local chars=$(wc -c < "$filepath" | tr -d ' ')
  echo $((chars / 4))
}

# Generate random string
# Usage: random_string $length
random_string() {
  local length="${1:-16}"
  LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$length"
}

# Wait for condition with timeout
# Usage: wait_for "condition" $timeout_seconds
wait_for() {
  local condition="$1"
  local timeout="${2:-10}"
  local elapsed=0

  while [[ $elapsed -lt $timeout ]]; do
    if eval "$condition" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done

  return 1
}

# Initialize test environment on source
setup_test_env

# Strip ANSI escape codes from string
# Usage: strip_ansi "$string"
strip_ansi() {
  local string="$1"
  echo "$string" | sed 's/\x1B\[[0-9;]*[mK]//g' 2>/dev/null || echo "$string"
}

# Fail with message
# Usage: fail "message"
fail() {
  local message="${1:-Test failed}"
  echo -e "${RED}FAIL${NC}: $message" >&2
  return 1
}
