#!/bin/bash
set -euo pipefail
# Error Pattern Warner - Warns before executing commands matching known bad patterns
# Hook: PreToolUse (Bash)
# CC 2.1.9 Enhanced: injects additionalContext with learned error patterns
#
# Checks commands against learned error patterns and injects context proactively
# Cost: $0 - Just regex matching against local rules file

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

RULES_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/rules/error_rules.json"

# Self-guard: Only run if error_rules.json exists
if [[ ! -f "$RULES_FILE" ]]; then
  output_silent_success
  exit 0
fi

# Get the command being executed
COMMAND=$(get_field '.tool_input.command')

# Skip if empty
if [[ -z "$COMMAND" ]]; then
  output_silent_success
  exit 0
fi

# CC 2.1.9: Collect relevant error patterns for context injection
PATTERN_HINTS=""

# Check against known error patterns
# We look for patterns in the command that have caused errors before

# Common database connection patterns that often fail
if echo "$COMMAND" | grep -qE "psql.*-U\s+(postgres|skillforge|root)"; then
  # Check if this matches a known failure pattern
  if jq -e '.rules[] | select(.tool == "Bash" and (.signature | contains("role")))' "$RULES_FILE" >/dev/null 2>&1; then
    PATTERN_HINTS="$PATTERN_HINTS | DB role error: use docker exec -it <container> psql -U skillforge_user"
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
    PATTERN_HINTS="$PATTERN_HINTS | MCP postgres: verify connection to correct database"
    warn "MCP postgres tool has had connection issues. Ensure MCP server is connected to correct database."
  fi
fi

# CC 2.1.9: Collect high-occurrence error patterns for context
HIGH_OCCURRENCE_HINTS=""
while IFS= read -r rule; do
  pattern=$(echo "$rule" | jq -r '.pattern // empty')
  signature=$(echo "$rule" | jq -r '.signature // empty')
  count=$(echo "$rule" | jq -r '.occurrence_count // 0')
  fix=$(echo "$rule" | jq -r '.suggested_fix // empty')

  if [[ -n "$pattern" && "$count" -ge 5 ]]; then
    # Check if command might match this error pattern
    input_sample=$(echo "$rule" | jq -r '.sample_input.command // empty')
    if [[ -n "$input_sample" ]]; then
      # Simple similarity check - if commands share significant words
      common_words=$(comm -12 \
        <(echo "$COMMAND" | tr ' ' '\n' | sort -u) \
        <(echo "$input_sample" | tr ' ' '\n' | sort -u) 2>/dev/null | wc -l | tr -d ' ')

      if [[ "$common_words" -gt 3 ]]; then
        log_hook "Pattern match warning: command similar to known error pattern ($signature)"
        # Add to hints for additionalContext
        if [[ -n "$fix" ]]; then
          HIGH_OCCURRENCE_HINTS="$HIGH_OCCURRENCE_HINTS | $signature (${count}x): $fix"
        else
          HIGH_OCCURRENCE_HINTS="$HIGH_OCCURRENCE_HINTS | $signature (${count}x)"
        fi
      fi
    fi
  fi
done < <(jq -c '.rules[]?' "$RULES_FILE" 2>/dev/null || echo "")

# CC 2.1.9: Inject additionalContext if we have pattern hints
if [[ -n "$PATTERN_HINTS" || -n "$HIGH_OCCURRENCE_HINTS" ]]; then
  CONTEXT_MSG="Learned error patterns${PATTERN_HINTS}${HIGH_OCCURRENCE_HINTS}"
  # Truncate if too long (keep under 200 chars for context budget)
  if [[ ${#CONTEXT_MSG} -gt 200 ]]; then
    CONTEXT_MSG="${CONTEXT_MSG:0:197}..."
  fi
  output_with_context "$CONTEXT_MSG"
  exit 0
fi

# No relevant patterns found - silent success
output_silent_success
exit 0