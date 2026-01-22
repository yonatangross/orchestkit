#!/bin/bash
# Runs after Bash commands in security-scanning skill
# Warns if potential secrets detected in output
# CC 2.1.7 Compliant: Proper JSON output

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Get output from hook input JSON (CC 2.1.7 format)
CC_TOOL_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.tool_result // .output // ""' 2>/dev/null || echo "")

if [ -z "$CC_TOOL_OUTPUT" ]; then
  output_silent_success
  exit 0
fi

# Check for common API key patterns
if echo "$CC_TOOL_OUTPUT" | grep -qiE \
  "(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+)"; then
  echo "::warning::Potential API key detected in output - verify redaction" >&2
fi

# Check for generic secret patterns
if echo "$CC_TOOL_OUTPUT" | grep -qiE \
  "(password\s*[:=]\s*['\"][^'\"]+['\"]|secret\s*[:=]\s*['\"][^'\"]+['\"])"; then
  echo "::warning::Potential hardcoded credential in output" >&2
fi

# CC 2.1.7: Silent success - warnings printed to stderr, don't block
output_silent_success
exit 0
