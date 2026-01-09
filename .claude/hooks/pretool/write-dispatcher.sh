#!/bin/bash
# Write/Edit PreToolUse Dispatcher - Combines path, headers, guard, and lock checks
# CC 2.1.2 Compliant: silent on success, visible on failure
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

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

# 3. Test file location check (skip for .claude/ skill/hook files)
if [[ "$FILE_PATH" == *"test"* ]] || [[ "$FILE_PATH" == *"spec"* ]]; then
  # Skip check for .claude/ directory (skills, hooks, etc. may have "test" in name)
  if [[ "$FILE_PATH" != *"/.claude/"* ]]; then
    # Check it's in proper test directory
    if [[ "$FILE_PATH" != *"/tests/"* ]] && [[ "$FILE_PATH" != *"/__tests__/"* ]] && [[ "$FILE_PATH" != *"/test/"* ]]; then
      block "Structure" "Test files should be in tests/, __tests__/, or test/ directory"
    fi
  fi
fi

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
    '{continue: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: {file_path: $file_path, content: $content}}}'
fi