#!/bin/bash
# Install Git Hooks for OrchestKit
# Ensures pre-commit and pre-push hooks mirror CI checks
# Version: 1.0.0

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PROJECT_ROOT"

echo "Installing OrchestKit git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
if [[ -f ".git/hooks/pre-commit" ]] && [[ ! -L ".git/hooks/pre-commit" ]]; then
  mv .git/hooks/pre-commit .git/hooks/pre-commit.backup
  echo "  Backed up existing pre-commit to pre-commit.backup"
fi
rm -f .git/hooks/pre-commit
ln -s ../../bin/git-hooks/pre-commit .git/hooks/pre-commit
echo "  Installed pre-commit hook"

# Install pre-push hook
if [[ -f ".git/hooks/pre-push" ]] && [[ ! -L ".git/hooks/pre-push" ]]; then
  mv .git/hooks/pre-push .git/hooks/pre-push.backup
  echo "  Backed up existing pre-push to pre-push.backup"
fi
rm -f .git/hooks/pre-push
ln -s ../../bin/git-hooks/pre-push .git/hooks/pre-push
echo "  Installed pre-push hook"

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "Hooks will:"
echo "  pre-commit: Validate JSON/shell syntax, component counts"
echo "  pre-push: Run unit tests, security tests, version checks"
echo ""
echo "To skip hooks (use sparingly):"
echo "  git commit --no-verify"
echo "  git push --no-verify"
