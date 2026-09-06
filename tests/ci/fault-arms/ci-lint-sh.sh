#!/usr/bin/env bash
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/ci-lint-sh"

# lint.sh honors CLAUDE_PROJECT_DIR, so no script copy is needed.
CLAUDE_PROJECT_DIR="$REPO" bash "$REPO/tests/ci/lint.sh" >&2
control_rc=$?

# fault: a project root holding ONLY package.json. src/skills, src/agents,
# manifests, .claude-plugin, src/hooks and .github/workflows are all absent.
rm -rf "$FIX"; mkdir -p "$FIX/root"
cp "$REPO/package.json" "$FIX/root/"
CLAUDE_PROJECT_DIR="$FIX/root" bash "$REPO/tests/ci/lint.sh" >&2
fault_rc=$?

printf 'RESULT gate=%s control=%s fault=%s\n' "ci-lint-sh" "$control_rc" "$fault_rc"
