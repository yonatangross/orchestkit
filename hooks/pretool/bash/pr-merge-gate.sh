#!/bin/bash
set -euo pipefail
# =============================================================================
# pr-merge-gate.sh
# PreToolUse hook that triggers merge-readiness check ONLY for PR/merge commands
# CC 2.1.9 Enhanced: Uses additionalContext to guide Claude on failures
# =============================================================================

# Read hook input
INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Extract command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# =============================================================================
# TRIGGER CONDITIONS: Only run for PR/merge related commands
# =============================================================================
SHOULD_CHECK=false
CHECK_TYPE=""

# gh pr create - creating a pull request
if [[ "$COMMAND" =~ gh[[:space:]]+pr[[:space:]]+create ]]; then
  SHOULD_CHECK=true
  CHECK_TYPE="PR creation"
fi

# git push origin (pushing to remote, usually before/after PR)
if [[ "$COMMAND" =~ git[[:space:]]+push.*origin && ! "$COMMAND" =~ --force ]]; then
  SHOULD_CHECK=true
  CHECK_TYPE="push to remote"
fi

# git merge (merging branches)
if [[ "$COMMAND" =~ git[[:space:]]+merge[[:space:]] && ! "$COMMAND" =~ --abort ]]; then
  SHOULD_CHECK=true
  CHECK_TYPE="branch merge"
fi

# Not a PR/merge command - allow silently
if [[ "$SHOULD_CHECK" != "true" ]]; then
  output_silent_success
  exit 0
fi

# =============================================================================
# RUN QUICK MERGE READINESS CHECK
# =============================================================================
log_hook "PR/merge gate triggered for: $CHECK_TYPE"

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-.}")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
TARGET_BRANCH="main"

# Collect issues (quick checks only - no test runs)
BLOCKERS=()
WARNINGS=()

# 1. Check for uncommitted changes
UNCOMMITTED=$(git status --short 2>/dev/null || echo "")
if [[ -n "$UNCOMMITTED" ]]; then
  BLOCKERS+=("Uncommitted changes detected")
fi

# 2. Check branch divergence (quick - no fetch)
BEHIND=$(git rev-list --count "$CURRENT_BRANCH".."origin/$TARGET_BRANCH" 2>/dev/null || echo "0")
if [[ "$BEHIND" -gt 20 ]]; then
  BLOCKERS+=("Branch is $BEHIND commits behind $TARGET_BRANCH - rebase first")
elif [[ "$BEHIND" -gt 5 ]]; then
  WARNINGS+=("Branch is $BEHIND commits behind $TARGET_BRANCH")
fi

# 3. Quick lint check (if ruff available and fast)
if command -v ruff >/dev/null 2>&1; then
  if ! ruff check . --quiet 2>/dev/null; then
    WARNINGS+=("Ruff linting has warnings - run 'ruff check .' for details")
  fi
fi

# 4. Check if on protected branch trying to push
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "dev" || "$CURRENT_BRANCH" == "master" ]]; then
  BLOCKERS+=("Cannot $CHECK_TYPE from protected branch '$CURRENT_BRANCH'")
fi

# =============================================================================
# DECISION: BLOCK OR ALLOW
# =============================================================================

if [[ ${#BLOCKERS[@]} -gt 0 ]]; then
  # Build blocker message
  BLOCKER_MSG="PR/Merge Gate: BLOCKED for $CHECK_TYPE

Blockers found:
$(printf '  - %s\n' "${BLOCKERS[@]}")"

  if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    BLOCKER_MSG="$BLOCKER_MSG

Warnings:
$(printf '  - %s\n' "${WARNINGS[@]}")"
  fi

  BLOCKER_MSG="$BLOCKER_MSG

Fix the blockers before proceeding with $CHECK_TYPE.
Run: git status, git diff, ruff check . for details."

  log_hook "PR/merge gate BLOCKED: ${BLOCKERS[*]}"
  log_permission_feedback "deny" "PR/merge gate blocked: ${BLOCKERS[*]}"

  # Output with additionalContext so Claude sees the guidance
  jq -n --arg msg "$BLOCKER_MSG" \
    '{continue: false, systemMessage: $msg, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Merge readiness check failed"}}'
  exit 0
fi

# =============================================================================
# ALLOW WITH CONTEXT (warnings or clean)
# =============================================================================

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARNING_MSG="PR/Merge Gate: PASSED with warnings for $CHECK_TYPE

Warnings:
$(printf '  - %s\n' "${WARNINGS[@]}")

Proceeding - but consider addressing warnings."

  log_hook "PR/merge gate passed with warnings"
  output_allow_with_context "$WARNING_MSG"
  exit 0
fi

# Clean pass
log_hook "PR/merge gate passed cleanly for $CHECK_TYPE"
output_allow_with_context "PR/Merge Gate: All checks passed for $CHECK_TYPE on branch $CURRENT_BRANCH"
exit 0
