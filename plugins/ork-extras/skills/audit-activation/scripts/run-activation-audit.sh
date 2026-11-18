#!/usr/bin/env bash
# run-activation-audit.sh - read-only activation collector wrapper.
# The adjacent Node collector derives the catalog from this script's installed
# or source layout. Consumer telemetry is always supplied explicitly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/collect-activation-audit.mjs" "$@"
