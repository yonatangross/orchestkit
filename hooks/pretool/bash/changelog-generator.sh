#!/bin/bash
set -euo pipefail
# Changelog Generator Hook
# Injects auto-generated changelog before gh release create commands
# CC 2.1.9: Uses additionalContext to provide suggested changelog
# Version: 1.0.1 - Fixed Bash 3.2 compatibility (no associative arrays)

INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process gh release create commands
if [[ ! "$COMMAND" =~ ^gh\ release\ create ]]; then
  output_silent_success
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Get the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# Get commits since last tag (or all commits if no tags exist)
if [[ -n "$LAST_TAG" ]]; then
  COMMITS=$(git log "${LAST_TAG}..HEAD" --pretty=format:"%s" 2>/dev/null || echo "")
  TAG_INFO="Since tag: $LAST_TAG"
else
  COMMITS=$(git log --pretty=format:"%s" -n 50 2>/dev/null || echo "")
  TAG_INFO="No previous tags found (showing last 50 commits)"
fi

# If no commits found, provide minimal context
if [[ -z "$COMMITS" ]]; then
  CONTEXT="No commits found since last tag. Consider:
- Verifying you have commits to release
- Checking if the tag reference is correct"

  log_permission_feedback "allow" "gh release create - no commits found"
  output_allow_with_context "$CONTEXT"
  exit 0
fi

# Group commits by conventional commit type
# Using parallel arrays for Bash 3.2 compatibility (no associative arrays)
COMMITS_FEAT=""
COMMITS_FIX=""
COMMITS_DOCS=""
COMMITS_REFACTOR=""
COMMITS_TEST=""
COMMITS_CHORE=""
COMMITS_STYLE=""
COMMITS_PERF=""
COMMITS_CI=""
COMMITS_BUILD=""
COMMITS_OTHER=""

while IFS= read -r commit; do
  [[ -z "$commit" ]] && continue

  # Extract type from conventional commit format
  # Pattern stored in variable to avoid bash regex parsing issues
  CONV_COMMIT_PATTERN='^(feat|fix|docs|refactor|test|chore|style|perf|ci|build)(\([^)]+\))?:[[:space:]]+(.+)'
  if [[ "$commit" =~ $CONV_COMMIT_PATTERN ]]; then
    type="${BASH_REMATCH[1]}"
    case "$type" in
      feat)     COMMITS_FEAT="${COMMITS_FEAT}- $commit"$'\n' ;;
      fix)      COMMITS_FIX="${COMMITS_FIX}- $commit"$'\n' ;;
      docs)     COMMITS_DOCS="${COMMITS_DOCS}- $commit"$'\n' ;;
      refactor) COMMITS_REFACTOR="${COMMITS_REFACTOR}- $commit"$'\n' ;;
      test)     COMMITS_TEST="${COMMITS_TEST}- $commit"$'\n' ;;
      chore)    COMMITS_CHORE="${COMMITS_CHORE}- $commit"$'\n' ;;
      style)    COMMITS_STYLE="${COMMITS_STYLE}- $commit"$'\n' ;;
      perf)     COMMITS_PERF="${COMMITS_PERF}- $commit"$'\n' ;;
      ci)       COMMITS_CI="${COMMITS_CI}- $commit"$'\n' ;;
      build)    COMMITS_BUILD="${COMMITS_BUILD}- $commit"$'\n' ;;
    esac
  else
    # Non-conventional commits go to "other"
    COMMITS_OTHER="${COMMITS_OTHER}- $commit"$'\n'
  fi
done <<< "$COMMITS"

# Build the suggested changelog
CHANGELOG="## Suggested Changelog

$TAG_INFO

"

# Helper function to append section if not empty
append_section() {
  local header="$1"
  local commits="$2"
  if [[ -n "$commits" ]]; then
    CHANGELOG+="### $header
$commits
"
  fi
}

# Append sections in display order
append_section "Features" "$COMMITS_FEAT"
append_section "Bug Fixes" "$COMMITS_FIX"
append_section "Performance" "$COMMITS_PERF"
append_section "Refactoring" "$COMMITS_REFACTOR"
append_section "Documentation" "$COMMITS_DOCS"
append_section "Tests" "$COMMITS_TEST"
append_section "CI/CD" "$COMMITS_CI"
append_section "Build" "$COMMITS_BUILD"
append_section "Chores" "$COMMITS_CHORE"
append_section "Style" "$COMMITS_STYLE"
append_section "Other Changes" "$COMMITS_OTHER"

# Add usage hint
CHANGELOG+="---
USAGE: Copy relevant sections to your release notes.
Consider highlighting breaking changes (BREAKING CHANGE:) prominently.
"

# Count total commits for logging
COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

log_permission_feedback "allow" "gh release create with changelog ($COMMIT_COUNT commits)"
output_allow_with_context "$CHANGELOG"
exit 0
