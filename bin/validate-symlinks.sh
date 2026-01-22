#!/usr/bin/env bash
# validate-symlinks.sh - Validate plugin symlinks (CC 2026 Standard)
#
# This script validates that all symlinks in plugins are valid and point
# to existing source files in root directories.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0
VALID=0

log_error() { echo -e "${RED}[ERROR]${NC} $1"; ((ERRORS++)) || true; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARNINGS++)) || true; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; ((VALID++)) || true; }

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        OrchestKit: Symlink Validation (CC 2026)            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Find all symlinks in plugins directory
echo "Checking symlinks in plugins/..."
echo ""

while IFS= read -r symlink; do
  target=$(readlink "$symlink")

  # Check if symlink resolves to existing file/directory
  if [[ -e "$symlink" ]]; then
    log_ok "$symlink -> $target"
  else
    log_error "Broken symlink: $symlink -> $target"
  fi
done < <(find plugins -type l 2>/dev/null)

echo ""

# Verify skills are symlinks (not copies)
echo "Verifying skills are symlinks..."
echo ""

skill_copies=0
for plugin_dir in plugins/ork-*/; do
  if [[ -d "${plugin_dir}skills" ]]; then
    for skill in "${plugin_dir}skills"/*/; do
      if [[ -d "$skill" && ! -L "${skill%/}" ]]; then
        skill_name=$(basename "$skill")
        log_warn "Skill is a copy, not symlink: ${plugin_dir}skills/$skill_name"
        ((skill_copies++)) || true
      fi
    done
  fi
done

if [[ $skill_copies -eq 0 ]]; then
  log_ok "All skills are symlinks"
fi

echo ""

# Verify agents are symlinks
echo "Verifying agents are symlinks..."
echo ""

agent_copies=0
for plugin_dir in plugins/ork-*/; do
  if [[ -d "${plugin_dir}agents" ]]; then
    for agent in "${plugin_dir}agents"/*.md; do
      if [[ -f "$agent" && ! -L "$agent" ]]; then
        agent_name=$(basename "$agent")
        log_warn "Agent is a copy, not symlink: ${plugin_dir}agents/$agent_name"
        ((agent_copies++)) || true
      fi
    done
  fi
done

if [[ $agent_copies -eq 0 ]]; then
  log_ok "All agents are symlinks"
fi

echo ""

# Verify commands are symlinks
echo "Verifying commands are symlinks..."
echo ""

command_copies=0
for plugin_dir in plugins/ork-*/; do
  if [[ -d "${plugin_dir}commands" ]]; then
    for cmd in "${plugin_dir}commands"/*.md; do
      if [[ -f "$cmd" && ! -L "$cmd" ]]; then
        cmd_name=$(basename "$cmd")
        log_warn "Command is a copy, not symlink: ${plugin_dir}commands/$cmd_name"
        ((command_copies++)) || true
      fi
    done
  fi
done

if [[ $command_copies -eq 0 ]]; then
  log_ok "All commands are symlinks"
fi

echo ""

# Verify shared/ symlinks exist in plugins with hooks
echo "Verifying shared/ symlinks in hook plugins..."
echo ""

for plugin in ork-core ork-memory ork-context; do
  if [[ -L "plugins/$plugin/shared" ]]; then
    if [[ -e "plugins/$plugin/shared" ]]; then
      log_ok "plugins/$plugin/shared -> $(readlink "plugins/$plugin/shared")"
    else
      log_error "Broken shared symlink: plugins/$plugin/shared"
    fi
  else
    log_warn "Missing shared symlink: plugins/$plugin/shared"
  fi
done

echo ""

# Verify hooks/hooks.json exists for plugins with scripts/
echo "Verifying hooks/hooks.json for plugins with scripts..."
echo ""

for plugin_dir in plugins/ork-*/; do
  if [[ -d "${plugin_dir}scripts" ]]; then
    plugin_name=$(basename "$plugin_dir")
    if [[ -f "${plugin_dir}hooks/hooks.json" ]]; then
      log_ok "$plugin_name has hooks/hooks.json"
    else
      log_warn "$plugin_name has scripts/ but no hooks/hooks.json"
    fi
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "                    VALIDATION SUMMARY"
echo "════════════════════════════════════════════════════════════"
echo "  Valid:     $VALID"
echo "  Warnings:  $WARNINGS"
echo "  Errors:    $ERRORS"
echo "════════════════════════════════════════════════════════════"
echo ""

if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}VALIDATION FAILED${NC}"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}VALIDATION PASSED WITH WARNINGS${NC}"
  exit 0
else
  echo -e "${GREEN}VALIDATION PASSED${NC}"
  exit 0
fi
