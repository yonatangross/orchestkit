#!/usr/bin/env bash
# pattern-sync-pull - Lifecycle Hook
# Delegates to TypeScript implementation via hooks bundle
# CC 2.1.17 Compliant

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_ROOT="$(dirname "$SCRIPT_DIR")"

# Delegate to TypeScript bundle
exec node "$HOOKS_ROOT/bin/run-hook.mjs" "lifecycle/pattern-sync-pull"
