#!/bin/bash
set -euo pipefail
# Version Bump Script for SkillForge Plugin
# Usage: ./bin/bump-version.sh [major|minor|patch]
# Default: patch
#
# This script:
# 1. Bumps version in all config files
# 2. Updates CLAUDE.md version reference
# 3. Adds a template entry to CHANGELOG.md
# 4. Stages all changes (does NOT commit)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Files containing version
VERSION_FILES=(
  "$PROJECT_ROOT/.claude-plugin/plugin.json"
  "$PROJECT_ROOT/.claude-plugin/marketplace.json"
  "$PROJECT_ROOT/plugin-metadata.json"
)

# Get current version from .claude-plugin/plugin.json
get_current_version() {
  jq -r '.version' "$PROJECT_ROOT/.claude-plugin/plugin.json"
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

# Update version in all JSON files
update_version_files() {
  local old_version="$1"
  local new_version="$2"

  echo "Updating version files..."
  for file in "${VERSION_FILES[@]}"; do
    if [[ -f "$file" ]]; then
      sed -i '' "s/\"version\": \"$old_version\"/\"version\": \"$new_version\"/g" "$file"
      echo "  ✓ $(basename "$file")"
    fi
  done
}

# Update CLAUDE.md version references
update_claude_md() {
  local old_version="$1"
  local new_version="$2"
  local today=$(date +%Y-%m-%d)

  echo "Updating CLAUDE.md..."
  local claude_file="$PROJECT_ROOT/CLAUDE.md"

  if [[ -f "$claude_file" ]]; then
    # Update "Current Version" line
    sed -i '' "s/- \*\*Current Version\*\*: $old_version.*$/- **Current Version**: $new_version (as of $today)/g" "$claude_file"
    # Update "Last Updated" line
    sed -i '' "s/\*\*Last Updated\*\*: .*/\*\*Last Updated\*\*: $today (v$new_version)/g" "$claude_file"
    echo "  ✓ CLAUDE.md"
  fi
}

# Add changelog entry template
add_changelog_entry() {
  local new_version="$1"
  local bump_type="$2"
  local today=$(date +%Y-%m-%d)

  echo "Adding CHANGELOG.md entry..."
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

  # Insert after the header (line 7, after the semver link)
  # Find the line number of the first ## entry
  local first_entry_line=$(grep -n "^## \[" "$changelog_file" | head -1 | cut -d: -f1)

  if [[ -n "$first_entry_line" ]]; then
    # Create temp file with new entry inserted
    head -n $((first_entry_line - 1)) "$changelog_file" > "$changelog_file.tmp"
    echo "$new_entry" >> "$changelog_file.tmp"
    tail -n +$first_entry_line "$changelog_file" >> "$changelog_file.tmp"
    mv "$changelog_file.tmp" "$changelog_file"
    echo "  ✓ CHANGELOG.md (template added)"
  else
    echo "  ⚠ Could not find insertion point in CHANGELOG.md"
  fi
}

# Stage all changes
stage_changes() {
  echo "Staging changes..."
  cd "$PROJECT_ROOT"
  git add CLAUDE.md CHANGELOG.md 2>/dev/null || true
  git add .claude-plugin/plugin.json .claude-plugin/marketplace.json 2>/dev/null || true
  git add plugin-metadata.json 2>/dev/null || true
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

  update_version_files "$current_version" "$new_version"
  update_claude_md "$current_version" "$new_version"
  add_changelog_entry "$new_version" "$bump_type"
  stage_changes

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Done! Version bumped to $new_version"
  echo "╠════════════════════════════════════════════════════════════╣"
  echo "║  Next steps:"
  echo "║  1. Edit CHANGELOG.md - replace TODO with actual changes"
  echo "║  2. git add -A && git commit -m \"chore: bump to $new_version\""
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
}

main "$@"