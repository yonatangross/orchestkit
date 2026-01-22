#!/bin/bash
set -euo pipefail
# Git Atomic Commit Checker Hook
# Warns about potentially non-atomic commits (too many files/lines)
# CC 2.1.9: Injects guidance via additionalContext

INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process git commit commands
if [[ ! "$COMMAND" =~ ^git\ commit ]]; then
  output_silent_success
  exit 0
fi

# Get staged changes stats
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Check if there are staged changes
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
STAGED_STATS=$(git diff --cached --shortstat 2>/dev/null || echo "")

if [[ -z "$STAGED_STATS" ]] || [[ "$STAGED_FILES" -eq 0 ]]; then
  # No staged changes - might be using -a flag or interactive
  if [[ "$COMMAND" =~ -a ]]; then
    # Using -a flag, check all modified files
    MODIFIED_FILES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
    MODIFIED_STATS=$(git diff --shortstat 2>/dev/null || echo "")

    if [[ "$MODIFIED_FILES" -gt 10 ]]; then
      GUIDANCE="Large commit detected: $MODIFIED_FILES files with 'git commit -a'

Atomic commit best practice:
- Stage files selectively: git add -p
- One logical change per commit
- Easier to review, revert, and bisect

Consider:
1. Cancel this commit
2. Use 'git add -p' to stage related changes
3. Make multiple focused commits"

      log_permission_feedback "allow" "Large commit warning: $MODIFIED_FILES files with -a flag"
      output_allow_with_context "$GUIDANCE"
      output_silent_success
      exit 0
    fi
  fi
  output_silent_success
  exit 0
fi

# Parse staged stats
# Format: " 5 files changed, 120 insertions(+), 30 deletions(-)"
INSERTIONS=0
DELETIONS=0
if [[ "$STAGED_STATS" =~ ([0-9]+)\ insertion ]]; then
  INSERTIONS="${BASH_REMATCH[1]}"
fi
if [[ "$STAGED_STATS" =~ ([0-9]+)\ deletion ]]; then
  DELETIONS="${BASH_REMATCH[1]}"
fi
TOTAL_LINES=$((INSERTIONS + DELETIONS))

# Thresholds
MAX_FILES=10
MAX_LINES=400
WARN_FILES=5
WARN_LINES=200

# Check for very large commits (BLOCK with guidance)
if [[ "$STAGED_FILES" -gt "$MAX_FILES" ]] || [[ "$TOTAL_LINES" -gt "$MAX_LINES" ]]; then
  GUIDANCE="LARGE COMMIT DETECTED

Stats: $STAGED_FILES files, +$INSERTIONS/-$DELETIONS lines ($TOTAL_LINES total)
Thresholds: max $MAX_FILES files, max $MAX_LINES lines

This commit may not be atomic. Consider:

1. Review staged files:
   git diff --cached --name-only

2. Unstage and re-stage selectively:
   git reset HEAD
   git add -p  # Stage interactively

3. Split into logical commits:
   - Separate features from refactoring
   - Separate tests from implementation
   - Separate formatting from logic

4. If intentional (e.g., generated code), proceed with clear message.

Atomic commits benefit:
- Easier code review
- Simple git bisect debugging
- Clean git revert when needed
- Better git history"

  log_permission_feedback "allow" "Very large commit warning: $STAGED_FILES files, $TOTAL_LINES lines"
  output_allow_with_context "$GUIDANCE"
  output_silent_success
  exit 0
fi

# Check for medium commits (soft warning)
if [[ "$STAGED_FILES" -gt "$WARN_FILES" ]] || [[ "$TOTAL_LINES" -gt "$WARN_LINES" ]]; then
  GUIDANCE="Commit size: $STAGED_FILES files, +$INSERTIONS/-$DELETIONS lines

Consider if this is truly one logical change. Use 'git add -p' for precise staging."

  log_permission_feedback "allow" "Medium commit: $STAGED_FILES files, $TOTAL_LINES lines"
  output_allow_with_context "$GUIDANCE"
  output_silent_success
  exit 0
fi

# Small commit - good!
log_permission_feedback "allow" "Good atomic commit size: $STAGED_FILES files, $TOTAL_LINES lines"
output_silent_success
exit 0
