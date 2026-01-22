#!/bin/bash
set -euo pipefail
# GitHub Issue Creation Guidance Hook
# Injects context and checklist before gh issue create commands
# CC 2.1.9: Uses additionalContext to guide issue creation

INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process gh issue create commands
if [[ ! "$COMMAND" =~ ^gh\ issue\ create ]]; then
  output_silent_success
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Gather context to inject
CONTEXT="ISSUE CREATION CHECKLIST:

PRE-CREATION (do these first!):
□ Search duplicates: gh issue list --state all --search \"keywords\"
□ Check milestones: gh api repos/:owner/:repo/milestones --jq '.[] | \"#\\(.number) \\(.title)\"'
□ Check open PRs: gh pr list --state open --search \"keywords\"

"

# Get current milestones to include in context
MILESTONES=$(gh api repos/:owner/:repo/milestones --jq '
  [.[] | select(.state == "open")] |
  if length > 0 then
    "AVAILABLE MILESTONES:\n" + (map("  - \(.title) (\(.open_issues) open)") | join("\n"))
  else
    "No open milestones"
  end
' 2>/dev/null || echo "Could not fetch milestones")

CONTEXT="${CONTEXT}${MILESTONES}

ISSUE REQUIREMENTS:
□ Clear, specific title (not \"Bug\" or \"Fix\")
□ Type prefix: bug:, feat:, docs:, refactor:, test:, chore:
□ Labels: at minimum type + priority
□ Milestone: assign if fits current sprint
□ Acceptance criteria: define \"done\" conditions

TITLE FORMAT: type: Clear description of the issue
  Good: \"bug: Login fails with special characters\"
  Bad: \"Bug\" or \"Please fix\"

"

# Check if --title is provided and validate
if [[ "$COMMAND" =~ --title[[:space:]]+[\"\']([^\"\']+)[\"\'] ]]; then
  TITLE="${BASH_REMATCH[1]}"

  # Validate title format
  if [[ ! "$TITLE" =~ ^(bug|feat|fix|docs|refactor|test|chore|enhancement): ]]; then
    CONTEXT="${CONTEXT}⚠ TITLE WARNING: \"$TITLE\" doesn't follow type: description format.
Consider: bug: $TITLE or feat: $TITLE

"
  fi

  # Check for vague titles
  if [[ "$TITLE" =~ ^(Bug|Fix|Feature|Update|Change|Issue)$ ]]; then
    CONTEXT="${CONTEXT}⚠ TITLE TOO VAGUE: Please provide a specific, searchable title.

"
  fi

  # Quick duplicate check hint
  local search_terms="${TITLE:0:30}"
  CONTEXT="${CONTEXT}DUPLICATE CHECK: Before creating, verify no duplicates:
  gh issue list --state all --search \"$search_terms\"

"
fi

# Check if milestone is provided
if [[ ! "$COMMAND" =~ --milestone ]]; then
  CONTEXT="${CONTEXT}⚠ NO MILESTONE: Consider assigning to a milestone for tracking.
  Add: --milestone \"Sprint Name\"

"
fi

# Check if labels are provided
if [[ ! "$COMMAND" =~ --label ]]; then
  CONTEXT="${CONTEXT}⚠ NO LABELS: Issues should have at least type and priority labels.
  Add: --label \"enhancement,medium\"

"
fi

log_permission_feedback "allow" "gh issue create with guidance"
output_allow_with_context "$CONTEXT"
output_silent_success
exit 0
