#!/usr/bin/env bash
# ============================================================================
# OrchestKit install preflight
# ============================================================================
# Guard against running build commands in a checkout that has no node_modules.
# Most commonly hit after `git worktree add` (which does NOT copy node_modules
# from the source tree) followed by an immediate `npm run build`, producing a
# cryptic `ERR_MODULE_NOT_FOUND: js-yaml` deep inside the hook-contract
# workspace codegen — a confusing surface for a simple "install first" issue.
#
# Wired into the root `prebuild` npm script so every `npm run build` invocation
# fails fast here with an actionable message instead of in workspace codegen.
#
# Exit codes:
#   0  node_modules is present (build proceeds)
#   1  node_modules is missing (build aborted with install instructions)
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  cat >&2 <<EOF
error: node_modules is missing in $PROJECT_ROOT

This is usually because npm install has not been run in this checkout.
A common cause is 'git worktree add' — it creates a new working
directory but does NOT copy node_modules from the source tree.

Fix:
  cd "$PROJECT_ROOT"
  npm install

Then re-run your build command. See CONTRIBUTING.md for details.
EOF
  exit 1
fi
