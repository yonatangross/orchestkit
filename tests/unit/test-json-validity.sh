#!/bin/bash
# JSON File Validator — thin wrapper around Node.js for performance.
# Validates all .json files in .claude/ and .claude-plugin/ directories.
#
# Usage: ./test-json-validity.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
#
# Node.js JSON.parse validates ~2,700 files in <0.5s vs ~71s with per-file jq.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/test-json-validity.js" "$@"
