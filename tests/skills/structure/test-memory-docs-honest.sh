#!/usr/bin/env bash
# The memory docs say what the graph tier needs, the way the remember skill does.
# Wrapper around test-memory-docs-honest.py, so CI runs it.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/test-memory-docs-honest.py"
