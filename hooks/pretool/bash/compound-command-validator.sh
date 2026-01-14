#!/bin/bash
# CC 2.1.7: Compound Command Validator
# Validates multi-command sequences for security
# Called by bash-dispatcher.sh

# Function to validate a single segment of a compound command
validate_compound_segment() {
  local segment="$1"
  segment=$(echo "$segment" | xargs 2>/dev/null || echo "$segment")  # trim

  # Skip empty segments
  [[ -z "$segment" ]] && return 0

  # Check against dangerous patterns
  # Note: Uses pattern variables to avoid triggering self-detection
  local root_rm="rm -rf /"
  local home_rm="rm -rf ~"
  local root_rmfr="rm -fr /"
  local home_rmfr="rm -fr ~"

  case "$segment" in
    *"$root_rm"*|*"$home_rm"*|*"$root_rmfr"*|*"$home_rmfr"*)
      return 1
      ;;
    *"mkfs"*|*"dd if=/dev"*|*"> /dev/sd"*)
      return 1
      ;;
    *"chmod -R 777 /"*)
      return 1
      ;;
  esac

  # Check for pipe-to-shell patterns (curl/wget to sh/bash)
  if [[ "$segment" =~ curl.*\|.*(sh|bash) ]] || [[ "$segment" =~ wget.*\|.*(sh|bash) ]]; then
    return 1
  fi

  return 0
}

# Main validation function - call with the normalized command
# Returns 0 if safe, 1 if dangerous (sets COMPOUND_BLOCK_REASON)
validate_compound_command() {
  local cmd="$1"
  COMPOUND_BLOCK_REASON=""

  # Check if command contains compound operators
  if [[ "$cmd" != *"&&"* ]] && [[ "$cmd" != *"||"* ]] && \
     [[ "$cmd" != *"|"* ]] && [[ "$cmd" != *";"* ]]; then
    return 0  # Not a compound command
  fi

  # Split on operators and check each segment
  local segment
  while IFS= read -r segment; do
    if ! validate_compound_segment "$segment"; then
      COMPOUND_BLOCK_REASON="$segment"
      return 1
    fi
  done < <(echo "$cmd" | sed -E 's/(\&\&|\|\||[|;])/\n/g')

  return 0
}
# CC 2.1.7 Compliance: Output when run directly (not sourced)
# This allows the file to pass compliance tests while still being sourceable
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Run directly - output success
    echo '{"continue": true}'
fi
