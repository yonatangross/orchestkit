#!/bin/bash
# PostToolUse Dispatcher - Runs all post-tool checks with PARALLEL execution
# CC 2.1.7 Compliant: silent on success, visible on failure/warning
#
# Performance optimization (2026-01-14):
# - PARALLEL execution for independent checks
# - ~114ms serial → ~50ms parallel for Write|Edit
set -uo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/../skill"

# Temp directory for parallel outputs
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Coordination DB path
COORDINATION_DB="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.claude.db"

# Extract tool info
TOOL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.tool_name // "unknown"')
TOOL_RESULT=$(echo "$_HOOK_INPUT" | jq -r '.tool_result // ""')
FILE_PATH=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.file_path // ""')
COMMAND=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.command // ""')

# Helper to run check in background
run_check_parallel() {
  local name="$1"
  local script="$2"
  local status_file="$TEMP_DIR/$name.status"
  local output_file="$TEMP_DIR/$name.out"

  if [[ ! -f "$script" ]]; then
    echo "0" > "$status_file"
    return 0
  fi

  (
    output=$(echo "$_HOOK_INPUT" | bash "$script" 2>&1) && exit_code=0 || exit_code=$?
    echo "$output" > "$output_file"
    echo "$exit_code" > "$status_file"
  ) &
}

# Collect warnings from parallel results
collect_warnings() {
  local result=""

  for status_file in "$TEMP_DIR"/*.status; do
    [[ -f "$status_file" ]] || continue

    local name
    name=$(basename "$status_file" .status)
    local output_file="$TEMP_DIR/$name.out"
    local exit_code
    exit_code=$(cat "$status_file")

    if [[ "$exit_code" != "0" ]]; then
      if [[ -n "$result" ]]; then
        result="$result; $name: check failed"
      else
        result="$name: check failed"
      fi
    elif [[ -f "$output_file" ]]; then
      local output
      output=$(cat "$output_file")
      if [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]] || [[ "$output" == *"BLOCKED"* ]]; then
        local warn_msg
        warn_msg=$(echo "$output" | grep -iE "(warning|blocked)" | head -1 | sed 's/.*\(warning\|BLOCKED\)[: ]*//')
        if [[ -n "$warn_msg" ]]; then
          if [[ -n "$result" ]]; then
            result="$result; $name: $warn_msg"
          else
            result="$name: $warn_msg"
          fi
        fi
      fi
    fi
  done

  echo "$result"
}

# ============================================================================
# Run core checks in PARALLEL (always run)
# ============================================================================

run_check_parallel "Audit" "$SCRIPT_DIR/audit-logger.sh"
run_check_parallel "ErrorCollector" "$SCRIPT_DIR/error-collector.sh"
run_check_parallel "Metrics" "$SCRIPT_DIR/session-metrics.sh"
run_check_parallel "ContextBudget" "$SCRIPT_DIR/context-budget-monitor.sh"

# ============================================================================
# Tool-specific checks (PARALLEL where independent)
# ============================================================================

case "$TOOL_NAME" in
  Write|Edit)
    # File lock release (sequential - needs to run)
    run_check_parallel "Lock" "$SCRIPT_DIR/write-edit/file-lock-release.sh"

    # All skill validators can run in PARALLEL (independent checks)
    run_check_parallel "Layers" "$SKILL_DIR/backend-layer-validator.sh"
    run_check_parallel "Imports" "$SKILL_DIR/import-direction-enforcer.sh"
    run_check_parallel "DI" "$SKILL_DIR/di-pattern-enforcer.sh"
    run_check_parallel "Tests" "$SKILL_DIR/test-pattern-validator.sh"
    run_check_parallel "Patterns" "$SKILL_DIR/pattern-consistency-enforcer.sh"
    run_check_parallel "Duplicates" "$SKILL_DIR/duplicate-code-detector.sh"
    run_check_parallel "CrossTest" "$SKILL_DIR/cross-instance-test-validator.sh"
    run_check_parallel "Merge" "$SKILL_DIR/merge-conflict-predictor.sh"
    run_check_parallel "Migration" "$SKILL_DIR/migration-validator.sh"

    # Coverage predictor for source files
    case "$FILE_PATH" in
      *.py|*.ts|*.tsx|*.js|*.jsx)
        run_check_parallel "Coverage" "$SCRIPT_DIR/Write/coverage-predictor.sh"
        ;;
    esac

    # Test runner for test files
    case "$FILE_PATH" in
      *test*.py|*test*.ts|*test*.tsx|*spec*.ts|*spec*.tsx|*_test.py|*_test.ts)
        run_check_parallel "TestRunner" "$SKILL_DIR/test-runner.sh"
        ;;
    esac
    ;;

  Bash)
    run_check_parallel "Errors" "$SCRIPT_DIR/error-tracker.sh"
    run_check_parallel "Secrets" "$SKILL_DIR/redact-secrets.sh"

    # Release locks on successful git commit
    if [[ "$COMMAND" =~ git\ commit ]] && [[ "$TOOL_RESULT" != *"error"* ]] && [[ -f "$COORDINATION_DB" ]]; then
      run_check_parallel "ReleaseLocks" "$SCRIPT_DIR/Write/release-lock-on-commit.sh"
    fi
    ;;

  Task)
    run_check_parallel "AgentMemory" "$SCRIPT_DIR/task/agent-memory-store.sh"
    run_check_parallel "Heartbeat" "$SCRIPT_DIR/coordination-heartbeat.sh"
    ;;
esac

# Wait for all parallel checks to complete
wait

# Collect warnings
WARNINGS_MSG=$(collect_warnings)

# Add command error warning for Bash
if [[ "$TOOL_NAME" == "Bash" ]]; then
  if [[ "$TOOL_RESULT" == *"error"* ]] || [[ "$TOOL_RESULT" == *"Error"* ]]; then
    if [[ -n "$WARNINGS_MSG" ]]; then
      WARNINGS_MSG="$WARNINGS_MSG; Command may have errors"
    else
      WARNINGS_MSG="Command may have errors"
    fi
  fi
fi

# Output: silent on success, show warnings if any
if [[ -n "$WARNINGS_MSG" ]]; then
  echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARNINGS_MSG}${RESET}\", \"continue\": true}"
else
  echo "{\"continue\": true, \"suppressOutput\": true}"
fi

exit 0