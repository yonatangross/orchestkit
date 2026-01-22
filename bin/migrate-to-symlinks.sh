#!/usr/bin/env bash
# migrate-to-symlinks.sh - Convert plugin copies to symlinks (CC 2026 Standard)
#
# This script converts duplicate skills/agents/commands in plugins to symlinks
# pointing to the root source directories, following Claude Code 2026 standards.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Counters
SKILLS_CONVERTED=0
AGENTS_CONVERTED=0
COMMANDS_CONVERTED=0
SKIPPED=0

# Convert a single item to symlink
# Args: $1=plugin_dir, $2=component_type (skills|agents|commands), $3=item_name
convert_to_symlink() {
  local plugin_dir="$1"
  local component_type="$2"
  local item_name="$3"
  local plugin_path="plugins/${plugin_dir}/${component_type}/${item_name}"
  local root_path="${component_type}/${item_name}"

  # Calculate relative path from plugin component dir to root component dir
  # From plugins/ork-xxx/skills/ to skills/ is ../../../skills/
  local relative_path="../../../${component_type}/${item_name}"

  # Check if root source exists
  if [[ ! -e "$root_path" ]]; then
    log_warn "Root source not found: $root_path (skipping)"
    ((SKIPPED++))
    return 0
  fi

  # Check if already a symlink
  if [[ -L "$plugin_path" ]]; then
    log_info "Already symlink: $plugin_path"
    return 0
  fi

  # Check if plugin copy exists
  if [[ ! -e "$plugin_path" ]]; then
    log_warn "Plugin path not found: $plugin_path (skipping)"
    ((SKIPPED++))
    return 0
  fi

  # Remove the copy and create symlink
  rm -rf "$plugin_path"
  ln -s "$relative_path" "$plugin_path"

  log_success "Converted: $plugin_path -> $relative_path"
  return 0
}

# Process all plugins
process_plugins() {
  log_info "Starting migration to symlinks..."
  echo ""

  # Find all plugin directories
  for plugin_dir in plugins/ork-*/; do
    local plugin_name=$(basename "$plugin_dir")
    log_info "Processing plugin: $plugin_name"

    # Process skills
    if [[ -d "${plugin_dir}skills" ]]; then
      for skill_dir in "${plugin_dir}skills"/*/; do
        if [[ -d "$skill_dir" ]]; then
          local skill_name=$(basename "$skill_dir")
          convert_to_symlink "$plugin_name" "skills" "$skill_name"
          ((SKILLS_CONVERTED++)) || true
        fi
      done
    fi

    # Process agents
    if [[ -d "${plugin_dir}agents" ]]; then
      for agent_file in "${plugin_dir}agents"/*.md; do
        if [[ -f "$agent_file" ]]; then
          local agent_name=$(basename "$agent_file")
          convert_to_symlink "$plugin_name" "agents" "$agent_name"
          ((AGENTS_CONVERTED++)) || true
        fi
      done
    fi

    # Process commands
    if [[ -d "${plugin_dir}commands" ]]; then
      for command_file in "${plugin_dir}commands"/*.md; do
        if [[ -f "$command_file" ]]; then
          local command_name=$(basename "$command_file")
          convert_to_symlink "$plugin_name" "commands" "$command_name"
          ((COMMANDS_CONVERTED++)) || true
        fi
      done
    fi

    echo ""
  done
}

# Verify symlinks are valid
verify_symlinks() {
  log_info "Verifying symlinks..."
  local broken=0

  # Find all symlinks in plugins and verify they resolve
  while IFS= read -r symlink; do
    if [[ ! -e "$symlink" ]]; then
      log_error "Broken symlink: $symlink -> $(readlink "$symlink")"
      ((broken++))
    fi
  done < <(find plugins -type l 2>/dev/null)

  if [[ $broken -gt 0 ]]; then
    log_error "$broken broken symlinks found!"
    return 1
  fi

  log_success "All symlinks are valid"
  return 0
}

# Main
main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║     OrchestKit: Migrate to Symlinks (CC 2026 Standard)     ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  process_plugins

  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "                      MIGRATION SUMMARY"
  echo "════════════════════════════════════════════════════════════"
  echo "  Skills converted:   $SKILLS_CONVERTED"
  echo "  Agents converted:   $AGENTS_CONVERTED"
  echo "  Commands converted: $COMMANDS_CONVERTED"
  echo "  Skipped:            $SKIPPED"
  echo "════════════════════════════════════════════════════════════"
  echo ""

  verify_symlinks

  echo ""
  log_success "Migration complete!"
}

main "$@"
