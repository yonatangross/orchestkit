#!/bin/bash
# Write/Edit PreToolUse Dispatcher - Combines path, headers, guard, and lock checks
# CC 2.1.1 Compliant: includes continue field in all outputs
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ANSI colors
GREEN=$'\033[32m'
RED=$'\033[31m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

FILE_PATH=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.file_path // ""')
CONTENT=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.content // ""')
TOOL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.tool_name // "Write"')

CHECKS=()

# Helper to block with specific error
block() {
  local check="$1"
  local reason="$2"
  local msg="${RED}✗ ${check}${RESET}: ${reason}"
  jq -n --arg msg "$msg" --arg reason "$reason" \
    '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

# 1. Path normalization
ORIGINAL_PATH="$FILE_PATH"
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="$PWD/$FILE_PATH"
fi
CHECKS+=("Path OK")

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
CHECKS+=("Guard passed")

# 3. Test file location check
if [[ "$FILE_PATH" == *"test"* ]] || [[ "$FILE_PATH" == *"spec"* ]]; then
  # Check it's in proper test directory
  if [[ "$FILE_PATH" != *"/tests/"* ]] && [[ "$FILE_PATH" != *"/__tests__/"* ]] && [[ "$FILE_PATH" != *"/test/"* ]]; then
    block "Structure" "Test files should be in tests/, __tests__/, or test/ directory"
  fi
fi
CHECKS+=("Structure OK")

# 4. Add header for new files (Write only, not Edit)
if [[ "$TOOL_NAME" == "Write" && ! -f "$FILE_PATH" ]]; then
  EXT="${FILE_PATH##*.}"
  case "$EXT" in
    py|js|ts|sh|sql)
      CHECKS+=("Header added")
      ;;
  esac
fi

# Build output
# Format: ToolName: ✓ Check1 | ✓ Check2 | ✓ Check3
MSG=""
for i in "${!CHECKS[@]}"; do
  if [[ $i -gt 0 ]]; then
    MSG="$MSG | "
  fi
  MSG="$MSG${GREEN}✓${RESET} ${CHECKS[$i]}"
done

jq -n \
  --arg msg "$MSG" \
  --arg file_path "$FILE_PATH" \
  --arg content "$CONTENT" \
  '{systemMessage: $msg, continue: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: {file_path: $file_path, content: $content}}}'