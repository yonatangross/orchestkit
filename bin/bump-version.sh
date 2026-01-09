#!/bin/bash
set -euo pipefail
# Version Bump Script for SkillForge Plugin
# Usage: ./bin/bump-version.sh [major|minor|patch]
# Default: patch

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Files containing version
VERSION_FILES=(
  "$PROJECT_ROOT/plugin.json"
  "$PROJECT_ROOT/.claude-plugin/plugin.json"
  "$PROJECT_ROOT/.claude-plugin/marketplace.json"
  "$PROJECT_ROOT/plugin-metadata.json"
)

# Get current version from plugin.json
get_current_version() {
  jq -r '.version' "$PROJECT_ROOT/plugin.json"
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

# Update version in all files
update_version_files() {
  local old_version="$1"
  local new_version="$2"

  for file in "${VERSION_FILES[@]}"; do
    if [[ -f "$file" ]]; then
      sed -i '' "s/\"version\": \"$old_version\"/\"version\": \"$new_version\"/g" "$file"
      echo "  Updated: $file"
    fi
  done
}

# Main
main() {
  local bump_type="${1:-patch}"
  local current_version=$(get_current_version)
  local new_version=$(bump_version "$current_version" "$bump_type")

  echo "Bumping version: $current_version -> $new_version ($bump_type)"
  echo ""

  update_version_files "$current_version" "$new_version"

  echo ""
  echo "Version bumped to $new_version"
  echo ""
  echo "Next steps:"
  echo "  1. Update CHANGELOG.md with changes"
  echo "  2. git add -A && git commit -m \"chore: bump version to $new_version\""
}

main "$@"