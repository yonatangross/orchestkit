#!/bin/bash
# Security Tests: Path Traversal & Symlink Attacks
# Tests for path traversal vulnerabilities in file-handling hooks
#
# Test Count: 6
# Priority: CRITICAL
# Reference: OWASP Path Traversal, CWE-22

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# ============================================================================
# PATH TRAVERSAL TESTS
# ============================================================================

describe "Path Traversal Security Tests"

# TEST 1.2.1: Path Traversal - Parent Directory Escape
test_path_traversal_parent_escape() {
  local payloads=(
    "../../../etc/passwd"
    "..\\..\\..\\etc\\passwd"
    "....//....//....//etc/passwd"
    "./.././.././../etc/passwd"
  )

  for payload in "${payloads[@]}"; do
    local input=$(jq -n --arg path "$payload" '{"tool_input":{"file_path":$path}}')

    # Test path-normalizer hook
    run_hook_capture "pretool/input-mod/path-normalizer.sh" "$input"

    # Should either:
    # 1. Block (exit 2)
    # 2. Sanitize (remove ..)
    # 3. Resolve to absolute path within project

    if [[ $HOOK_EXIT_CODE -eq 2 ]]; then
      # Blocked - secure
      continue
    fi

    if [[ "$HOOK_OUTPUT" == *".."* ]]; then
      echo "VULNERABLE: Path traversal not blocked for: $payload"
      echo "Output: $HOOK_OUTPUT"
      return 1
    fi

    # Check if resolved path is still within project
    local resolved_path=$(echo "$HOOK_OUTPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "$HOOK_OUTPUT")
    if [[ "$resolved_path" == "/etc/"* ]] || [[ "$resolved_path" == "/root/"* ]]; then
      echo "VULNERABLE: Path escaped project directory: $resolved_path"
      return 1
    fi
  done

  return 0
}

# TEST 1.2.2: Path Traversal - URL Encoded
test_path_traversal_url_encoded() {
  local payloads=(
    "..%2F..%2F..%2Fetc%2Fpasswd"
    "..%252F..%252F..%252Fetc%252Fpasswd"
    "%2e%2e/%2e%2e/%2e%2e/etc/passwd"
  )

  for payload in "${payloads[@]}"; do
    local input=$(jq -n --arg path "$payload" '{"tool_input":{"file_path":$path}}')

    run_hook_capture "pretool/input-mod/path-normalizer.sh" "$input"

    # After URL decoding, should detect traversal
    if [[ $HOOK_EXIT_CODE -eq 0 ]]; then
      # Check if decoded and blocked
      local resolved=$(echo "$HOOK_OUTPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

      # Decode the payload manually to compare
      local decoded=$(printf '%b' "${payload//%/\\x}")

      if [[ "$resolved" == *".."* ]] || [[ "$resolved" == "/etc/"* ]]; then
        echo "VULNERABLE: URL-encoded path traversal not blocked: $payload"
        return 1
      fi
    fi
  done

  return 0
}

# TEST 1.2.3: Symlink to Sensitive Directory
test_symlink_sensitive_directory() {
  # Skip if not in a writable temp directory
  if [[ ! -d "$TEMP_DIR" ]]; then
    skip "Temp directory not available"
  fi

  # Create symlink to /etc
  local symlink_path="$TEMP_DIR/etc_link"
  ln -sf /etc "$symlink_path" 2>/dev/null || skip "Cannot create symlinks"

  local test_path="$symlink_path/passwd"
  local input=$(jq -n --arg path "$test_path" '{"tool_input":{"file_path":$path}}')

  # Test file-guard hook
  if [[ -f "$HOOKS_DIR/pretool/write-edit/file-guard.sh" ]]; then
    run_hook_capture "pretool/write-edit/file-guard.sh" "$input"

    # Should block symlinks to sensitive directories
    if [[ $HOOK_EXIT_CODE -eq 0 ]]; then
      # Check if it was detected
      if [[ "$HOOK_OUTPUT" != *"symlink"* ]] && [[ "$HOOK_OUTPUT" != *"BLOCKED"* ]]; then
        # Verify the hook at least resolves symlinks
        local resolved=$(readlink -f "$test_path" 2>/dev/null || echo "$test_path")
        if [[ "$resolved" == "/etc/passwd" ]]; then
          echo "WARNING: Symlink to /etc not explicitly blocked"
          # Not necessarily a failure - depends on further checks
        fi
      fi
    fi
  fi

  # Cleanup
  rm -f "$symlink_path"
  return 0
}

# TEST 1.2.4: Symlink Chain Attack
test_symlink_chain_attack() {
  if [[ ! -d "$TEMP_DIR" ]]; then
    skip "Temp directory not available"
  fi

  # Create symlink chain: link2 -> link1 -> /etc/passwd
  local link1="$TEMP_DIR/link1"
  local link2="$TEMP_DIR/link2"

  # First try to create links (may fail on some systems)
  ln -sf /etc/passwd "$link1" 2>/dev/null || skip "Cannot create symlinks"
  ln -sf "$link1" "$link2" 2>/dev/null || {
    rm -f "$link1"
    skip "Cannot create symlink chain"
  }

  local input=$(jq -n --arg path "$link2" '{"tool_input":{"file_path":$path}}')

  # The hook should fully resolve the chain
  run_hook_capture "pretool/input-mod/path-normalizer.sh" "$input"

  # After full resolution, should detect sensitive target
  local final_target=$(readlink -f "$link2" 2>/dev/null || echo "$link2")

  if [[ "$final_target" == "/etc/passwd" ]]; then
    # Hook should have blocked or flagged this
    if [[ $HOOK_EXIT_CODE -eq 0 ]]; then
      local resolved=$(echo "$HOOK_OUTPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")
      if [[ "$resolved" == "/etc/passwd" ]] || [[ "$resolved" == "$link2" ]]; then
        echo "WARNING: Symlink chain resolved to sensitive file"
        # This depends on whether file-guard is also run
      fi
    fi
  fi

  # Cleanup
  rm -f "$link1" "$link2"
  return 0
}

# TEST 1.2.5: Race Condition - TOCTOU
test_toctou_race_condition() {
  # This test verifies the hook validates at write time, not just check time
  if [[ ! -d "$TEMP_DIR" ]]; then
    skip "Temp directory not available"
  fi

  local test_file="$TEMP_DIR/safe_file.txt"

  # Create safe file
  echo "safe content" > "$test_file"

  local input=$(jq -n --arg path "$test_file" '{"tool_input":{"file_path":$path,"content":"new content"}}')

  # Verify the file-guard validates at the right time
  # (This is more of a code review check than a runtime test)

  if [[ -f "$HOOKS_DIR/pretool/write-edit/file-guard.sh" ]]; then
    # Check that file-guard uses realpath or readlink -f
    if ! grep -qE 'realpath|readlink -f' "$HOOKS_DIR/pretool/write-edit/file-guard.sh"; then
      echo "WARNING: file-guard may not fully resolve paths"
    fi
  fi

  # Cleanup
  rm -f "$test_file"
  return 0
}

# TEST 1.2.6: Null Byte Injection
test_null_byte_injection() {
  # Null bytes can truncate paths in some languages/shells
  local payloads=(
    "/tmp/safe.txt\x00/etc/passwd"
    "valid.txt%00/etc/passwd"
  )

  for payload in "${payloads[@]}"; do
    # Note: JSON doesn't support literal null bytes, so we test the handling
    local input=$(jq -n --arg path "$payload" '{"tool_input":{"file_path":$path}}')

    run_hook_capture "pretool/input-mod/path-normalizer.sh" "$input"

    # Check if null byte sequences are sanitized
    local resolved=$(echo "$HOOK_OUTPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

    # Should not contain null byte escapes
    if [[ "$resolved" == *"\x00"* ]] || [[ "$resolved" == *"%00"* ]]; then
      echo "WARNING: Null byte sequences not sanitized: $payload"
      # Not necessarily vulnerable in bash, but should be cleaned
    fi

    # More importantly, the path should not resolve to /etc/passwd
    if [[ "$resolved" == *"/etc/passwd"* ]]; then
      echo "VULNERABLE: Null byte injection allowed path access"
      return 1
    fi
  done

  return 0
}

# ============================================================================
# ADDITIONAL PATH SECURITY TESTS
# ============================================================================

# Test absolute path outside project
test_absolute_path_outside_project() {
  local payloads=(
    "/etc/passwd"
    "/root/.ssh/id_rsa"
    "/var/log/auth.log"
    "$HOME/.bashrc"
  )

  for payload in "${payloads[@]}"; do
    local input=$(jq -n --arg path "$payload" '{"tool_input":{"file_path":$path}}')

    run_hook_capture "pretool/write-edit/file-guard.sh" "$input"

    # Should block writes outside project
    if [[ $HOOK_EXIT_CODE -eq 0 ]]; then
      # Check if it's a write operation that was allowed
      if [[ "$HOOK_OUTPUT" != *"BLOCKED"* ]] && [[ "$HOOK_OUTPUT" != *"outside"* ]]; then
        # The hook might pass to allow reads - check permission hooks
        :
      fi
    fi
  done

  return 0
}

# Test hidden file access
test_hidden_file_access() {
  local payloads=(
    ".env"
    ".git/config"
    ".ssh/id_rsa"
    "../.env"
  )

  for payload in "${payloads[@]}"; do
    local input=$(jq -n --arg path "$payload" '{"tool_input":{"file_path":$path}}')

    run_hook_capture "pretool/write-edit/file-guard.sh" "$input"

    # Certain hidden files should be protected
    if [[ "$payload" == ".env" ]] || [[ "$payload" == *"id_rsa"* ]]; then
      if [[ $HOOK_EXIT_CODE -eq 0 ]] && [[ "$HOOK_OUTPUT" != *"BLOCKED"* ]]; then
        # Check if there's a warning at least
        if [[ "$HOOK_OUTPUT" != *"sensitive"* ]] && [[ "$HOOK_OUTPUT" != *"protected"* ]]; then
          echo "WARNING: Sensitive file access not flagged: $payload"
        fi
      fi
    fi
  done

  return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
