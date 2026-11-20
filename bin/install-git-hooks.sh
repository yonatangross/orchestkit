#!/bin/bash
# Configure Git to use the checkout's bin/git-hooks
# Run this after cloning the repo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_SRC="$PROJECT_ROOT/bin/git-hooks"
git -C "$PROJECT_ROOT" config --local core.hooksPath bin/git-hooks

echo "Git hooks point at bin/git-hooks in each checkout."

for hook in "$HOOKS_SRC"/*; do
  [[ -f "$hook" ]] || continue
  hook_name=$(basename "$hook")

  echo "  ✓ Found $hook_name"
done

echo ""
echo "Git hooks configured successfully!"
echo "Hooks mirror CI checks - fail fast locally."
