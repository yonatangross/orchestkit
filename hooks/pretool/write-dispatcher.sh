#!/bin/bash
# Write/Edit PreToolUse Unified Dispatcher
# CC 2.1.7 Compliant: silent on success, visible on failure
#
# Performance optimization (2026-01-14):
# - Single dispatcher (was 4 separate hooks)
# - PARALLEL validation checks where safe
# - Consolidates: file-guard, naming, structure, test-location validators
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

FILE_PATH=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.file_path // ""')
CONTENT=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.content // ""')
TOOL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.tool_name // "Write"')

# Export for child hooks
export TOOL_INPUT_FILE_PATH="$FILE_PATH"

# Helper to block with specific error
block() {
  local check="$1"
  local reason="$2"
  local msg="${RED}✗ ${check}${RESET}: ${reason}"
  jq -n --arg msg "$msg" --arg reason "$reason" \
    '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

# Helper to run a validator in background (parallel)
run_validator_parallel() {
  local name="$1"
  local script="$2"
  local status_file="$TEMP_DIR/$name.status"
  local output_file="$TEMP_DIR/$name.out"
  local block_file="$TEMP_DIR/$name.block"

  if [[ ! -f "$script" ]]; then
    echo "0" > "$status_file"
    return 0
  fi

  (
    output=$(TOOL_INPUT_FILE_PATH="$FILE_PATH" _HOOK_INPUT="$_HOOK_INPUT" bash "$script" 2>&1) && exit_code=0 || exit_code=$?
    echo "$output" > "$output_file"
    echo "$exit_code" > "$status_file"

    # Check if it's a blocking result
    if [[ $exit_code -ne 0 ]] || [[ "$output" == *"BLOCKED"* ]]; then
      echo "$output" > "$block_file"
    fi
  ) &
}

# Collect any blocking errors
collect_blocks() {
  for block_file in "$TEMP_DIR"/*.block; do
    [[ -f "$block_file" ]] || continue
    cat "$block_file"
    return 1
  done
  return 0
}

# Collect warnings (non-blocking)
collect_warnings() {
  local result=""
  for output_file in "$TEMP_DIR"/*.out; do
    [[ -f "$output_file" ]] || continue
    local output
    output=$(cat "$output_file")
    if [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
      local warn_msg
      warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
      if [[ -n "$warn_msg" ]]; then
        if [[ -n "$result" ]]; then
          result="$result; $warn_msg"
        else
          result="$warn_msg"
        fi
      fi
    fi
  done
  echo "$result"
}

# ============================================================================
# PHASE 0: Write headers for new files (sequential - modifies content)
# ============================================================================
if [[ ! -f "$FILE_PATH" ]]; then
  if [[ -f "$SCRIPT_DIR/input-mod/write-headers.sh" ]]; then
    _HOOK_INPUT="$_HOOK_INPUT" bash "$SCRIPT_DIR/input-mod/write-headers.sh" >/dev/null 2>&1 || true
  fi
fi

# ============================================================================
# PHASE 1: Path normalization
# ============================================================================
ORIGINAL_PATH="$FILE_PATH"
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="$PWD/$FILE_PATH"
fi

# ============================================================================
# PHASE 2: File guard - check protected paths (fast, inline)
# ============================================================================
PROTECTED_EXACT=(".git/config" ".git/HEAD" ".env" ".env.local" ".env.production")
PROTECTED_DIRS=(".git/hooks" "node_modules/" "__pycache__/" ".venv/" "venv/")
PROTECTED_FILES=("package-lock.json" "yarn.lock" "pnpm-lock.yaml" "poetry.lock" "Cargo.lock")

for p in "${PROTECTED_EXACT[@]}"; do
  if [[ "$FILE_PATH" == *"/$p" ]] || [[ "$FILE_PATH" == *"$p" ]]; then
    block "Protected" "Cannot modify protected file: $p"
  fi
done

for p in "${PROTECTED_DIRS[@]}"; do
  if [[ "$FILE_PATH" == *"$p"* ]]; then
    block "Protected" "Cannot write to protected directory: $p"
  fi
done

for p in "${PROTECTED_FILES[@]}"; do
  if [[ "$FILE_PATH" == *"/$p" ]]; then
    block "Protected" "Cannot modify lock file: $p (use package manager instead)"
  fi
done

# ============================================================================
# PHASE 3: Run all validators in PARALLEL
# ============================================================================

# Skill validators (naming, structure, test location)
run_validator_parallel "BackendNaming" "$SKILL_DIR/backend-file-naming.sh"
run_validator_parallel "Structure" "$SKILL_DIR/structure-location-validator.sh"
run_validator_parallel "TestLocation" "$SKILL_DIR/test-location-validator.sh"

# Architecture change detector (for significant files)
case "$FILE_PATH" in
  **/api/**|**/services/**|**/db/**|**/models/**|**/workflows/**)
    run_validator_parallel "ArchDetect" "$SCRIPT_DIR/Write/architecture-change-detector.sh"
    ;;
esac

# Security pattern validator (for code files)
case "$FILE_PATH" in
  *.py|*.ts|*.tsx|*.js|*.jsx)
    run_validator_parallel "Security" "$SCRIPT_DIR/Write/security-pattern-validator.sh"
    ;;
esac

# Multi-instance lock (if coordination enabled)
if [[ -f "$COORDINATION_DB" ]]; then
  run_validator_parallel "MultiLock" "$SCRIPT_DIR/write-edit/multi-instance-lock.sh"
fi

# Wait for all validators
wait

# ============================================================================
# PHASE 4: Check for blocking errors
# ============================================================================
BLOCK_MSG=$(collect_blocks)
if [[ $? -ne 0 ]]; then
  # Extract the actual error message
  REASON=$(echo "$BLOCK_MSG" | grep -E "^BLOCKED:" | head -1 | sed 's/^BLOCKED: *//' || echo "Validation failed")
  block "Validator" "$REASON"
fi

# ============================================================================
# PHASE 5: Output result
# ============================================================================
WARNINGS=$(collect_warnings)

if [[ -n "$WARNINGS" ]]; then
  jq -n \
    --arg msg "⚠ $WARNINGS" \
    --arg file_path "$FILE_PATH" \
    --arg content "$CONTENT" \
    '{systemMessage: $msg, continue: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: {file_path: $file_path, content: $content}}}'
else
  jq -n \
    --arg file_path "$FILE_PATH" \
    --arg content "$CONTENT" \
    '{continue: true, suppressOutput: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: {file_path: $file_path, content: $content}}}'
fi