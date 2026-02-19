#!/bin/bash
set -euo pipefail
# Release Script for OrchestKit Plugin
# Usage: ./bin/create-release.sh [--dry-run]
#
# This script:
# 1. Reads version from plugin.json (source of truth)
# 2. Extracts changelog notes for that version
# 3. Creates a git tag v{version} if it doesn't exist
# 4. Creates a GitHub Release via gh CLI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source of truth
PLUGIN_JSON="$PROJECT_ROOT/plugins/ork/.claude-plugin/plugin.json"
CHANGELOG="$PROJECT_ROOT/CHANGELOG.md"

DRY_RUN=false

usage() {
  echo "Usage: $0 [--dry-run]"
  echo ""
  echo "Creates a git tag and GitHub Release for the current version."
  echo ""
  echo "Options:"
  echo "  --dry-run    Print what would be done without executing"
  echo "  --help       Show this help message"
  exit 0
}

# Parse args
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $arg"; usage ;;
  esac
done

# Get current version from plugin.json
get_version() {
  if [[ ! -f "$PLUGIN_JSON" ]]; then
    echo "ERROR: plugin.json not found at $PLUGIN_JSON" >&2
    exit 1
  fi
  jq -r '.version' "$PLUGIN_JSON"
}

# Extract changelog body for a given version
# Returns everything between ## [version] and the next ## [
extract_changelog() {
  local version="$1"
  local in_section=false
  local body=""

  while IFS= read -r line; do
    if [[ "$line" =~ ^##\ \[$version\] ]]; then
      in_section=true
      continue
    fi
    if $in_section && [[ "$line" =~ ^##\ \[ ]]; then
      break
    fi
    if $in_section; then
      body+="$line"$'\n'
    fi
  done < "$CHANGELOG"

  # Trim leading/trailing blank lines and trailing ---
  echo "$body" | sed '/^---$/d' | sed -e '/./,$!d' -e :a -e '/^\n*$/{$d;N;ba;}'
}

# Main
main() {
  local version
  version=$(get_version)
  local tag="v${version}"

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Release: $tag"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  # Check prerequisites
  if ! command -v gh &>/dev/null; then
    echo "ERROR: gh CLI is required but not installed"
    echo "  Install: https://cli.github.com/"
    exit 1
  fi

  if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is required but not installed"
    exit 1
  fi

  # Check if tag already exists
  if git rev-parse "$tag" &>/dev/null; then
    echo "WARNING: Tag $tag already exists"
    # Check if a GitHub Release also exists
    if gh release view "$tag" &>/dev/null; then
      echo "ERROR: GitHub Release $tag already exists. Nothing to do."
      exit 1
    fi
    echo "  Tag exists but no GitHub Release found. Will create release only."
  fi

  # Extract changelog
  echo "Extracting changelog for version $version..."
  local changelog_body
  changelog_body=$(extract_changelog "$version")

  if [[ -z "$changelog_body" ]]; then
    echo "WARNING: No changelog entry found for version $version"
    echo "  Expected a section: ## [$version] in CHANGELOG.md"
    changelog_body="Release $tag"
  fi

  echo ""
  echo "--- Release Notes ---"
  echo "$changelog_body"
  echo "--- End Notes ---"
  echo ""

  if $DRY_RUN; then
    echo "[DRY RUN] Would create tag: $tag"
    echo "[DRY RUN] Would create GitHub Release: $tag"
    echo ""
    echo "To execute, run without --dry-run:"
    echo "  $0"
    exit 0
  fi

  # Create tag if it doesn't exist
  if ! git rev-parse "$tag" &>/dev/null; then
    echo "Creating tag $tag..."
    git tag -a "$tag" -m "Release $tag"
    echo "  ✓ Tag created"

    echo "Pushing tag to origin..."
    git push origin "$tag"
    echo "  ✓ Tag pushed"
  fi

  # Create GitHub Release
  echo "Creating GitHub Release..."
  gh release create "$tag" \
    --title "$tag" \
    --notes "$changelog_body"
  echo "  ✓ GitHub Release created"

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Done! Release $tag published"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
}

main
