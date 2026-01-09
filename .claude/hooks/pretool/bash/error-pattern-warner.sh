#!/bin/bash
set -euo pipefail
# Error Pattern Warner - Warns before executing commands matching known bad patterns
# Hook: PreToolUse (Bash)
#
# Checks commands against learned error patterns and warns user
# Cost: $0 - Just regex matching against local rules file

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

RULES_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/rules/error_rules.json"

# Skip if no rules file
if [[ ! -f "$RULES_FILE" ]]; then
  exit 0
fi

# Get the command being executed
COMMAND=$(get_field '.tool_input.command')

# Skip if empty
if [[ -z "$COMMAND" ]]; then
  exit 0
fi

# Check against known error patterns
# We look for patterns in the command that have caused errors before

# Common database connection patterns that often fail
if echo "$COMMAND" | grep -qE "psql.*-U\s+(postgres|skillforge|root)"; then
  # Check if this matches a known failure pattern
  if jq -e '.rules[] | select(.tool == "Bash" and (.signature | contains("role")))' "$RULES_FILE" >/dev/null 2>&1; then
    warn_with_box "Potential Connection Issue" "This psql command uses a role that has failed before.

Check your database connection settings:
- Docker: docker exec -it skillforge-postgres-dev psql -U skillforge_user -d skillforge_dev
- Local: Verify role exists with: \\du

Command: ${COMMAND:0:100}..."
  fi
fi

# Check for MCP postgres tool being used with wrong database
if echo "$COMMAND" | grep -qE "mcp__postgres"; then
  if jq -e '.rules[] | select(.tool == "mcp__postgres-mcp__query")' "$RULES_FILE" >/dev/null 2>&1; then
    warn "MCP postgres tool has had connection issues. Ensure MCP server is connected to correct database."
  fi
fi

# Generic pattern matching against all rules
# This is more expensive so we only do it for certain tool types
while IFS= read -r rule; do
  pattern=$(echo "$rule" | jq -r '.pattern // empty')
  signature=$(echo "$rule" | jq -r '.signature // empty')
  count=$(echo "$rule" | jq -r '.occurrence_count // 0')

  if [[ -n "$pattern" && "$count" -ge 3 ]]; then
    # Check if command output might match this error pattern
    # We can't check output before execution, but we can warn about similar inputs
    input_sample=$(echo "$rule" | jq -r '.sample_input.command // empty')
    if [[ -n "$input_sample" ]]; then
      # Simple similarity check - if commands share significant words
      common_words=$(comm -12 \
        <(echo "$COMMAND" | tr ' ' '\n' | sort -u) \
        <(echo "$input_sample" | tr ' ' '\n' | sort -u) | wc -l)

      if [[ "$common_words" -gt 3 ]]; then
        log_hook "Pattern match warning: command similar to known error pattern ($signature)"
        # Don't warn user for every match - just log it
      fi
    fi
  fi
done < <(jq -c '.rules[]?' "$RULES_FILE" 2>/dev/null || echo "")

# Output systemMessage for user visibility
echo '{"continue": true, "suppressOutput": true}'
exit 0
