#!/usr/bin/env bash
# CC 2.1.7 PreToolUse Hook: Playwright Safety Validator
# Validates browser automation for security - blocks dangerous URLs
set -euo pipefail

# Read stdin once and cache
INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Only process playwright MCP calls
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
if [[ "$TOOL_NAME" != mcp__playwright__* ]]; then
  output_silent_success
  exit 0
fi

# Extract URL from navigation commands
URL=$(echo "$INPUT" | jq -r '.tool_input.url // .tool_input.href // ""')

# Skip if no URL (non-navigation commands)
if [[ -z "$URL" ]]; then
  log_permission_feedback "playwright" "allow" "Non-navigation command: $TOOL_NAME"
  output_silent_success
  exit 0
fi

# Security checks
BLOCKED_REASON=""

# Block file:// protocol
if [[ "$URL" == file://* ]]; then
  BLOCKED_REASON="file:// protocol access is blocked for security"
fi

# Block localhost/127.0.0.1 in non-dev environments
if [[ -z "$BLOCKED_REASON" ]]; then
  if [[ "$URL" == *localhost* || "$URL" == *127.0.0.1* || "$URL" == *0.0.0.0* ]]; then
    # Allow localhost only if explicitly enabled
    if [[ "${ALLOW_LOCALHOST:-false}" != "true" ]]; then
      BLOCKED_REASON="localhost access blocked (set ALLOW_LOCALHOST=true to enable)"
    fi
  fi
fi

# Block common credential harvesting domains
if [[ -z "$BLOCKED_REASON" ]]; then
  BLOCKED_DOMAINS="accounts.google.com login.microsoftonline.com auth0.com okta.com"
  for domain in $BLOCKED_DOMAINS; do
    if [[ "$URL" == *"$domain"* ]]; then
      BLOCKED_REASON="Access to authentication domain '$domain' is blocked"
      break
    fi
  done
fi

# Block data: URLs (potential XSS)
if [[ -z "$BLOCKED_REASON" && "$URL" == data:* ]]; then
  BLOCKED_REASON="data: URLs are blocked for security"
fi

# Block javascript: URLs
if [[ -z "$BLOCKED_REASON" && "$URL" == javascript:* ]]; then
  BLOCKED_REASON="javascript: URLs are blocked for security"
fi

# If blocked, deny the request
if [[ -n "$BLOCKED_REASON" ]]; then
  log_permission_feedback "playwright" "deny" "$BLOCKED_REASON"
  output_block "$BLOCKED_REASON"
  exit 0
fi

# Allow the request
log_permission_feedback "playwright" "allow" "Safe URL: $URL"
output_silent_success