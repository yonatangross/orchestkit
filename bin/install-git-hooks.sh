#!/bin/bash
# Install git hooks from bin/git-hooks to Git's hooks directory
# Run this after cloning the repo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_SRC="$PROJECT_ROOT/bin/git-hooks"
HOOKS_DST="$(git -C "$PROJECT_ROOT" rev-parse --path-format=absolute --git-path hooks)"
mkdir -p "$HOOKS_DST"

echo "Installing git hooks..."

for hook in "$HOOKS_SRC"/*; do
  [[ -f "$hook" ]] || continue
  hook_name=$(basename "$hook")

  # Backup existing hook if it's not a symlink
  if [[ -f "$HOOKS_DST/$hook_name" && ! -L "$HOOKS_DST/$hook_name" ]]; then
    mv "$HOOKS_DST/$hook_name" "$HOOKS_DST/$hook_name.backup"
    echo "  Backed up existing $hook_name"
  fi

  # Create symlink
  ln -sf "$hook" "$HOOKS_DST/$hook_name"
  echo "  ✓ Installed $hook_name"
done

echo ""
echo "Git hooks installed successfully!"
echo "Hooks mirror CI checks - fail fast locally."
