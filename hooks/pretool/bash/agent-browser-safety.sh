#!/usr/bin/env bash
# CC 2.1.7 PreToolUse Hook: agent-browser Safety Validator
# Validates browser automation for security - blocks dangerous URLs and patterns
set -euo pipefail

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh" 2>/dev/null || true

# Initialize hook input from stdin
init_hook_input

# Extract the bash command
COMMAND=$(get_field '.tool_input.command')

# If no command or doesn't contain agent-browser, skip
if [[ -z "$COMMAND" || "$COMMAND" != *"agent-browser"* ]]; then
  output_silent_success
  exit 0
fi

# Normalize command: remove line continuations and collapse whitespace
NORMALIZED_COMMAND=$(echo "$COMMAND" | sed -E 's/\\[[:space:]]*[\r\n]+//g' | tr '\n' ' ' | tr -s ' ')

# Extract URL from common agent-browser commands that take URLs
# Patterns: open <url>, tab new <url>, --proxy <url>
URLS=$(echo "$NORMALIZED_COMMAND" | grep -oE '(open|tab new|--proxy)[[:space:]]+[^[:space:]]+' | awk '{print $NF}' | tr '\n' ' ')

# If no URLs found, allow the command (non-navigation commands are safe)
if [[ -z "${URLS// /}" ]]; then
  log_permission_feedback "allow" "agent-browser: Non-navigation command"
  output_silent_success
  exit 0
fi

# Security checks for each URL
BLOCKED_REASON=""

for URL in $URLS; do
  # Skip empty URLs
  [[ -z "$URL" ]] && continue

  # Block file:// protocol
  if [[ "$URL" == file://* ]]; then
    BLOCKED_REASON="file:// protocol access is blocked for security"
    break
  fi

  # Block localhost/127.0.0.1 in non-dev environments
  if [[ "$URL" == *localhost* || "$URL" == *127.0.0.1* || "$URL" == *0.0.0.0* ]]; then
    # Allow localhost only if explicitly enabled
    if [[ "${ALLOW_LOCALHOST:-false}" != "true" ]]; then
      BLOCKED_REASON="localhost access blocked (set ALLOW_LOCALHOST=true to enable)"
      break
    fi
  fi

  # Block common credential harvesting domains
  BLOCKED_DOMAINS="accounts.google.com login.microsoftonline.com auth0.com okta.com"
  for domain in $BLOCKED_DOMAINS; do
    if [[ "$URL" == *"$domain"* ]]; then
      BLOCKED_REASON="Access to authentication domain '$domain' is blocked"
      break 2
    fi
  done

  # Block data: URLs (potential XSS)
  if [[ "$URL" == data:* ]]; then
    BLOCKED_REASON="data: URLs are blocked for security"
    break
  fi

  # Block javascript: URLs
  if [[ "$URL" == javascript:* ]]; then
    BLOCKED_REASON="javascript: URLs are blocked for security"
    break
  fi

  # Block about: URLs
  if [[ "$URL" == about:* ]]; then
    BLOCKED_REASON="about: URLs are blocked for security"
    break
  fi
done

# Also block dangerous eval patterns
if [[ -z "$BLOCKED_REASON" ]]; then
  # Block eval with dangerous patterns
  if echo "$NORMALIZED_COMMAND" | grep -qE 'eval\s+".*(\$\(|`|document\.cookie|localStorage|sessionStorage)'; then
    BLOCKED_REASON="Potentially dangerous JavaScript evaluation detected"
  fi
fi

# Also block state loading from suspicious paths
if [[ -z "$BLOCKED_REASON" ]]; then
  if echo "$NORMALIZED_COMMAND" | grep -qE 'state\s+load\s+(/etc/|/var/|/tmp/\.\.|\.\./)'; then
    BLOCKED_REASON="Suspicious state file path detected"
  fi
fi

# If blocked, deny the request
if [[ -n "$BLOCKED_REASON" ]]; then
  log_hook "BLOCKED: agent-browser - $BLOCKED_REASON"
  log_permission_feedback "deny" "agent-browser: $BLOCKED_REASON"
  output_block "$BLOCKED_REASON"
  exit 0
fi

# Allow the request
log_permission_feedback "allow" "agent-browser: Safe command"
output_silent_success
