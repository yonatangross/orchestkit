#!/bin/bash
set -euo pipefail
# Version Bump Script for OrchestKit Plugin
# Usage: ./bin/bump-version.sh [major|minor|patch]
# Default: patch
#
# This script:
# 1. Bumps version in plugin.json (source of truth)
# 2. Syncs to all other version files
# 3. Adds a template entry to CHANGELOG.md
# 4. Stages all changes (does NOT commit)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source of truth
PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"

# Get current version
get_current_version() {
  jq -r '.version' "$PLUGIN_JSON"
}

# Bump version based on type
bump_version() {
  local version="$1"
  local bump_type="${2:-patch}"

  IFS='.' read -r major minor patch <<< "$version"

  case "$bump_type" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    *)
      echo "Unknown bump type: $bump_type (use major, minor, or patch)"
      exit 1
      ;;
  esac

  echo "$major.$minor.$patch"
}

# Update plugin.json (source of truth)
update_plugin_json() {
  local new_version="$1"
  jq --arg v "$new_version" '.version = $v' "$PLUGIN_JSON" > "$PLUGIN_JSON.tmp"
  mv "$PLUGIN_JSON.tmp" "$PLUGIN_JSON"
  echo "  ✓ plugin.json (source of truth)"
}

# Sync all other version files
sync_versions() {
  local version="$1"
  local today=$(date +%Y-%m-%d)

  echo "Syncing version files..."

  # marketplace.json
  local marketplace="$PROJECT_ROOT/.claude-plugin/marketplace.json"
  if [[ -f "$marketplace" ]]; then
    jq --arg v "$version" '.version = $v | .plugins[0].version = $v' "$marketplace" > "$marketplace.tmp"
    mv "$marketplace.tmp" "$marketplace"
    echo "  ✓ marketplace.json"
  fi

  # pyproject.toml
  local pyproject="$PROJECT_ROOT/pyproject.toml"
  if [[ -f "$pyproject" ]]; then
    sed -i '' -E "s/^version = \"[^\"]*\"/version = \"$version\"/" "$pyproject"
    echo "  ✓ pyproject.toml"
  fi

  # CLAUDE.md
  local claude_md="$PROJECT_ROOT/CLAUDE.md"
  if [[ -f "$claude_md" ]]; then
    sed -i '' -E "s/(\*\*Current Version\*\*): [0-9]+\.[0-9]+\.[0-9]+/\1: $version/" "$claude_md"
    sed -i '' -E "s/(\*\*Last Updated\*\*): [0-9]{4}-[0-9]{2}-[0-9]{2}/\1: $today/" "$claude_md"
    echo "  ✓ CLAUDE.md"
  fi
}

# Add changelog entry template
add_changelog_entry() {
  local new_version="$1"
  local bump_type="$2"
  local today=$(date +%Y-%m-%d)
  local changelog_file="$PROJECT_ROOT/CHANGELOG.md"

  if [[ ! -f "$changelog_file" ]]; then
    echo "  ⚠ CHANGELOG.md not found, skipping"
    return
  fi

  # Check if entry already exists
  if grep -q "^\## \[$new_version\]" "$changelog_file"; then
    echo "  ⚠ Entry for $new_version already exists, skipping"
    return
  fi

  # Determine section based on bump type
  local section_type
  case "$bump_type" in
    major) section_type="Changed" ;;
    minor) section_type="Added" ;;
    patch) section_type="Fixed" ;;
  esac

  # Create the new entry
  local new_entry="## [$new_version] - $today

### $section_type

- TODO: Describe your changes here

---

"

  # Insert after the header
  local first_entry_line=$(grep -n "^## \[" "$changelog_file" | head -1 | cut -d: -f1)

  if [[ -n "$first_entry_line" ]]; then
    head -n $((first_entry_line - 1)) "$changelog_file" > "$changelog_file.tmp"
    echo "$new_entry" >> "$changelog_file.tmp"
    tail -n +$first_entry_line "$changelog_file" >> "$changelog_file.tmp"
    mv "$changelog_file.tmp" "$changelog_file"
    echo "  ✓ CHANGELOG.md (template added)"
  fi
}

# Stage all changes
stage_changes() {
  echo "Staging changes..."
  cd "$PROJECT_ROOT"
  git add .claude-plugin/plugin.json .claude-plugin/marketplace.json 2>/dev/null || true
  git add pyproject.toml CLAUDE.md CHANGELOG.md 2>/dev/null || true
  echo "  ✓ Changes staged"
}

# Main
main() {
  local bump_type="${1:-patch}"
  local current_version=$(get_current_version)
  local new_version=$(bump_version "$current_version" "$bump_type")

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Version Bump: $current_version → $new_version ($bump_type)"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  echo "Updating source of truth..."
  update_plugin_json "$new_version"

  sync_versions "$new_version"
  add_changelog_entry "$new_version" "$bump_type"
  stage_changes

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Done! Version bumped to $new_version"
  echo "╠════════════════════════════════════════════════════════════╣"
  echo "║  Next steps:"
  echo "║  1. Edit CHANGELOG.md - replace TODO with actual changes"
  echo "║  2. git commit -m \"chore: bump to v$new_version\""
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
}

main "$@"
