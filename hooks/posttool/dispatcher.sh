#!/bin/bash
# PostToolUse Dispatcher - Runs all post-tool checks with PARALLEL execution
# CC 2.1.7 Compliant: silent on success, visible on failure/warning
#
# Performance optimization (2026-01-14):
# - PARALLEL execution for independent checks
# - Early exit for internal files (.claude/, node_modules/, .git/)
# - Single jq parse for all fields + export to child hooks
# - File-type based validator selection
# - Skip non-essential checks for simple Bash commands
# - Target: <100ms for typical operations
set -uo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/../skill"

# Temp directory for parallel outputs
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Coordination DB path
COORDINATION_DB="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.claude.db"

# Extract all tool info in ONE jq call (reduces 4 subprocess spawns to 1)
# Export for child hooks to avoid redundant jq parsing
eval "$(echo "$_HOOK_INPUT" | jq -r '
  "export POSTTOOL_TOOL_NAME=" + (.tool_name // "unknown" | @sh) +
  " POSTTOOL_TOOL_RESULT=" + (.tool_result // "" | @sh) +
  " POSTTOOL_FILE_PATH=" + (.tool_input.file_path // "" | @sh) +
  " POSTTOOL_COMMAND=" + (.tool_input.command // "" | @sh) +
  " POSTTOOL_SESSION_ID=" + (.session_id // "" | @sh)
')"

# Use shorter local names
TOOL_NAME="$POSTTOOL_TOOL_NAME"
TOOL_RESULT="$POSTTOOL_TOOL_RESULT"
FILE_PATH="$POSTTOOL_FILE_PATH"
COMMAND="$POSTTOOL_COMMAND"

# =============================================================================
# EARLY EXIT: Skip validators for internal/ignored files
# =============================================================================
# These files don't need code quality validators - saves ~60ms
SKIP_VALIDATORS=false

if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  case "$FILE_PATH" in
    # Internal Claude/plugin files
    */.claude/*|*.claude/*)
      SKIP_VALIDATORS=true
      ;;
    # Package manager directories
    */node_modules/*|*/vendor/*|*/.venv/*|*/venv/*|*/__pycache__/*)
      SKIP_VALIDATORS=true
      ;;
    # Version control
    */.git/*|*/.svn/*|*/.hg/*)
      SKIP_VALIDATORS=true
      ;;
    # Build outputs
    */dist/*|*/build/*|*/.next/*|*/out/*|*/.nuxt/*)
      SKIP_VALIDATORS=true
      ;;
    # Generated/lock files
    *.lock|*-lock.json|*.min.js|*.min.css|*.map)
      SKIP_VALIDATORS=true
      ;;
    # Config/data files (no code validation needed)
    *.json|*.yaml|*.yml|*.toml|*.ini|*.cfg|*.md|*.txt|*.rst)
      SKIP_VALIDATORS=true
      ;;
  esac
fi

# =============================================================================
# Determine if we need full logging (skip for simple read-only commands)
# =============================================================================
SKIP_HEAVY_LOGGING=false

if [[ "$TOOL_NAME" == "Bash" ]]; then
  # Skip heavy logging for simple read-only commands
  case "$COMMAND" in
    echo\ *|ls\ *|ls|pwd|cat\ *|head\ *|tail\ *|wc\ *|date|whoami|hostname)
      SKIP_HEAVY_LOGGING=true
      ;;
  esac
fi

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

# =============================================================================
# Run core checks in PARALLEL (conditionally based on operation type)
# =============================================================================

# Always run metrics (lightweight counter)
run_check_parallel "Metrics" "$SCRIPT_DIR/session-metrics.sh"

# Only run heavier checks for non-trivial operations
if [[ "$SKIP_HEAVY_LOGGING" == "false" ]]; then
  run_check_parallel "Audit" "$SCRIPT_DIR/audit-logger.sh"
  run_check_parallel "ErrorCollector" "$SCRIPT_DIR/error-collector.sh"
  run_check_parallel "ContextBudget" "$SCRIPT_DIR/context-budget-monitor.sh"
fi

# =============================================================================
# Tool-specific checks (PARALLEL where independent)
# =============================================================================

case "$TOOL_NAME" in
  Write|Edit)
    # File lock release (always needed for Write/Edit)
    run_check_parallel "Lock" "$SCRIPT_DIR/write-edit/file-lock-release.sh"

    # Skill evolution: track edit patterns after skill usage (#58)
    run_check_parallel "SkillEdit" "$SCRIPT_DIR/skill-edit-tracker.sh"

    # Skip validators for internal files (optimization)
    if [[ "$SKIP_VALIDATORS" == "false" ]]; then
      # =======================================================================
      # File-type based validator selection
      # Only run validators relevant to the file type
      # =======================================================================

      case "$FILE_PATH" in
        # Python files: run backend validators
        *.py)
          run_check_parallel "Layers" "$SKILL_DIR/backend-layer-validator.sh"
          run_check_parallel "Imports" "$SKILL_DIR/import-direction-enforcer.sh"
          run_check_parallel "DI" "$SKILL_DIR/di-pattern-enforcer.sh"
          run_check_parallel "Migration" "$SKILL_DIR/migration-validator.sh"
          run_check_parallel "Coverage" "$SCRIPT_DIR/Write/coverage-predictor.sh"

          # Test-specific validators for Python test files
          if [[ "$FILE_PATH" == *test*.py ]] || [[ "$FILE_PATH" == *_test.py ]]; then
            run_check_parallel "Tests" "$SKILL_DIR/test-pattern-validator.sh"
            run_check_parallel "CrossTest" "$SKILL_DIR/cross-instance-test-validator.sh"
            run_check_parallel "TestRunner" "$SKILL_DIR/test-runner.sh"
          fi
          ;;

        # TypeScript/JavaScript files: run frontend validators
        *.ts|*.tsx|*.js|*.jsx)
          run_check_parallel "Imports" "$SKILL_DIR/import-direction-enforcer.sh"
          run_check_parallel "Patterns" "$SKILL_DIR/pattern-consistency-enforcer.sh"
          run_check_parallel "Coverage" "$SCRIPT_DIR/Write/coverage-predictor.sh"

          # Test-specific validators for JS/TS test files
          if [[ "$FILE_PATH" == *test*.ts ]] || [[ "$FILE_PATH" == *test*.tsx ]] || \
             [[ "$FILE_PATH" == *spec*.ts ]] || [[ "$FILE_PATH" == *spec*.tsx ]]; then
            run_check_parallel "Tests" "$SKILL_DIR/test-pattern-validator.sh"
            run_check_parallel "CrossTest" "$SKILL_DIR/cross-instance-test-validator.sh"
            run_check_parallel "TestRunner" "$SKILL_DIR/test-runner.sh"
          fi
          ;;

        # SQL migration files
        *.sql)
          run_check_parallel "Migration" "$SKILL_DIR/migration-validator.sh"
          ;;

        # Other source files: run generic validators only
        *)
          run_check_parallel "Patterns" "$SKILL_DIR/pattern-consistency-enforcer.sh"
          run_check_parallel "Duplicates" "$SKILL_DIR/duplicate-code-detector.sh"
          ;;
      esac

      # Cross-file validators (run for all non-skipped code files)
      run_check_parallel "Merge" "$SKILL_DIR/merge-conflict-predictor.sh"
    fi
    ;;

  Bash)
    # Only run error tracking for non-trivial commands
    if [[ "$SKIP_HEAVY_LOGGING" == "false" ]]; then
      run_check_parallel "Errors" "$SCRIPT_DIR/error-tracker.sh"
      run_check_parallel "Secrets" "$SKILL_DIR/redact-secrets.sh"
    fi

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
  jq -n --arg msg "⚠ $WARNINGS_MSG" '{continue:true,systemMessage:$msg}'
else
  echo "{\"continue\": true, \"suppressOutput\": true}"
fi

exit 0