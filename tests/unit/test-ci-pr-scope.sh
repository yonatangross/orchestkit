#!/usr/bin/env bash
# PR runs carry only what a PR needs: Quality Report runs on PRs only when its
# coverage inputs change, and Unit Tests runs node 22 only on PRs. The rules and
# their reasons are in scripts/ci/check-ci-pr-scope.py.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

python3 -c 'import yaml' || { echo "✗ PyYAML missing"; exit 1; }
python3 "$ROOT/scripts/ci/check-ci-pr-scope.py" "$ROOT"
