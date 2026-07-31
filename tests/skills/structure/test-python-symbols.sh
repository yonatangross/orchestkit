#!/usr/bin/env bash
# test-python-symbols.sh — the Python half of the phantom-symbol gate.
#
# Named test-*.sh so scripts/ci/run-tests.sh discovers it. Not wired as a hard
# CI gate: it needs the network (PyPI + wheel downloads), and a gate that flakes
# when a registry has a bad afternoon is a gate people learn to ignore. Same
# contract as import-symbol-watch: it reports, humans triage.
#
# Run it locally before changing any Python snippet in a skill.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [[ "${ORK_PYTHON_SYMBOLS:-0}" != "1" ]]; then
  echo "SKIP: network gate. Set ORK_PYTHON_SYMBOLS=1 to run."
  exit 0
fi
node "$REPO_ROOT/scripts/check-python-symbols.mjs" --check
