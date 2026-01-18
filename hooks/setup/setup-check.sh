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

# Check for HOOK_INPUT from parent (CC 2.1.6 format)
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
fi
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Emergency bypass - useful for debugging setup issues
if [[ "${SKILLFORGE_SKIP_SETUP:-0}" == "1" ]]; then
  log_hook "Setup check bypassed via SKILLFORGE_SKIP_SETUP"
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

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

  # Check 2: At least 50 hooks exist (optimized - use glob instead of find)
  local hook_count=0
  shopt -s nullglob
  local hook_files=("${PLUGIN_ROOT}"/hooks/**/*.sh)
  hook_count=${#hook_files[@]}
  shopt -u nullglob
  if [[ "$hook_count" -lt 50 ]]; then
    log_hook "WARN: Only $hook_count hooks found (expected 50+)"
    ((errors++))
  fi

  # Check 3: At least 100 skills exist (optimized - use glob instead of find)
  local skill_count=0
  shopt -s nullglob
  local skill_files=("${PLUGIN_ROOT}"/skills/*/SKILL.md)
  skill_count=${#skill_files[@]}
  shopt -u nullglob
  if [[ "$skill_count" -lt 100 ]]; then
    log_hook "WARN: Only $skill_count skills found (expected 100+)"
    ((errors++))
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
    CTX="SkillForge setup not complete. Run 'claude --init' to configure the plugin."
    jq -nc --arg ctx "$CTX" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
    exit 0
  fi
fi

# Marker exists - run quick validation
log_hook "Marker file exists - running quick validation"

validation_result=0
quick_validate || validation_result=$?

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
    # Validation failed - trigger repair
    log_hook "Validation failed - triggering self-healing repair"
    if [[ -x "${SETUP_DIR}/setup-repair.sh" ]]; then
      exec "${SETUP_DIR}/setup-repair.sh"
    else
      # Fallback: continue with warning
      CTX="SkillForge setup validation failed. Some features may not work correctly."
      jq -nc --arg ctx "$CTX" \
        '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
    fi
    ;;
  2)
    # Version mismatch - run migration
    log_hook "Version mismatch - running migration"
    if [[ -x "${SETUP_DIR}/setup-maintenance.sh" ]]; then
      # Run maintenance with migration flag
      "${SETUP_DIR}/setup-maintenance.sh" --migrate
    fi

    # Update marker version
    update_marker '.version' "$CURRENT_VERSION"

    CTX="SkillForge upgraded to v$CURRENT_VERSION."
    jq -nc --arg ctx "$CTX" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
    ;;
esac

exit 0
