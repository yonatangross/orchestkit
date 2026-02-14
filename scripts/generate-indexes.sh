#!/usr/bin/env bash
# Thin wrapper — delegates to Node.js for performance (300x faster).
# See generate-indexes.js for implementation.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/generate-indexes.js" "$@"
