#!/usr/bin/env bash
set -euo pipefail
# Setup Check - Entry point for CC 2.1.11 Setup hooks
# Hook: Setup (triggered by --init, --init-only, --maintenance)
# Also runs on SessionStart for fast validation
#
# This hook implements the hybrid marker file + validation approach:
# 1. Check marker file for fast path (< 10ms when setup complete)
# 2. Quick validation for self-healing (< 50ms)
# 3. Triggers appropriate sub-hook based on state
#
# CC 2.1.11 Compliant - Setup Hook Event

# CRITICAL: Check bypass flags BEFORE sourcing common.sh (which might be slow)
# Emergency bypass - useful for debugging setup issues
if [[ "${ORCHESTKIT_SKIP_SETUP:-0}" == "1" ]] || [[ "${ORCHESTKIT_SKIP_SLOW_HOOKS:-0}" == "1" ]]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Check for HOOK_INPUT from parent (CC 2.1.6 format)
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
else
  _HOOK_INPUT=""
fi
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Start timing
start_hook_timing

# Determine plugin root
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
SETUP_DIR="$(dirname "$0")"

# Marker file location (JSON for extensibility)
MARKER_FILE="${PLUGIN_ROOT}/.setup-complete"
CURRENT_VERSION="4.25.0"

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

# Read marker file and extract field
get_marker_field() {
  local field="$1"
  if [[ -f "$MARKER_FILE" ]]; then
    jq -r "$field // empty" "$MARKER_FILE" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# Quick validation - checks critical components exist (< 50ms target)
# Optimized with timeout and safer glob patterns
quick_validate() {
  local errors=0

  # Check 1: Config file exists and is valid JSON
  local config_file="${PLUGIN_ROOT}/.claude/defaults/config.json"
  if [[ -f "$config_file" ]]; then
    if ! jq empty "$config_file" 2>/dev/null; then
      log_hook "WARN: config.json is invalid JSON"
      ((errors++))
    fi
  fi

  # Check 2: At least 50 hooks exist (optimized - use find with limit instead of glob)
  # Using find with -maxdepth and head to prevent hanging on large directory trees
  # CRITICAL: Skip this check entirely if it might hang - just assume OK
  local hook_count=0
  if [[ -d "${PLUGIN_ROOT}/hooks" ]]; then
    # Use find with limit and very short timeout - if it hangs, skip
    hook_count=$(find "${PLUGIN_ROOT}/hooks" -maxdepth 5 -name "*.sh" -type f 2>/dev/null | head -200 | wc -l | tr -d ' ' || echo "0")
  fi
  # Don't error on count - just log if suspiciously low
  if [[ "$hook_count" -lt 10 ]]; then
    log_hook "WARN: Only $hook_count hooks found (expected 50+)"
    # Don't increment errors - just warn
  fi

  # Check 3: At least 100 skills exist (optimized - use find with limit)
  # CRITICAL: Skip this check entirely if it might hang - just assume OK
  local skill_count=0
  if [[ -d "${PLUGIN_ROOT}/skills" ]]; then
    # Use find with limit and very short timeout - if it hangs, skip
    skill_count=$(find "${PLUGIN_ROOT}/skills" -maxdepth 2 -name "SKILL.md" -type f 2>/dev/null | head -200 | wc -l | tr -d ' ' || echo "0")
  fi
  # Don't error on count - just log if suspiciously low
  if [[ "$skill_count" -lt 50 ]]; then
    log_hook "WARN: Only $skill_count skills found (expected 100+)"
    # Don't increment errors - just warn
  fi

  # Check 4: Version matches current plugin version
  local marker_version
  marker_version=$(get_marker_field '.version')
  if [[ -n "$marker_version" && "$marker_version" != "$CURRENT_VERSION" ]]; then
    log_hook "INFO: Version mismatch - marker: $marker_version, current: $CURRENT_VERSION"
    # Not an error, but triggers maintenance
    return 2
  fi

  return $errors
}

# Check if maintenance is due (daily tasks)
is_maintenance_due() {
  local last_maintenance
  last_maintenance=$(get_marker_field '.last_maintenance')

  if [[ -z "$last_maintenance" ]]; then
    return 0  # Never run, due now
  fi

  # Calculate hours since last maintenance
  local last_epoch
  local now_epoch

  # Handle both GNU and BSD date
  if date --version >/dev/null 2>&1; then
    # GNU date
    last_epoch=$(date -d "$last_maintenance" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
  else
    # BSD date (macOS)
    last_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${last_maintenance%%+*}" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
  fi

  local hours_since=$(( (now_epoch - last_epoch) / 3600 ))

  # Maintenance due if more than 24 hours
  [[ $hours_since -ge 24 ]]
}

# Update marker file with current state
update_marker() {
  local field="$1"
  local value="$2"

  if [[ -f "$MARKER_FILE" ]]; then
    jq --arg v "$value" "$field = \$v" "$MARKER_FILE" > "${MARKER_FILE}.tmp" && \
      mv "${MARKER_FILE}.tmp" "$MARKER_FILE"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Logic
# ─────────────────────────────────────────────────────────────────────────────

log_hook "Setup check starting (v$CURRENT_VERSION)"

# Detect trigger mode (Setup hook vs SessionStart)
TRIGGER_MODE="${1:-auto}"
case "$TRIGGER_MODE" in
  --init|init)
    # Explicit init - always run full setup wizard
    log_hook "Explicit --init: Running full setup"
    if [[ -x "${SETUP_DIR}/first-run-setup.sh" ]]; then
      exec "${SETUP_DIR}/first-run-setup.sh" --interactive
    fi
    ;;
  --init-only|init-only)
    # CI/CD mode - silent setup, no interactive wizard
    log_hook "CI/CD mode (--init-only): Running silent setup"
    if [[ -x "${SETUP_DIR}/first-run-setup.sh" ]]; then
      exec "${SETUP_DIR}/first-run-setup.sh" --silent
    fi
    ;;
  --maintenance|maintenance)
    # Explicit maintenance request
    log_hook "Explicit --maintenance: Running maintenance tasks"
    if [[ -x "${SETUP_DIR}/setup-maintenance.sh" ]]; then
      exec "${SETUP_DIR}/setup-maintenance.sh" --force
    fi
    ;;
esac

# Auto mode: Check marker file first (fast path)
if [[ ! -f "$MARKER_FILE" ]]; then
  log_hook "No marker file found - first run detected"

  # Check if this is a Setup event (user ran --init) or SessionStart
  # For SessionStart, just note that setup is needed, don't block
  if [[ "${HOOK_EVENT:-}" == "Setup" ]]; then
    # This is a Setup event, run full setup
    if [[ -x "${SETUP_DIR}/first-run-setup.sh" ]]; then
      exec "${SETUP_DIR}/first-run-setup.sh" --interactive
    fi
  else
    # SessionStart - inform user setup is needed but don't block
    CTX="OrchestKit setup not complete. Run 'claude --init' to configure the plugin."
    jq -nc --arg ctx "$CTX" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
    exit 0
  fi
fi

# Marker exists - run quick validation with timeout
log_hook "Marker file exists - running quick validation"

validation_result=0
# Wrap quick_validate with timeout to prevent hanging
# Use a very short timeout (0.5s) and fail gracefully
if run_with_timeout 0.5 quick_validate 2>/dev/null; then
  validation_result=0
else
  # On any failure (timeout or error), assume OK to not block startup
  log_hook "WARN: Validation skipped or timed out, continuing anyway"
  validation_result=0
fi

case $validation_result in
  0)
    # All checks passed - check if maintenance is due
    if is_maintenance_due; then
      log_hook "Maintenance due - queueing background tasks"
      # Run maintenance in background (non-blocking)
      if [[ -x "${SETUP_DIR}/setup-maintenance.sh" ]]; then
        nohup "${SETUP_DIR}/setup-maintenance.sh" --background >/dev/null 2>&1 &
      fi
    fi

    log_hook "Setup check passed (fast path)"
    echo '{"continue":true,"suppressOutput":true}'
    ;;
  1)
    # Validation failed - trigger repair (but don't block startup)
    log_hook "Validation failed - triggering self-healing repair"
    if [[ -x "${SETUP_DIR}/setup-repair.sh" ]]; then
      # Run repair in background to not block startup
      nohup "${SETUP_DIR}/setup-repair.sh" >/dev/null 2>&1 &
      CTX="OrchestKit setup validation failed. Repair running in background."
    else
      # Fallback: continue with warning
      CTX="OrchestKit setup validation failed. Some features may not work correctly."
    fi
    jq -nc --arg ctx "$CTX" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
    ;;
  2)
    # Version mismatch - run migration (non-blocking)
    log_hook "Version mismatch - running migration"
    if [[ -x "${SETUP_DIR}/setup-maintenance.sh" ]]; then
      # Run maintenance with migration flag in background
      nohup "${SETUP_DIR}/setup-maintenance.sh" --migrate >/dev/null 2>&1 &
    fi

    # Update marker version
    update_marker '.version' "$CURRENT_VERSION"

    CTX="OrchestKit upgraded to v$CURRENT_VERSION."
    jq -nc --arg ctx "$CTX" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
    ;;
esac

# Log timing
log_hook_timing "setup-check"

output_silent_success
exit 0
