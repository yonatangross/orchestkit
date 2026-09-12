#!/usr/bin/env bash
# ASCII density ratchet self-tests (#4073).
# Created: 2026-09-12
#
# strict-mode: opt-out this harness counts failures across both cases and
# prints a summary, and case 1 EXPECTS the gate subprocess to exit 1; `-e`
# would abort on that captured exit code before the assertion runs.
#
# Covers the two failure shapes the ratchet must catch, each in a throwaway
# git fixture repo holding a copy of the gate, so the real tree is untouched:
#
#   1. A planted low-density block with an empty baseline exits 1.
#   2. Raising an allowance above the reference exits 1 with the
#      "may only lower" refusal.
#
# ASCII_DENSITY_BASE_REF=HEAD pins the reference baseline to the fixture's
# own committed state, so both tests stay hermetic: no merge-base, no scan
# of the base ref's 637 blocks.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="$SCRIPT_DIR/test-ascii-density.sh"

[ -f "$GATE" ] || { echo "FAIL: gate not found at $GATE" >&2; exit 1; }

pass=0
fail=0
FIXTURES=""

cleanup() {
  # shellcheck disable=SC2086
  [ -n "$FIXTURES" ] && rm -rf $FIXTURES
  return 0
}
trap cleanup EXIT

# Build a fixture repo: gate copy + baseline + one skill, all committed.
# $1 = baseline rows to commit ("" for a fully empty baseline).
fixture_repo() {
  local dir rows
  dir=$(mktemp -d "${TMPDIR:-/tmp}/ork-density-selftest.XXXXXX")
  FIXTURES="$FIXTURES $dir"
  rows="$1"
  (
    cd "$dir" || exit 1
    unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
    export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
    git init -q
    git config user.email density-selftest@example.com
    git config user.name "Density Selftest"
    mkdir -p src/skills/demo tests/unit
    cp "$GATE" tests/unit/test-ascii-density.sh
    {
      printf '# ascii-density-baseline/1\n# threshold: 0.20\n'
      if [ -n "$rows" ]; then printf '%s\n' "$rows"; fi
    } > tests/unit/ascii-density-baseline.tsv
    printf -- '---\nname: demo\ndescription: density selftest fixture\n---\n\n```\nplaceholder\n```\n' \
      > src/skills/demo/SKILL.md
    git add -A
    git commit -qm "density selftest fixture"
  ) || { echo "FAIL: fixture setup failed" >&2; exit 1; }
  printf '%s' "$dir"
}

run_gate() {
  (cd "$1" && ASCII_DENSITY_BASE_REF=HEAD bash tests/unit/test-ascii-density.sh 2>&1)
}

echo "=========================================="
echo "  ASCII density ratchet self-tests (#4073)"
echo "=========================================="

# --- 1. planted low block, empty baseline -> exit 1 --------------------------
dir=$(fixture_repo "")
printf '\n```\n┌──────────────────────┐\n│       low block      │\n└──────────────────────┘\n```\n' \
  >> "$dir/src/skills/demo/SKILL.md"
out=$(run_gate "$dir")
rc=$?
if [ "$rc" -eq 1 ]; then
  echo "  PASS planted low block with empty baseline exits 1"
  pass=$((pass + 1))
else
  echo "  FAIL planted low block expected exit 1, got $rc"
  printf '       %s\n' "${out//$'\n'/$'\n'       }"
  fail=$((fail + 1))
fi

# --- 2. raised allowance -> exit 1, "may only lower" refusal -----------------
dir=$(fixture_repo "src/skills/demo/SKILL.md	1")
printf '# ascii-density-baseline/1\n# threshold: 0.20\nsrc/skills/demo/SKILL.md\t2\n' \
  > "$dir/tests/unit/ascii-density-baseline.tsv"
out=$(run_gate "$dir")
rc=$?
if [ "$rc" -eq 1 ] && [[ "$out" == *"may only lower"* ]]; then
  echo "  PASS raised allowance refused: baseline may only lower"
  pass=$((pass + 1))
else
  echo "  FAIL raised allowance expected exit 1 with 'may only lower', got $rc"
  printf '       %s\n' "${out//$'\n'/$'\n'       }"
  fail=$((fail + 1))
fi

printf '\n%s\n' "self-tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
exit 0
