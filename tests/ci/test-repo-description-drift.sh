#!/usr/bin/env bash
# Test: .github/scripts/check-repo-description.sh fails when the GitHub repo
# description carries component counts that disagree with README's stamped
# markers, and passes when they agree or when the description names no counts.
#
# Why this exists (#3667): the description read "105 skills, 36 agents, 217
# hooks" while the truth was 106 / 36 / 171. It is repository metadata, not a
# file, so stamp-counts.sh cannot rewrite it and no drift test could read it.
# README's markers are already gated against src/ by stamp-counts.sh --check,
# so they are the reference here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECK="$ROOT/.github/scripts/check-repo-description.sh"
FAIL=0
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ork-repo-description.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT

marker() {
  grep -o "<!--ork:$1-->[0-9]*<!--/ork-->" "$ROOT/README.md" | head -1 | grep -o '[0-9]\+'
}
SKILLS="$(marker skills)"
AGENTS="$(marker agents)"
HOOKS="$(marker hooks)"

expect() {
  local want="$1" desc="$2" label="$3" rc=0
  bash "$CHECK" --description "$desc" > /dev/null 2>&1 || rc=$?
  if [[ "$rc" -eq "$want" ]]; then
    echo "PASS: $label (rc $rc)"
  else
    echo "FAIL: $label: rc $rc, want $want"
    FAIL=1
  fi
}

if [[ ! -f "$CHECK" ]]; then
  echo "FAIL: $CHECK does not exist"
  exit 1
fi

expect 0 "Toolkit. ${SKILLS} skills, ${AGENTS} agents, ${HOOKS} hooks. Install ork." "counts match README"
expect 1 "Toolkit. ${SKILLS} skills, ${AGENTS} agents, $((HOOKS + 46)) hooks." "hook count off by 46 (the #3667 case)"
expect 1 "Toolkit. $((SKILLS - 1)) skills, ${AGENTS} agents, ${HOOKS} hooks." "skill count stale by one"
expect 0 "The Complete AI Development Toolkit for Claude Code." "no counts named: nothing to drift"
expect 2 "" "empty description: the check cannot read it"

# The failure names the fix: the expected fragment to paste. Output goes to a
# file and grep reads the file (no pipe or here-string into grep -q).
rc=0
bash "$CHECK" --description "${SKILLS} skills, ${AGENTS} agents, 1 hooks" > "$SCRATCH/out" 2>&1 || rc=$?
if [[ "$rc" -ne 1 ]]; then
  echo "FAIL: a drifted hook count should exit 1, got $rc"
  FAIL=1
elif grep -qF "${SKILLS} skills, ${AGENTS} agents, ${HOOKS} hooks" "$SCRATCH/out"; then
  echo "PASS: drift message names the expected counts"
else
  echo "FAIL: drift message does not name the expected counts:"
  cat "$SCRATCH/out"
  FAIL=1
fi

exit "$FAIL"
