#!/bin/bash
# Security Tests: Command Injection
# Tests for command injection vulnerabilities in bash-related hooks
#
# Test Count: 5
# Priority: HIGH
# Reference: OWASP Command Injection, CWE-78

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# ============================================================================
# COMMAND INJECTION TESTS
# ============================================================================

describe "Command Injection Security Tests"

# Marker file for detecting successful injection
INJECTION_MARKER="$TEMP_DIR/injection-marker-$$"

# TEST 1.3.1: Command Chaining Injection
test_command_chaining_injection() {
  rm -f "$INJECTION_MARKER"

  local payloads=(
    "git status; touch $INJECTION_MARKER"
    "git status && touch $INJECTION_MARKER"
    "git status || touch $INJECTION_MARKER"
    "git status | touch $INJECTION_MARKER"
  )

  for payload in "${payloads[@]}"; do
    rm -f "$INJECTION_MARKER"

    local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

    # Test bash-defaults hook
    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    # Also test git-branch-protection as it parses commands
    run_hook_capture "pretool/bash/git-branch-protection.sh" "$input"

    # The marker file should NOT be created
    if [[ -f "$INJECTION_MARKER" ]]; then
      echo "VULNERABLE: Command injection succeeded with: $payload"
      rm -f "$INJECTION_MARKER"
      return 1
    fi
  done

  return 0
}

# TEST 1.3.2: Subshell Injection
test_subshell_injection() {
  rm -f "$INJECTION_MARKER"

  local payloads=(
    "\$(touch $INJECTION_MARKER)"
    "git \$(touch $INJECTION_MARKER)"
    "test \$(cat /etc/passwd > $INJECTION_MARKER)"
  )

  for payload in "${payloads[@]}"; do
    rm -f "$INJECTION_MARKER"

    local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

    # Test all bash-related hooks
    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    if [[ -f "$INJECTION_MARKER" ]]; then
      echo "VULNERABLE: Subshell injection succeeded with: $payload"
      rm -f "$INJECTION_MARKER"
      return 1
    fi
  done

  return 0
}

# TEST 1.3.3: Backtick Injection
test_backtick_injection() {
  rm -f "$INJECTION_MARKER"

  local payloads=(
    "\`touch $INJECTION_MARKER\`"
    "git \`touch $INJECTION_MARKER\`"
    "echo \`cat /etc/passwd\`"
  )

  for payload in "${payloads[@]}"; do
    rm -f "$INJECTION_MARKER"

    local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    if [[ -f "$INJECTION_MARKER" ]]; then
      echo "VULNERABLE: Backtick injection succeeded with: $payload"
      rm -f "$INJECTION_MARKER"
      return 1
    fi
  done

  return 0
}

# TEST 1.3.4: Variable Expansion Injection
test_variable_expansion_injection() {
  rm -f "$INJECTION_MARKER"

  local payloads=(
    "\${IFS}touch\${IFS}$INJECTION_MARKER"
    "git status; \$PATH"
    "echo \${HOME}/.ssh/id_rsa"
  )

  for payload in "${payloads[@]}"; do
    rm -f "$INJECTION_MARKER"

    local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    if [[ -f "$INJECTION_MARKER" ]]; then
      echo "VULNERABLE: Variable expansion injection succeeded with: $payload"
      rm -f "$INJECTION_MARKER"
      return 1
    fi
  done

  return 0
}

# TEST 1.3.5: Newline Injection
test_newline_injection() {
  rm -f "$INJECTION_MARKER"

  # Payloads with literal newlines (using $'...' syntax)
  local payloads=(
    $'git status\ntouch '"$INJECTION_MARKER"
    $'safe\n$(touch '"$INJECTION_MARKER"')'
    $'git\nrm -rf /'
  )

  for payload in "${payloads[@]}"; do
    rm -f "$INJECTION_MARKER"

    local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    if [[ -f "$INJECTION_MARKER" ]]; then
      echo "VULNERABLE: Newline injection succeeded"
      rm -f "$INJECTION_MARKER"
      return 1
    fi
  done

  return 0
}

# ============================================================================
# ADDITIONAL COMMAND INJECTION TESTS
# ============================================================================

# Test dangerous command blocking
test_dangerous_command_blocking() {
  local dangerous_commands=(
    "rm -rf /"
    "rm -rf /*"
    "git push --force"
    "git push origin main --force"
    "dd if=/dev/zero of=/dev/sda"
    "mkfs.ext4 /dev/sda"
    "> /dev/sda"
    "chmod -R 777 /"
  )

  for cmd in "${dangerous_commands[@]}"; do
    local input=$(jq -n --arg cmd "$cmd" '{"tool_input":{"command":$cmd}}')

    # Test git-branch-protection for git commands
    if [[ "$cmd" == git* ]]; then
      run_hook_capture "pretool/bash/git-branch-protection.sh" "$input"

      if [[ $HOOK_EXIT_CODE -eq 0 ]] && [[ "$cmd" == *"--force"* ]]; then
        # Force push should be blocked or warned
        if [[ "$HOOK_OUTPUT" != *"BLOCK"* ]] && [[ "$HOOK_OUTPUT" != *"WARNING"* ]] && [[ "$HOOK_OUTPUT" != *"protected"* ]]; then
          echo "WARNING: Force push not blocked: $cmd"
        fi
      fi
    fi

    # TODO: Add more dangerous command checks as hooks are implemented
  done

  return 0
}

# Test command with special characters
test_special_character_handling() {
  local payloads=(
    "git status > /tmp/out"
    "git status >> /tmp/out"
    "git status < /etc/passwd"
    "git status 2>&1"
  )

  for payload in "${payloads[@]}"; do
    local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

    # These are valid shell redirects but could be dangerous
    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    # At minimum, hooks should not error on these
    if [[ $HOOK_EXIT_CODE -ne 0 ]] && [[ $HOOK_EXIT_CODE -ne 2 ]]; then
      echo "WARNING: Unexpected error on command: $payload (exit: $HOOK_EXIT_CODE)"
    fi
  done

  return 0
}

# Test environment variable injection via hook
test_env_var_injection_via_hook() {
  # Test that hooks don't accidentally expand dangerous environment variables
  export MALICIOUS_VAR='$(touch /tmp/pwned)'

  local input='{"tool_input":{"command":"echo test"}}'

  # Run hook with potentially dangerous env
  run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

  # Verify the hook didn't expand the malicious var
  if [[ -f "/tmp/pwned" ]]; then
    echo "VULNERABLE: Environment variable injection via hook"
    rm -f "/tmp/pwned"
    return 1
  fi

  unset MALICIOUS_VAR
  return 0
}

# Test for unsafe quote handling
test_unsafe_quote_handling() {
  local payloads=(
    "git commit -m 'test'; touch $INJECTION_MARKER"
    'git commit -m "test"; touch '"$INJECTION_MARKER"
    "git commit -m \"test\"; touch $INJECTION_MARKER"
    "git commit -m 'test\"'; touch $INJECTION_MARKER"
  )

  for payload in "${payloads[@]}"; do
    rm -f "$INJECTION_MARKER"

    local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    if [[ -f "$INJECTION_MARKER" ]]; then
      echo "VULNERABLE: Quote handling injection: $payload"
      rm -f "$INJECTION_MARKER"
      return 1
    fi
  done

  return 0
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup() {
  rm -f "$INJECTION_MARKER"
  rm -f "/tmp/pwned"
}

trap cleanup EXIT

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
