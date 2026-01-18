#!/usr/bin/env bash
set -euo pipefail
# Setup Repair - Self-healing for broken installations
#
# INTERNAL HOOK: Called by setup-check.sh when validation fails.
# NOT registered in plugin.json (by design - it's a sub-hook).
#
# CC 2.1.11 Compliant
#
# Repair Actions:
# - Restore missing/corrupt config files
# - Fix hook permissions
# - Regenerate marker file
# - Run migrations for version mismatches

# Check for HOOK_INPUT from parent (CC 2.1.6 format)
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
fi
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Determine plugin root
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
MARKER_FILE="${PLUGIN_ROOT}/.setup-complete"
CURRENT_VERSION="4.25.0"

log_hook "Setup repair starting"

# Track repairs made
REPAIRS_MADE=()
REPAIRS_FAILED=()
NOTIFY_USER=false

# ─────────────────────────────────────────────────────────────────────────────
# Repair Functions
# ─────────────────────────────────────────────────────────────────────────────

# Repair: Restore config.json
repair_config() {
  local config_file="${PLUGIN_ROOT}/.claude/defaults/config.json"
  local config_dir
  config_dir=$(dirname "$config_file")

  # Ensure directory exists
  mkdir -p "$config_dir" 2>/dev/null || true

  # Check if config exists and is valid
  if [[ -f "$config_file" ]]; then
    if jq empty "$config_file" 2>/dev/null; then
      return 0  # Config is valid
    else
      # Backup corrupt config
      local backup="${config_file}.corrupt.$(date +%Y%m%d-%H%M%S)"
      mv "$config_file" "$backup" 2>/dev/null || true
      log_hook "Backed up corrupt config to $backup"
      NOTIFY_USER=true
    fi
  fi

  # Restore default config
  cat > "$config_file" << 'EOF'
{
  "preset": "complete",
  "description": "Full AI-assisted development toolkit (restored by repair)",
  "features": {
    "skills": true,
    "agents": true,
    "hooks": true,
    "mcp": true,
    "coordination": true,
    "statusline": true
  },
  "hook_groups": {
    "safety": true,
    "quality": true,
    "productivity": true,
    "observability": true
  }
}
EOF

  REPAIRS_MADE+=("config.json restored")
  log_hook "Restored default config.json"
}

# Repair: Fix hook permissions
repair_hook_permissions() {
  local fixed=0

  # Find hooks that are not executable
  while IFS= read -r hook; do
    if [[ ! -x "$hook" ]]; then
      chmod +x "$hook" 2>/dev/null && ((fixed++)) || true
    fi
  done < <(find "${PLUGIN_ROOT}/hooks" -name "*.sh" -type f 2>/dev/null)

  if [[ $fixed -gt 0 ]]; then
    REPAIRS_MADE+=("$fixed hook permissions fixed")
    log_hook "Fixed permissions on $fixed hooks"
  fi
}

# Repair: Ensure required directories exist
repair_directories() {
  local dirs_created=0

  local required_dirs=(
    "${PLUGIN_ROOT}/.claude/defaults"
    "${PLUGIN_ROOT}/.claude/context/session"
    "${PLUGIN_ROOT}/.claude/context/knowledge"
    "${PLUGIN_ROOT}/.claude/logs"
    "${PLUGIN_ROOT}/.claude/coordination"
  )

  for dir in "${required_dirs[@]}"; do
    if [[ ! -d "$dir" ]]; then
      mkdir -p "$dir" 2>/dev/null && ((dirs_created++)) || true
    fi
  done

  if [[ $dirs_created -gt 0 ]]; then
    REPAIRS_MADE+=("$dirs_created directories created")
    log_hook "Created $dirs_created missing directories"
  fi
}

# Repair: Regenerate marker file
repair_marker() {
  local now
  now=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')

  # Count components
  local hook_count skill_count agent_count
  hook_count=$(find "${PLUGIN_ROOT}/hooks" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
  skill_count=$(find "${PLUGIN_ROOT}/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  agent_count=$(find "${PLUGIN_ROOT}/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')

  # Detect OS
  local os
  os=$(uname -s)

  cat > "$MARKER_FILE" << EOF
{
  "version": "$CURRENT_VERSION",
  "setup_date": "$now",
  "preset": "complete",
  "repaired_at": "$now",
  "components": {
    "hooks": { "count": $hook_count, "valid": true },
    "skills": { "count": $skill_count, "valid": true },
    "agents": { "count": $agent_count, "valid": true }
  },
  "last_health_check": "$now",
  "last_maintenance": "$now",
  "environment": {
    "os": "$os"
  },
  "user_preferences": {
    "onboarding_completed": true,
    "mcp_configured": false,
    "statusline_configured": false
  }
}
EOF

  REPAIRS_MADE+=("marker file regenerated")
  log_hook "Regenerated marker file"
}

# Repair: Check for critical missing components
check_critical_components() {
  local critical_missing=0

  # Check for minimum number of hooks
  local hook_count
  hook_count=$(find "${PLUGIN_ROOT}/hooks" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$hook_count" -lt 20 ]]; then
    log_hook "CRITICAL: Only $hook_count hooks found (expected 50+)"
    ((critical_missing++))
  fi

  # Check for minimum number of skills
  local skill_count
  skill_count=$(find "${PLUGIN_ROOT}/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$skill_count" -lt 50 ]]; then
    log_hook "CRITICAL: Only $skill_count skills found (expected 100+)"
    ((critical_missing++))
  fi

  # Check for common.sh library
  if [[ ! -f "${PLUGIN_ROOT}/hooks/_lib/common.sh" ]]; then
    log_hook "CRITICAL: hooks/_lib/common.sh missing"
    ((critical_missing++))
  fi

  # If too many critical components missing, suggest reinstall
  if [[ $critical_missing -ge 2 ]]; then
    REPAIRS_FAILED+=("Multiple critical components missing - reinstall recommended")
    NOTIFY_USER=true
    return 1
  fi

  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Execution
# ─────────────────────────────────────────────────────────────────────────────

main() {
  # Run repairs in order of importance
  repair_directories
  repair_config
  repair_hook_permissions

  # Check for critical missing components
  if ! check_critical_components; then
    # Critical components missing - can't fully repair
    log_hook "WARN: Critical components missing, repair incomplete"
  fi

  # Regenerate marker file last (after other repairs)
  repair_marker

  # Build output message
  local repair_summary=""
  if [[ ${#REPAIRS_MADE[@]} -gt 0 ]]; then
    repair_summary="Repairs: ${REPAIRS_MADE[*]}"
  fi

  if [[ ${#REPAIRS_FAILED[@]} -gt 0 ]]; then
    repair_summary="${repair_summary:+$repair_summary. }Issues: ${REPAIRS_FAILED[*]}"
    NOTIFY_USER=true
  fi

  log_hook "Repair complete: ${#REPAIRS_MADE[@]} repairs made, ${#REPAIRS_FAILED[@]} issues"

  # Output result
  if [[ "$NOTIFY_USER" == "true" ]]; then
    local ctx="SkillForge auto-repair: $repair_summary"
    jq -nc --arg ctx "$ctx" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
  else
    # Silent repair - no notification needed
    echo '{"continue":true,"suppressOutput":true}'
  fi
}

main "$@"
exit 0
