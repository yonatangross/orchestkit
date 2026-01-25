#!/bin/bash
# Release Management Scripts
# Automate semantic versioning and GitHub releases

set -euo pipefail

# =============================================================================
# VERSION DETECTION
# =============================================================================

# Get current version from latest git tag
get_current_version() {
  local version
  version=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
  echo "${version#v}"  # Remove 'v' prefix
}

# Parse version components
parse_version() {
  local version="$1"
  local major minor patch

  IFS='.' read -r major minor patch <<< "${version%%-*}"
  patch="${patch%%+*}"  # Remove build metadata

  echo "$major $minor $patch"
}

# =============================================================================
# VERSION BUMPING
# =============================================================================

# Bump version based on type
bump_version() {
  local bump_type="$1"
  local current
  current=$(get_current_version)

  local major minor patch
  read -r major minor patch <<< "$(parse_version "$current")"

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
      echo "Invalid bump type: $bump_type"
      echo "Use: major, minor, or patch"
      return 1
      ;;
  esac

  echo "$major.$minor.$patch"
}

# Interactive version bump with change analysis
smart_bump() {
  echo "=== Smart Version Bump ==="
  echo ""

  local current
  current=$(get_current_version)
  echo "Current version: v$current"
  echo ""

  # Analyze commits since last release
  echo "Analyzing commits since v$current..."
  echo ""

  local breaking=0 features=0 fixes=0 other=0

  while IFS= read -r commit; do
    case "$commit" in
      *"BREAKING"*|*"!"*)
        ((breaking++))
        ;;
      feat*)
        ((features++))
        ;;
      fix*)
        ((fixes++))
        ;;
      *)
        ((other++))
        ;;
    esac
  done < <(git log "v$current"..HEAD --format=%s 2>/dev/null || true)

  echo "Commits since last release:"
  echo "  Breaking changes: $breaking"
  echo "  Features: $features"
  echo "  Fixes: $fixes"
  echo "  Other: $other"
  echo ""

  # Suggest bump type
  local suggested="patch"
  if [[ $breaking -gt 0 ]]; then
    suggested="major"
  elif [[ $features -gt 0 ]]; then
    suggested="minor"
  fi

  local new_major new_minor new_patch
  new_major=$(bump_version major)
  new_minor=$(bump_version minor)
  new_patch=$(bump_version patch)

  echo "Suggested: $suggested"
  echo ""
  echo "Options:"
  echo "  1) major -> v$new_major"
  echo "  2) minor -> v$new_minor"
  echo "  3) patch -> v$new_patch"
  echo "  4) custom"
  echo "  5) cancel"
  echo ""

  read -p "Select option [1-5]: " choice

  case "$choice" in
    1) echo "$new_major" ;;
    2) echo "$new_minor" ;;
    3) echo "$new_patch" ;;
    4)
      read -p "Enter version (without v): " custom
      echo "$custom"
      ;;
    5|*)
      echo "Cancelled"
      return 1
      ;;
  esac
}

# =============================================================================
# RELEASE CREATION
# =============================================================================

# Create a new release
create_release() {
  local version="${1:-}"
  local title="${2:-}"
  local draft="${3:-false}"
  local prerelease="${4:-false}"

  if [[ -z "$version" ]]; then
    echo "Usage: create_release VERSION [TITLE] [draft] [prerelease]"
    return 1
  fi

  # Ensure version has v prefix for tag
  local tag="v${version#v}"

  echo "=== Creating Release $tag ==="
  echo ""

  # Check we're on main
  local current_branch
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
    echo "⚠️  Warning: Not on main/master branch (on $current_branch)"
    read -p "Continue anyway? (y/N) " confirm
    if [[ "$confirm" != "y" ]]; then
      echo "Cancelled"
      return 1
    fi
  fi

  # Ensure working directory is clean
  if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Working directory not clean. Commit or stash changes first."
    return 1
  fi

  # Pull latest
  echo "Pulling latest changes..."
  git pull origin "$current_branch"

  # Create tag
  echo "Creating tag $tag..."
  if [[ -n "$title" ]]; then
    git tag -a "$tag" -m "$title"
  else
    git tag -a "$tag" -m "Release $tag"
  fi

  # Push tag
  echo "Pushing tag..."
  git push origin "$tag"

  # Create GitHub release
  echo "Creating GitHub release..."

  local gh_args=(
    "--generate-notes"
  )

  if [[ -n "$title" ]]; then
    gh_args+=("--title" "$title")
  else
    gh_args+=("--title" "Release $tag")
  fi

  if [[ "$draft" == "true" ]]; then
    gh_args+=("--draft")
  fi

  if [[ "$prerelease" == "true" ]]; then
    gh_args+=("--prerelease")
  fi

  gh release create "$tag" "${gh_args[@]}"

  echo ""
  echo "✅ Release $tag created successfully!"
  echo ""
  echo "View: gh release view $tag --web"
}

# Create a draft release for review
create_draft_release() {
  local version
  version=$(smart_bump)

  if [[ -z "$version" || "$version" == "Cancelled" ]]; then
    return 1
  fi

  read -p "Release title (optional): " title
  create_release "$version" "$title" "true" "false"
}

# Create a pre-release (alpha/beta/rc)
create_prerelease() {
  local base_version="$1"
  local stage="${2:-beta}"  # alpha, beta, rc
  local number="${3:-1}"

  local version="${base_version}-${stage}.${number}"
  create_release "$version" "Pre-release $version" "false" "true"
}

# =============================================================================
# RELEASE WORKFLOW
# =============================================================================

# Full release workflow
release_workflow() {
  echo "=== Release Workflow ==="
  echo ""

  # Step 1: Ensure clean state
  echo "Step 1: Checking repository state..."
  git fetch origin

  local current_branch
  current_branch=$(git branch --show-current)

  if [[ "$current_branch" != "main" ]]; then
    echo "Switching to main..."
    git checkout main
    git pull origin main
  fi

  if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Working directory not clean"
    return 1
  fi

  echo "✅ Repository is clean"
  echo ""

  # Step 2: Show what's changed
  echo "Step 2: Changes since last release..."
  local current
  current=$(get_current_version)

  echo ""
  echo "Commits since v$current:"
  git log "v$current"..HEAD --oneline | head -20
  echo ""

  # Step 3: Determine version
  echo "Step 3: Determine new version..."
  local new_version
  new_version=$(smart_bump)

  if [[ -z "$new_version" || "$new_version" == "Cancelled" ]]; then
    return 1
  fi

  echo ""
  echo "New version: v$new_version"
  echo ""

  # Step 4: Update version files (optional)
  echo "Step 4: Update version files..."
  update_version_files "$new_version"

  # Step 5: Create release
  echo "Step 5: Create release..."
  read -p "Create as draft first? (Y/n) " draft_choice

  local is_draft="true"
  if [[ "$draft_choice" == "n" || "$draft_choice" == "N" ]]; then
    is_draft="false"
  fi

  read -p "Release title (or Enter for default): " title
  title="${title:-Release v$new_version}"

  create_release "$new_version" "$title" "$is_draft" "false"

  echo ""
  echo "✅ Release workflow complete!"

  if [[ "$is_draft" == "true" ]]; then
    echo ""
    echo "Next steps:"
    echo "  1. Review draft release notes"
    echo "  2. Publish: gh release edit v$new_version --draft=false"
  fi
}

# =============================================================================
# VERSION FILE UPDATES
# =============================================================================

# Update version in common files
update_version_files() {
  local version="$1"

  # package.json
  if [[ -f "package.json" ]]; then
    echo "Updating package.json..."
    # Use node if available, otherwise sed
    if command -v node >/dev/null; then
      node -e "
        const pkg = require('./package.json');
        pkg.version = '$version';
        require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
      "
    else
      sed -i.bak "s/\"version\": \".*\"/\"version\": \"$version\"/" package.json
      rm -f package.json.bak
    fi
  fi

  # pyproject.toml
  if [[ -f "pyproject.toml" ]]; then
    echo "Updating pyproject.toml..."
    sed -i.bak "s/^version = \".*\"/version = \"$version\"/" pyproject.toml
    rm -f pyproject.toml.bak
  fi

  # Cargo.toml
  if [[ -f "Cargo.toml" ]]; then
    echo "Updating Cargo.toml..."
    sed -i.bak "s/^version = \".*\"/version = \"$version\"/" Cargo.toml
    rm -f Cargo.toml.bak
  fi

  # Commit version bump if changes were made
  if [[ -n $(git status --porcelain) ]]; then
    echo "Committing version bump..."
    git add -A
    git commit -m "chore: Bump version to $version"
    git push origin main
  fi
}

# =============================================================================
# HOTFIX WORKFLOW
# =============================================================================

# Create hotfix release
hotfix_release() {
  local fix_description="$1"

  if [[ -z "$fix_description" ]]; then
    echo "Usage: hotfix_release 'Description of the fix'"
    return 1
  fi

  echo "=== Hotfix Release ==="
  echo ""

  local current
  current=$(get_current_version)
  local new_version
  new_version=$(bump_version patch)

  echo "Current: v$current"
  echo "Hotfix:  v$new_version"
  echo ""

  # Create release with hotfix note
  create_release "$new_version" "Hotfix: $fix_description" "false" "false"
}

# =============================================================================
# USAGE
# =============================================================================

usage() {
  cat << 'EOF'
Release Management Scripts

Commands:
  get_current_version      Get current version from git tags
  bump_version TYPE        Bump version (major|minor|patch)
  smart_bump               Interactive version bump with commit analysis
  create_release VER       Create a new release
  create_draft_release     Create a draft release for review
  create_prerelease VER    Create a pre-release (alpha/beta/rc)
  release_workflow         Full guided release workflow
  hotfix_release DESC      Create a hotfix patch release

Examples:
  source release-scripts.sh

  # Quick patch release
  create_release "1.2.4" "Bug fixes"

  # Full workflow
  release_workflow

  # Hotfix
  hotfix_release "Fix critical auth bypass"

  # Pre-release
  create_prerelease "2.0.0" "beta" "1"  # Creates v2.0.0-beta.1
EOF
}

# Show usage if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  usage
fi
