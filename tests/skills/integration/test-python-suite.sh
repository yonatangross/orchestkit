#!/usr/bin/env bash
# CI collection shim for the pytest suite under python/.
#
# run-tests.sh discovers only test-*.sh and test-*.mjs, so the test_*.py
# files in tests/skills/integration/python/ never ran in CI — the staleness
# clock bomb Opus found on main (3 tests aged past their 30-day fixture)
# lived in that blind spot. This shim makes the glob collect them.
set -euo pipefail

PY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/python" && pwd)"

# Same install-if-missing pattern as the PyYAML steps in ci.yml.
if ! command -v pytest >/dev/null; then
  python3 -m pip install --user --break-system-packages 'pytest>=8.0.0' --quiet
fi

exec python3 -m pytest "$PY_DIR" -v --tb=short
