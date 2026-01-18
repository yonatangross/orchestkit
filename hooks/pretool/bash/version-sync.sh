#!/bin/bash
set -euo pipefail
# Version Sync Hook
# Auto-syncs all version files from single source of truth before commit/push
#
# Source of truth: .claude-plugin/plugin.json
# Auto-synced files:
#   - .claude-plugin/marketplace.json
#   - pyproject.toml
#   - CLAUDE.md (version reference)

INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only trigger on git commit or git push
if [[ ! "$COMMAND" =~ ^git\ (commit|push) ]]; then
  output_silent_success
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Source of truth
PLUGIN_JSON=".claude-plugin/plugin.json"
if [[ ! -f "$PLUGIN_JSON" ]]; then
  output_silent_success
  exit 0
fi

# Get the authoritative version
VERSION=$(jq -r '.version // empty' "$PLUGIN_JSON" 2>/dev/null || echo "")
if [[ -z "$VERSION" ]]; then
  output_silent_success
  exit 0
fi

SYNCED_FILES=()
TODAY=$(date +%Y-%m-%d)

# Sync marketplace.json
MARKETPLACE=".claude-plugin/marketplace.json"
if [[ -f "$MARKETPLACE" ]]; then
  CURRENT=$(jq -r '.version // empty' "$MARKETPLACE" 2>/dev/null || echo "")
  if [[ "$CURRENT" != "$VERSION" ]]; then
    jq --arg v "$VERSION" '.version = $v | .plugins[0].version = $v' "$MARKETPLACE" > "$MARKETPLACE.tmp"
    mv "$MARKETPLACE.tmp" "$MARKETPLACE"
    SYNCED_FILES+=("marketplace.json")
  fi
fi

# Sync pyproject.toml
PYPROJECT="pyproject.toml"
if [[ -f "$PYPROJECT" ]]; then
  CURRENT=$(grep -E '^version\s*=' "$PYPROJECT" 2>/dev/null | head -1 | sed -E 's/.*"([^"]*)".*/\1/' || echo "")
  if [[ "$CURRENT" != "$VERSION" ]]; then
    sed -i '' -E "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" "$PYPROJECT"
    SYNCED_FILES+=("pyproject.toml")
  fi
fi

# Sync CLAUDE.md version reference
CLAUDE_MD="CLAUDE.md"
if [[ -f "$CLAUDE_MD" ]]; then
  # Update "Current Version" line
  if grep -q "Current Version" "$CLAUDE_MD"; then
    CURRENT=$(grep -E '\*\*Current Version\*\*:' "$CLAUDE_MD" | sed -E 's/.*: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/' || echo "")
    if [[ "$CURRENT" != "$VERSION" ]]; then
      sed -i '' -E "s/(\*\*Current Version\*\*): [0-9]+\.[0-9]+\.[0-9]+/\1: $VERSION/" "$CLAUDE_MD"
      SYNCED_FILES+=("CLAUDE.md")
    fi
  fi
fi

# If files were synced, stage them and notify
if [[ ${#SYNCED_FILES[@]} -gt 0 ]]; then
  git add "${SYNCED_FILES[@]}" 2>/dev/null || true

  CONTEXT="Auto-synced versions to v$VERSION: ${SYNCED_FILES[*]}"
  log_permission_feedback "allow" "version-sync: synced ${#SYNCED_FILES[@]} files to v$VERSION"
  output_allow_with_context "$CONTEXT"
  exit 0
fi

# All in sync
output_silent_success
exit 0
