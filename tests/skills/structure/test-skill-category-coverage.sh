#!/usr/bin/env bash
# Skill by-category coverage: every skill must land on at least one page.
# Wrapper around test-skill-category-coverage.py (F26 / PR #4358 HOLD).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/test-skill-category-coverage.py"
