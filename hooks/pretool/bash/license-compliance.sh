#!/bin/bash
set -euo pipefail
# License Compliance Check Hook for Claude Code
# Checks license compatibility before npm/pip install
# Warns about GPL/AGPL licenses in MIT projects
# CC 2.1.9 Enhanced: Uses additionalContext for warnings
# Hook: PreToolUse (Bash)
# Issue: #137

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Self-guard: Only run for package install commands
guard_nontrivial_bash || exit 0

# Get the command being executed
COMMAND=$(get_field '.tool_input.command')

# Skip if empty
if [[ -z "$COMMAND" ]]; then
  output_silent_success
  exit 0
fi

# Check if this is a package install command
IS_NPM_INSTALL=false
IS_PIP_INSTALL=false
PACKAGES=""

# Detect npm/yarn/pnpm install
if [[ "$COMMAND" =~ (npm|yarn|pnpm)\ (install|add|i)\ +([^-][^[:space:]]*) ]]; then
  IS_NPM_INSTALL=true
  # Extract package names (remove flags and options)
  PACKAGES=$(echo "$COMMAND" | sed -E 's/(npm|yarn|pnpm) (install|add|i) //g' | tr ' ' '\n' | grep -v '^-' | head -10)
fi

# Detect pip/pip3/poetry/uv install
if [[ "$COMMAND" =~ (pip3?|poetry|uv)\ (install|add)\ +([^-][^[:space:]]*) ]]; then
  IS_PIP_INSTALL=true
  # Extract package names (remove flags and options)
  PACKAGES=$(echo "$COMMAND" | sed -E 's/(pip3?|poetry|uv) (install|add) //g' | tr ' ' '\n' | grep -v '^-' | head -10)
fi

# If not a package install, allow silently
if [[ "$IS_NPM_INSTALL" == "false" && "$IS_PIP_INSTALL" == "false" ]]; then
  output_silent_success
  exit 0
fi

# Skip if no packages detected (e.g., npm install with no args = install from lockfile)
if [[ -z "$PACKAGES" ]]; then
  output_silent_success
  exit 0
fi

# Detect project license
PROJ_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROJECT_LICENSE="unknown"

# Check package.json for license
if [[ -f "$PROJ_DIR/package.json" ]]; then
  PROJECT_LICENSE=$(jq -r '.license // "unknown"' "$PROJ_DIR/package.json" 2>/dev/null || echo "unknown")
fi

# Check pyproject.toml for license
if [[ "$PROJECT_LICENSE" == "unknown" && -f "$PROJ_DIR/pyproject.toml" ]]; then
  PROJECT_LICENSE=$(grep -E '^license\s*=' "$PROJ_DIR/pyproject.toml" 2>/dev/null | head -1 | sed 's/.*=\s*["'"'"']\([^"'"'"']*\).*/\1/' || echo "unknown")
fi

# Check LICENSE file
if [[ "$PROJECT_LICENSE" == "unknown" && -f "$PROJ_DIR/LICENSE" ]]; then
  if grep -qi "MIT License" "$PROJ_DIR/LICENSE" 2>/dev/null; then
    PROJECT_LICENSE="MIT"
  elif grep -qi "Apache License" "$PROJ_DIR/LICENSE" 2>/dev/null; then
    PROJECT_LICENSE="Apache-2.0"
  elif grep -qi "BSD" "$PROJ_DIR/LICENSE" 2>/dev/null; then
    PROJECT_LICENSE="BSD"
  fi
fi

# Define GPL-family licenses that are incompatible with permissive licenses
GPL_LICENSES="GPL|AGPL|LGPL|GPL-2.0|GPL-3.0|AGPL-3.0|LGPL-2.1|LGPL-3.0"

# Define permissive licenses
PERMISSIVE_LICENSES="MIT|Apache|BSD|ISC|0BSD|Unlicense|CC0"

# Check if project uses a permissive license
IS_PERMISSIVE=false
if [[ "$PROJECT_LICENSE" =~ ^($PERMISSIVE_LICENSES) ]]; then
  IS_PERMISSIVE=true
fi

# Build license warnings
LICENSE_WARNINGS=""
RISKY_PACKAGES=""

# Known GPL-licensed packages (common ones)
# This is a heuristic - actual license checking would require npm/pip API calls
KNOWN_GPL_NPM="@ffmpeg-installer/ffmpeg|ghostscript|imagemagick|readline-sync"
KNOWN_GPL_PIP="readline|pyqt5|pyqt6|pygobject|mysql-connector-python"

for pkg in $PACKAGES; do
  # Clean package name (remove version specifiers)
  pkg_name=$(echo "$pkg" | sed -E 's/[@^~>=<][0-9].*//' | sed 's/@.*//')

  # Skip empty or invalid package names
  [[ -z "$pkg_name" || "$pkg_name" == "-" ]] && continue

  # Check against known GPL packages
  if [[ "$IS_NPM_INSTALL" == "true" && "$pkg_name" =~ ^($KNOWN_GPL_NPM)$ ]]; then
    RISKY_PACKAGES="$RISKY_PACKAGES $pkg_name(GPL)"
  fi

  if [[ "$IS_PIP_INSTALL" == "true" && "$pkg_name" =~ ^($KNOWN_GPL_PIP)$ ]]; then
    RISKY_PACKAGES="$RISKY_PACKAGES $pkg_name(GPL)"
  fi

  # Flag packages with "gpl" in name
  if [[ "$pkg_name" =~ gpl|agpl ]]; then
    RISKY_PACKAGES="$RISKY_PACKAGES $pkg_name(name-suggests-GPL)"
  fi
done

# Build context message
CONTEXT_MSG=""

if [[ -n "$RISKY_PACKAGES" && "$IS_PERMISSIVE" == "true" ]]; then
  # Warning: GPL packages in permissive-licensed project
  LICENSE_WARNINGS="License Warning: Installing potentially GPL-licensed packages in $PROJECT_LICENSE project:$RISKY_PACKAGES. GPL requires derivative works to be GPL-licensed. Verify license compatibility before proceeding."
  CONTEXT_MSG="$LICENSE_WARNINGS"

  log_hook "LICENSE_WARN: GPL-risk packages in $PROJECT_LICENSE project:$RISKY_PACKAGES"

  # Inject warning via additionalContext (CC 2.1.9)
  output_with_context "$CONTEXT_MSG"
  exit 0
fi

# If project license unknown but installing packages, suggest checking
if [[ "$PROJECT_LICENSE" == "unknown" && -n "$PACKAGES" ]]; then
  CONTEXT_MSG="Tip: Project license not detected. Consider adding license field to package.json or pyproject.toml for dependency license checking."
  log_hook "LICENSE_INFO: Project license unknown"
  output_with_context "$CONTEXT_MSG"
  exit 0
fi

# No license concerns - allow silently
log_hook "LICENSE_OK: Installing packages compatible with $PROJECT_LICENSE"
output_silent_success
exit 0
