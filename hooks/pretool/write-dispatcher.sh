#!/bin/bash
# Write/Edit PreToolUse Dispatcher - Combines path, headers, guard, lock, and validation checks
# CC 2.1.6 Compliant: silent on success, visible on failure
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Coordination DB path
COORDINATION_DB="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.claude.db"

FILE_PATH=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.file_path // ""')
CONTENT=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.content // ""')
TOOL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.tool_name // "Write"')

WARNINGS=()

# Helper to block with specific error
block() {
  local check="$1"
  local reason="$2"
  local msg="${RED}✗ ${check}${RESET}: ${reason}"
  jq -n --arg msg "$msg" --arg reason "$reason" \
    '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

# Helper to run a sub-hook (passes hook input via environment)
run_hook() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  local output
  local exit_code
  output=$(_HOOK_INPUT="$_HOOK_INPUT" bash "$script" 2>&1) && exit_code=0 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    WARNINGS+=("$name: failed")
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
    local warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  return 0
}

# 0. Write headers for new files (first - modifies content)
if [[ ! -f "$FILE_PATH" ]]; then
  run_hook "Headers" "$SCRIPT_DIR/input-mod/write-headers.sh"
fi

# 1. Path normalization
ORIGINAL_PATH="$FILE_PATH"
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="$PWD/$FILE_PATH"
fi

# 2. File guard - check protected paths
PROTECTED_EXACT=(
  ".git/config"
  ".git/HEAD"
  ".env"
  ".env.local"
  ".env.production"
)

PROTECTED_DIRS=(
  ".git/hooks"
  "node_modules/"
  "__pycache__/"
  ".venv/"
  "venv/"
)

PROTECTED_FILES=(
  "package-lock.json"
  "yarn.lock"
  "pnpm-lock.yaml"
  "poetry.lock"
  "Cargo.lock"
)

# Check exact matches
for p in "${PROTECTED_EXACT[@]}"; do
  if [[ "$FILE_PATH" == *"/$p" ]] || [[ "$FILE_PATH" == *"$p" ]]; then
    block "Protected" "Cannot modify protected file: $p"
  fi
done

# Check directory patterns
for p in "${PROTECTED_DIRS[@]}"; do
  if [[ "$FILE_PATH" == *"$p"* ]]; then
    block "Protected" "Cannot write to protected directory: $p"
  fi
done

# Check lock files
for p in "${PROTECTED_FILES[@]}"; do
  if [[ "$FILE_PATH" == *"/$p" ]]; then
    block "Protected" "Cannot modify lock file: $p (use package manager instead)"
  fi
done

# 3. Architecture change detector (for significant files)
case "$FILE_PATH" in
  **/api/**|**/services/**|**/db/**|**/models/**|**/workflows/**)
    run_hook "ArchDetect" "$SCRIPT_DIR/Write/architecture-change-detector.sh"
    ;;
esac

# 4. Multi-instance lock (if coordination enabled)
if [[ -f "$COORDINATION_DB" ]]; then
  run_hook "MultiLock" "$SCRIPT_DIR/write-edit/multi-instance-lock.sh"
fi

# 5. Test file location check (skip for .claude/ skill/hook files)
if [[ "$FILE_PATH" == *"test"* ]] || [[ "$FILE_PATH" == *"spec"* ]]; then
  # Skip check for .claude/ directory (skills, hooks, etc. may have "test" in name)
  if [[ "$FILE_PATH" != *"/.claude/"* ]]; then
    # Check it's in proper test directory
    if [[ "$FILE_PATH" != *"/tests/"* ]] && [[ "$FILE_PATH" != *"/__tests__/"* ]] && [[ "$FILE_PATH" != *"/test/"* ]]; then
      block "Structure" "Test files should be in tests/, __tests__/, or test/ directory"
    fi
  fi
fi

# 6. Security pattern validator (last, for code files)
case "$FILE_PATH" in
  *.py|*.ts|*.tsx|*.js|*.jsx)
    run_hook "Security" "$SCRIPT_DIR/Write/security-pattern-validator.sh"
    ;;
esac

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  jq -n \
    --arg msg "${YELLOW}⚠ ${WARN_MSG}${RESET}" \
    --arg file_path "$FILE_PATH" \
    --arg content "$CONTENT" \
    '{systemMessage: $msg, continue: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: {file_path: $file_path, content: $content}}}'
else
  # Silent success - no systemMessage
  jq -n \
    --arg file_path "$FILE_PATH" \
    --arg content "$CONTENT" \
    '{continue: true, suppressOutput: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: {file_path: $file_path, content: $content}}}'
fi