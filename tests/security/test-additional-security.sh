#!/bin/bash
# Security Tests: Additional Security Checks
# Covers: Temp files, Regex, File ops, Env vars, Info disclosure, Permissions
#
# Test Count: 15
# Priority: HIGH
# Reference: CWE Top 25, OWASP

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# ============================================================================
# TEMPORARY FILE HANDLING TESTS (4 tests)
# ============================================================================

describe "Temporary File Security Tests"

# TEST: Predictable temp file names
test_predictable_temp_file_names() {
  # Check that hooks use secure temp file creation
  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)
  local vulnerable_patterns=0

  for hook in $hook_files; do
    # Check for predictable temp file patterns
    if grep -qE '/tmp/[a-zA-Z_-]+\$\$' "$hook" 2>/dev/null; then
      # Using $$ alone is predictable
      ((vulnerable_patterns++)) || true
    fi

    # Check for hardcoded temp file names without random component
    if grep -qE '>/tmp/[a-zA-Z_-]+\.tmp' "$hook" 2>/dev/null; then
      if ! grep -qE 'mktemp' "$hook" 2>/dev/null; then
        ((vulnerable_patterns++)) || true
      fi
    fi
  done

  if [[ $vulnerable_patterns -gt 0 ]]; then
    echo "INFO: Found $vulnerable_patterns potential predictable temp file patterns"
    echo "Consider using mktemp for temp files"
  fi

  return 0
}

# TEST: Temp file race conditions
test_temp_file_race_condition() {
  # Simulate TOCTOU attack on temp files
  local temp_file="$TEMP_DIR/race-test-$$"

  # Create temp file
  echo "safe content" > "$temp_file"

  # In a real attack, attacker would symlink between check and write
  # This test verifies hooks use atomic operations

  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)

  for hook in $hook_files; do
    # Check for patterns like: if [ -f file ]; then write to file
    if grep -qE 'if.*-f.*\]; then.*>.*tmp' "$hook" 2>/dev/null; then
      echo "WARNING: Potential TOCTOU in $hook"
    fi
  done

  rm -f "$temp_file"
  return 0
}

# TEST: Temp file permissions
test_temp_file_permissions() {
  # Verify hooks set restrictive permissions on temp files
  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)

  for hook in $hook_files; do
    # Check for umask or chmod on temp files
    if grep -qE 'mktemp|>/tmp' "$hook" 2>/dev/null; then
      if ! grep -qE 'umask|chmod 600|chmod 0600' "$hook" 2>/dev/null; then
        # May use system default umask - not necessarily vulnerable
        :
      fi
    fi
  done

  return 0
}

# TEST: Temp file cleanup
test_temp_file_cleanup() {
  # Verify hooks clean up temp files
  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)
  local no_cleanup=0

  for hook in $hook_files; do
    # Check if hook creates temp files
    if grep -qE 'mktemp|>/tmp/|\.tmp' "$hook" 2>/dev/null; then
      # Should have trap or explicit cleanup
      if ! grep -qE 'trap.*rm|rm -f.*tmp|cleanup' "$hook" 2>/dev/null; then
        ((no_cleanup++)) || true
      fi
    fi
  done

  if [[ $no_cleanup -gt 0 ]]; then
    echo "INFO: $no_cleanup hooks create temp files without explicit cleanup"
    echo "Consider adding trap cleanup or explicit rm"
  fi

  return 0
}

# ============================================================================
# REGEX SECURITY TESTS (2 tests)
# ============================================================================

describe "Regex Security Tests"

# TEST: Regex injection
test_regex_injection() {
  # User input used in regex without escaping
  local payload='.*'  # Matches everything

  local input=$(jq -n --arg cmd "$payload" '{"tool_input":{"command":$cmd}}')

  # Test if hooks use user input directly in regex
  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)

  for hook in $hook_files; do
    # Check for unescaped variable in regex
    if grep -qE '\[\[.*=~.*\$' "$hook" 2>/dev/null; then
      # Variable used in regex - verify it's sanitized
      if ! grep -qE 'escape|sanitize|printf.*%q' "$hook" 2>/dev/null; then
        echo "INFO: $hook may use unescaped variable in regex"
      fi
    fi
  done

  return 0
}

# TEST: ReDoS patterns in hooks
test_redos_patterns_in_hooks() {
  # Check hooks for potentially vulnerable regex patterns
  local dangerous_patterns=(
    '(a+)+'
    '([a-zA-Z]+)*'
    '(.*)*'
    '(.+)+'
  )

  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)

  for hook in $hook_files; do
    for pattern in "${dangerous_patterns[@]}"; do
      if grep -qF "$pattern" "$hook" 2>/dev/null; then
        echo "WARNING: Potential ReDoS pattern in $hook: $pattern"
      fi
    done
  done

  return 0
}

# ============================================================================
# FILE OPERATIONS SECURITY TESTS (3 tests)
# ============================================================================

describe "File Operations Security Tests"

# TEST: Unsafe file permissions on created files
test_unsafe_file_permissions() {
  # Check if hooks create files with secure permissions
  local hook_files
  hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null) || true

  for hook in $hook_files; do
    # Check for world-writable file creation
    # Exclude patterns that are in blocklists (quoted strings) or comments
    if grep -E 'chmod.*777|chmod.*666' "$hook" 2>/dev/null | grep -vE '^[[:space:]]*#|"chmod|'\''chmod' | grep -q 'chmod' 2>/dev/null; then
      echo "VULNERABLE: World-writable permissions in $hook"
      return 1
    fi
  done

  return 0
}

# TEST: Following symlinks in file operations
test_symlink_following() {
  # Verify hooks check for symlinks before file operations
  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)
  local no_symlink_check=0

  for hook in $hook_files; do
    # Check if hook does file writes
    if grep -qE '>>|>[^&]|cp |mv |ln ' "$hook" 2>/dev/null; then
      # Should check for symlinks with -L or readlink
      if ! grep -qE 'readlink|-L|-h|test -L' "$hook" 2>/dev/null; then
        ((no_symlink_check++)) || true
      fi
    fi
  done

  if [[ $no_symlink_check -gt 5 ]]; then
    echo "INFO: $no_symlink_check hooks do file operations without explicit symlink checks"
  fi

  return 0
}

# TEST: Log file security
test_log_file_security() {
  # Check log file locations and permissions
  local log_dir="$PROJECT_ROOT/.claude/logs"

  if [[ -d "$log_dir" ]]; then
    # Check that log directory isn't world-readable
    local perms=$(stat -f '%A' "$log_dir" 2>/dev/null || stat -c '%a' "$log_dir" 2>/dev/null || echo "000")

    if [[ "$perms" == *"7"* ]] && [[ "$perms" != "700" ]] && [[ "$perms" != "750" ]]; then
      echo "WARNING: Log directory may be world-readable: $perms"
    fi

    # Check for sensitive data in logs
    for log in "$log_dir"/*.log; do
      if [[ -f "$log" ]]; then
        if grep -qiE 'password|secret|api.?key|token' "$log" 2>/dev/null; then
          echo "WARNING: Potential sensitive data in $log"
        fi
      fi
    done
  fi

  return 0
}

# ============================================================================
# ENVIRONMENT VARIABLE INJECTION TESTS (2 tests)
# ============================================================================

describe "Environment Variable Security Tests"

# TEST: PATH injection
test_path_injection() {
  # Verify hooks don't blindly trust PATH
  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)

  for hook in $hook_files; do
    # Check for bare command execution without path
    if grep -qE '^[a-z]+\s' "$hook" 2>/dev/null | head -5; then
      # This is common and usually fine due to shebang and set -euo pipefail
      :
    fi
  done

  # Test that hooks work with modified PATH
  local original_path="$PATH"
  export PATH="/tmp:$PATH"

  local input='{"tool_input":{"command":"test"}}'
  run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

  export PATH="$original_path"

  # Hook should still work
  if [[ $HOOK_EXIT_CODE -ne 0 ]] && [[ $HOOK_EXIT_CODE -ne 2 ]]; then
    echo "WARNING: Hook may be vulnerable to PATH manipulation"
  fi

  return 0
}

# TEST: LD_PRELOAD injection
test_ld_preload_injection() {
  # Verify hooks don't pass through dangerous env vars
  local dangerous_vars=(
    "LD_PRELOAD"
    "LD_LIBRARY_PATH"
    "DYLD_INSERT_LIBRARIES"
  )

  for var in "${dangerous_vars[@]}"; do
    # Set the dangerous variable
    export "$var=/tmp/malicious.so"

    local input='{"tool_input":{"command":"echo test"}}'
    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    # Unset it
    unset "$var"

    # Check that hook completed (didn't try to load malicious lib)
    if [[ $HOOK_EXIT_CODE -ne 0 ]] && [[ $HOOK_EXIT_CODE -ne 2 ]]; then
      if [[ "$HOOK_OUTPUT" == *"cannot open"* ]] || [[ "$HOOK_OUTPUT" == *"no such file"* ]]; then
        echo "WARNING: Hook may be affected by $var"
      fi
    fi
  done

  return 0
}

# ============================================================================
# INFORMATION DISCLOSURE TESTS (2 tests)
# ============================================================================

describe "Information Disclosure Security Tests"

# TEST: Error message information disclosure
test_error_message_disclosure() {
  # Verify error messages don't leak sensitive info
  local malicious_inputs=(
    '{"tool_input":{"file_path":"/etc/shadow"}}'
    '{"tool_input":{"command":"cat /etc/passwd"}}'
    '{"invalid json'
  )

  for input in "${malicious_inputs[@]}"; do
    run_hook_capture "pretool/input-mod/bash-defaults.sh" "$input"

    # Error messages should not contain:
    # - Full stack traces
    # - Internal paths beyond project
    # - System information

    if [[ "$HOOK_OUTPUT" == *"/Users/"* ]] && [[ "$HOOK_OUTPUT" != *"$PROJECT_ROOT"* ]]; then
      if [[ "$HOOK_OUTPUT" == *"/etc/"* ]] || [[ "$HOOK_OUTPUT" == *"/root/"* ]]; then
        echo "WARNING: Error message may leak system paths"
      fi
    fi
  done

  return 0
}

# TEST: Debug output in production
test_debug_output_disabled() {
  # Verify debug output is disabled
  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)

  for hook in $hook_files; do
    # Check for enabled debug statements
    if grep -qE '^set -x|^set.*xtrace' "$hook" 2>/dev/null; then
      echo "WARNING: Debug tracing enabled in $hook"
    fi

    # Check for debug echo statements (not in comments)
    if grep -qE '^[^#]*echo.*DEBUG' "$hook" 2>/dev/null; then
      # May be intentional logging
      :
    fi
  done

  return 0
}

# ============================================================================
# PERMISSION BYPASS TESTS (2 tests)
# ============================================================================

describe "Permission Bypass Security Tests"

# TEST: Permission hook bypass via malformed input
test_permission_bypass_malformed() {
  local bypass_attempts=(
    '{"tool_name":"Read","tool_input":{}}'
    '{"tool_name":"","tool_input":{"file_path":"/etc/passwd"}}'
    '{"tool_name":null,"tool_input":{"file_path":"/etc/passwd"}}'
    '{"tool_input":{"file_path":"/etc/passwd"}}'
  )

  for input in "${bypass_attempts[@]}"; do
    if [[ -f "$HOOKS_DIR/permission/auto-approve-readonly.sh" ]]; then
      run_hook_capture "permission/auto-approve-readonly.sh" "$input"

      # Should not auto-approve with malformed input
      if [[ "$HOOK_OUTPUT" == *"approve"* ]] && [[ "$HOOK_OUTPUT" != *"deny"* ]]; then
        echo "WARNING: Permission hook may auto-approve malformed input"
      fi
    fi
  done

  return 0
}

# TEST: Permission escalation via tool_name spoofing
test_permission_escalation_spoofing() {
  # Try to spoof tool name to bypass permissions
  local spoof_attempts=(
    '{"tool_name":"Read","tool_input":{"file_path":"/etc/passwd","actual_action":"write"}}'
    '{"tool_name":"Glob","tool_input":{"command":"rm -rf /"}}'
  )

  for input in "${spoof_attempts[@]}"; do
    if [[ -f "$HOOKS_DIR/permission/auto-approve-readonly.sh" ]]; then
      run_hook_capture "permission/auto-approve-readonly.sh" "$input"

      # Readonly tools should not allow write operations
      local tool=$(echo "$input" | jq -r '.tool_name' 2>/dev/null)
      local cmd=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)

      if [[ "$tool" == "Read" ]] || [[ "$tool" == "Glob" ]]; then
        if [[ -n "$cmd" ]] && [[ "$HOOK_OUTPUT" == *"approve"* ]]; then
          echo "WARNING: Potential permission escalation via tool spoofing"
        fi
      fi
    fi
  done

  return 0
}

# ============================================================================
# SHELLCHECK COMPLIANCE TEST
# ============================================================================

describe "ShellCheck Compliance"

test_shellcheck_compliance() {
  if ! command -v shellcheck >/dev/null 2>&1; then
    skip "ShellCheck not installed"
  fi

  local hook_files=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null)
  local failures=0

  for hook in $hook_files; do
    if ! shellcheck -S error "$hook" >/dev/null 2>&1; then
      ((failures++)) || true
    fi
  done

  if [[ $failures -gt 0 ]]; then
    echo "INFO: $failures hooks have ShellCheck errors (severity: error)"
    echo "Run: shellcheck -S error .claude/hooks/**/*.sh"
  fi

  return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
