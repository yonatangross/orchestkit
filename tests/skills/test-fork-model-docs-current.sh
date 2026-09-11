#!/usr/bin/env bash
# Created: 2026-09-11
#
# Test: skill docs must not describe the pre-CC-2.1.232 fork model as the only
# route (#3726, follow-up to #3721). Since CC 2.1.232 subagent forking is on by
# default and `subagent_type: "fork"` is first-class; the 2.1.89 eligibility
# conditions matter only for ordinary `Agent()` calls. Docs pairing a 2.1.89
# fork mention with no 2.1.232 note anywhere in the file are stale.
#
# The sweep itself is python (tests/skills/scripts/fork-model-sweep.py) and
# derives its roster by grep, not hardcoded, so the next stale instance is
# caught by CI instead of by a manual verifier sweep.
#
# Overridable for differential testing:
#   SKILLS_DIR=<dir> bash tests/skills/test-fork-model-docs-current.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_DIR="${SKILLS_DIR:-$REPO_ROOT/src/skills}"
SWEEP="$SCRIPT_DIR/scripts/fork-model-sweep.py"

echo "=== Skill fork-model currency test (#3726) ==="
echo "Skills dir: $SKILLS_DIR"
echo ""

exec python3 "$SWEEP" "$SKILLS_DIR"