#!/bin/bash
# Runs after Bash commands in security-scanning skill
# Warns if potential secrets detected in output

if [ -z "$CC_TOOL_OUTPUT" ]; then
  exit 0
fi

# Check for common API key patterns
if echo "$CC_TOOL_OUTPUT" | grep -qiE \
  "(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+)"; then
  echo "::warning::Potential API key detected in output - verify redaction"
fi

# Check for generic secret patterns
if echo "$CC_TOOL_OUTPUT" | grep -qiE \
  "(password\s*[:=]\s*['\"][^'\"]+['\"]|secret\s*[:=]\s*['\"][^'\"]+['\"])"; then
  echo "::warning::Potential hardcoded credential in output"
fi


# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Secrets checked","continue":true}'
exit 0  # Don't block, just warn
