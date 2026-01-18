#!/usr/bin/env bash
set -euo pipefail
# First Run Setup - Full setup with optional interactive wizard
# Hook: Setup (triggered by setup-check.sh)
# CC 2.1.11 Compliant
#
# Phases:
# 1. Environment detection
# 2. Dependency validation
# 3. Interactive onboarding wizard (if --interactive)
# 4. Apply configuration
# 5. Create marker file

# Check for HOOK_INPUT from parent (CC 2.1.6 format)
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
fi
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Determine plugin root
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
MARKER_FILE="${PLUGIN_ROOT}/.setup-complete"
CURRENT_VERSION="4.19.0"

# Mode: --interactive (default) or --silent (CI/CD)
MODE="${1:---interactive}"

log_hook "First-run setup starting (mode: $MODE)"

# ─────────────────────────────────────────────────────────────────────────────
# Phase 1: Environment Detection
# ─────────────────────────────────────────────────────────────────────────────

detect_environment() {
  log_hook "Phase 1: Detecting environment"

  local env_info="{}"

  # Detect Python version
  if command -v python3 >/dev/null 2>&1; then
    local py_version
    py_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    env_info=$(echo "$env_info" | jq --arg v "$py_version" '.python = $v')
    log_hook "Python: $py_version"
  fi

  # Detect Node.js version
  if command -v node >/dev/null 2>&1; then
    local node_version
    node_version=$(node --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    env_info=$(echo "$env_info" | jq --arg v "$node_version" '.nodejs = $v')
    log_hook "Node.js: $node_version"
  fi

  # Detect Git
  if command -v git >/dev/null 2>&1; then
    env_info=$(echo "$env_info" | jq '.git = true')
    log_hook "Git: available"
  fi

  # Detect Docker
  if command -v docker >/dev/null 2>&1; then
    env_info=$(echo "$env_info" | jq '.docker = true')
    log_hook "Docker: available"
  fi

  # Detect SQLite3 (for coordination)
  if command -v sqlite3 >/dev/null 2>&1; then
    env_info=$(echo "$env_info" | jq '.sqlite3 = true')
    log_hook "SQLite3: available (multi-instance coordination enabled)"
  fi

  # Detect OS
  env_info=$(echo "$env_info" | jq --arg os "$(uname -s)" '.os = $os')

  echo "$env_info"
}

# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: Dependency Validation
# ─────────────────────────────────────────────────────────────────────────────

validate_dependencies() {
  log_hook "Phase 2: Validating dependencies"

  local missing=()
  local warnings=()

  # Required: jq (JSON processing)
  if ! command -v jq >/dev/null 2>&1; then
    missing+=("jq (required for JSON processing)")
  fi

  # Required: bash 4.0+ (associative arrays)
  local bash_major
  bash_major="${BASH_VERSINFO[0]:-0}"
  if [[ "$bash_major" -lt 4 ]]; then
    missing+=("bash 4.0+ (current: $BASH_VERSION)")
  fi

  # Optional: sqlite3 (multi-instance coordination)
  if ! command -v sqlite3 >/dev/null 2>&1; then
    warnings+=("sqlite3 not found - multi-instance coordination disabled")
  fi

  # Optional: flock (file locking)
  if ! command -v flock >/dev/null 2>&1; then
    warnings+=("flock not found - using fallback file locking")
  fi

  # Optional: anthropic SDK (Memory Fabric Agent SDK for guaranteed MCP execution)
  if command -v python3 >/dev/null 2>&1; then
    if ! python3 -c "import anthropic" 2>/dev/null; then
      warnings+=("anthropic SDK not found - Memory Fabric Agent will use fallback mode")
      warnings+=("  Install with: pip install 'skillforge-claude-plugin[memory]'")
    else
      log_hook "Anthropic SDK: available (Memory Fabric Agent enabled)"
    fi
  fi

  # Report missing required dependencies
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_hook "ERROR: Missing required dependencies:"
    for dep in "${missing[@]}"; do
      log_hook "  - $dep"
    done
    return 1
  fi

  # Report warnings
  for warn in "${warnings[@]}"; do
    log_hook "WARN: $warn"
  done

  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: Configuration Selection
# ─────────────────────────────────────────────────────────────────────────────

# Preset configurations
get_preset_config() {
  local preset="$1"

  case "$preset" in
    complete)
      cat << 'EOF'
{
  "preset": "complete",
  "description": "Full AI-assisted development toolkit",
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
      ;;
    standard)
      cat << 'EOF'
{
  "preset": "standard",
  "description": "Skills and hooks without agent orchestration",
  "features": {
    "skills": true,
    "agents": false,
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
      ;;
    lite)
      cat << 'EOF'
{
  "preset": "lite",
  "description": "Essential skills for constrained environments",
  "features": {
    "skills": true,
    "agents": false,
    "hooks": true,
    "mcp": false,
    "coordination": false,
    "statusline": false
  },
  "hook_groups": {
    "safety": true,
    "quality": true,
    "productivity": false,
    "observability": false
  }
}
EOF
      ;;
    hooks-only)
      cat << 'EOF'
{
  "preset": "hooks-only",
  "description": "Safety hooks only for pure automation",
  "features": {
    "skills": false,
    "agents": false,
    "hooks": true,
    "mcp": false,
    "coordination": false,
    "statusline": false
  },
  "hook_groups": {
    "safety": true,
    "quality": false,
    "productivity": false,
    "observability": false
  }
}
EOF
      ;;
    *)
      # Default to complete
      get_preset_config "complete"
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────
# Phase 4: Apply Configuration
# ─────────────────────────────────────────────────────────────────────────────

apply_configuration() {
  local preset="$1"
  local env_info="$2"

  log_hook "Phase 4: Applying configuration (preset: $preset)"

  # Get preset config
  local config
  config=$(get_preset_config "$preset")

  # Ensure directories exist
  mkdir -p "${PLUGIN_ROOT}/.claude/defaults" 2>/dev/null || true
  mkdir -p "${PLUGIN_ROOT}/.claude/context/session" 2>/dev/null || true
  mkdir -p "${PLUGIN_ROOT}/.claude/context/knowledge" 2>/dev/null || true
  mkdir -p "${PLUGIN_ROOT}/.claude/logs" 2>/dev/null || true

  # Write config if it doesn't exist
  local config_file="${PLUGIN_ROOT}/.claude/defaults/config.json"
  if [[ ! -f "$config_file" ]]; then
    echo "$config" > "$config_file"
    log_hook "Created config file: $config_file"
  fi

  # Initialize coordination database if sqlite3 available and coordination enabled
  local coord_enabled
  coord_enabled=$(echo "$config" | jq -r '.features.coordination // false')
  if [[ "$coord_enabled" == "true" ]] && command -v sqlite3 >/dev/null 2>&1; then
    init_coordination_db 2>/dev/null || true
    log_hook "Initialized coordination database"
  fi

  # Make all hooks executable
  find "${PLUGIN_ROOT}/hooks" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
  log_hook "Made hooks executable"

  echo "$config"
}

# ─────────────────────────────────────────────────────────────────────────────
# Phase 5: Create Marker File
# ─────────────────────────────────────────────────────────────────────────────

create_marker() {
  local preset="$1"
  local env_info="$2"

  log_hook "Phase 5: Creating marker file"

  local now
  now=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')

  # Count components
  local hook_count skill_count agent_count
  hook_count=$(find "${PLUGIN_ROOT}/hooks" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
  skill_count=$(find "${PLUGIN_ROOT}/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  agent_count=$(find "${PLUGIN_ROOT}/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')

  # Create marker file
  cat > "$MARKER_FILE" << EOF
{
  "version": "$CURRENT_VERSION",
  "setup_date": "$now",
  "preset": "$preset",
  "components": {
    "hooks": { "count": $hook_count, "valid": true },
    "skills": { "count": $skill_count, "valid": true },
    "agents": { "count": $agent_count, "valid": true }
  },
  "last_health_check": "$now",
  "last_maintenance": "$now",
  "environment": $env_info,
  "user_preferences": {
    "onboarding_completed": true,
    "mcp_configured": false,
    "statusline_configured": false
  }
}
EOF

  log_hook "Marker file created: $MARKER_FILE"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Execution
# ─────────────────────────────────────────────────────────────────────────────

main() {
  # Phase 1: Environment detection
  local env_info
  env_info=$(detect_environment)

  # Phase 2: Dependency validation
  if ! validate_dependencies; then
    log_hook "ERROR: Dependency validation failed"
    CTX="SkillForge setup failed: Missing required dependencies. Install jq and ensure bash 4.0+."
    jq -nc --arg ctx "$CTX" \
      '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
    exit 1
  fi

  # Phase 3: Select preset
  local preset="complete"  # Default preset

  if [[ "$MODE" == "--interactive" ]]; then
    # For interactive mode, output a message that will prompt the user
    # The actual selection happens via additionalContext in Claude's response
    log_hook "Interactive mode - using complete preset (wizard via Claude conversation)"
    # In a real implementation, this would use additionalContext to prompt the user
    # For now, default to complete preset
  else
    # Silent mode - use default preset
    log_hook "Silent mode - using complete preset"
  fi

  # Phase 4: Apply configuration
  local config
  config=$(apply_configuration "$preset" "$env_info")

  # Phase 5: Create marker
  create_marker "$preset" "$env_info"

  # Success output
  local hook_count skill_count agent_count
  hook_count=$(find "${PLUGIN_ROOT}/hooks" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
  skill_count=$(find "${PLUGIN_ROOT}/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  agent_count=$(find "${PLUGIN_ROOT}/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')

  log_hook "Setup complete: $skill_count skills, $agent_count agents, $hook_count hooks"

  if [[ "$MODE" == "--interactive" ]]; then
    CTX="SkillForge v$CURRENT_VERSION setup complete! Loaded $skill_count skills, $agent_count agents, and $hook_count hooks. Use /skf:configure to customize settings."
  else
    CTX="SkillForge v$CURRENT_VERSION initialized (silent mode)."
  fi

  jq -nc --arg ctx "$CTX" \
    '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
}

main "$@"
exit 0
