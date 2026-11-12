#!/usr/bin/env bash
# Hook pages mark the events the shipped plugin does not run.
# Wrapper around test-hook-pages-unshipped-events.py, so CI runs it.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/test-hook-pages-unshipped-events.py"
