#!/usr/bin/env bash
# No workflow may merge or arm a PR on its own (#4914, #4931).
#
# release.yml's bump-stable-pin job opened the stable-pin PR and armed it
# with `gh pr merge --squash --auto`. The required checks are CI only, so
# #4913 merged on CI alone, before any reviewer read it. A workflow opens
# its PR unarmed; the merge desk arms or merges it after a LAND names the
# head.
#
# SCOPE: lint against accidental re-adds; not exhaustive against deliberate evasion; the real control is review + branch protection.
# A spelling found later that this misses goes to a follow-up issue.
#
# One rule, no allowlist: every workflow and composite action under
# .github/ must pass check_workflow. The fixtures under
# tests/fixtures/unarmed-workflows/ pin what that means: every file in
# flag/ must be flagged, every file in pass/ must pass, and a file that
# cannot be parsed as YAML must be flagged too (fail closed).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURES="$ROOT/tests/fixtures/unarmed-workflows"

PASS=0
FAILS=0
fail() { echo "✗ $1"; FAILS=$((FAILS + 1)); }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

# Prints one line per merge or arm in a workflow file, nothing when clean.
# The checker parses the YAML and splits each run value with shell quoting
# rules; see its docstring for exactly what it flags.
CHECKER="$ROOT/scripts/ci/check-workflow-self-merge.py"
[[ -f "$CHECKER" ]] || { echo "✗ missing $CHECKER"; exit 1; }
check_workflow() {
  python3 "$CHECKER" "$1"
}

# Runs the checker on one file. Prints its findings; a checker that could
# not judge the file counts as a finding, never as clean.
findings_for() {
  local out rc=0
  out="$(check_workflow "$1" 2>&1)" || rc=$?
  if [[ "$rc" -ne 0 && -z "$out" ]]; then
    out="checker exited $rc without a finding"
  fi
  printf '%s' "$out"
}

# 1. Fixtures. A flag/ fixture that passes, or a pass/ fixture that is
# flagged, means the checker cannot be trusted on the real tree either.
flag_n=0
for f in "$FIXTURES"/flag/*.yml; do
  [[ -f "$f" ]] || continue
  flag_n=$((flag_n + 1))
  name="$(basename "$f" .yml)"
  if [[ -n "$(findings_for "$f")" ]]; then
    ok "flag/$name is flagged"
  else
    fail "flag/$name was NOT flagged"
  fi
done
pass_n=0
for f in "$FIXTURES"/pass/*.yml; do
  [[ -f "$f" ]] || continue
  pass_n=$((pass_n + 1))
  name="$(basename "$f" .yml)"
  hits="$(findings_for "$f")"
  if [[ -z "$hits" ]]; then
    ok "pass/$name passes"
  else
    fail "pass/$name was flagged: $hits"
  fi
done
[[ "$flag_n" -gt 0 ]] || fail "no flag/ fixtures found; the self-check proves nothing"
[[ "$pass_n" -gt 0 ]] || fail "no pass/ fixtures found; the self-check proves nothing"

# An unparseable workflow must be flagged, not skipped. Written at test
# time so no broken YAML file lives in the repo for other linters to trip on.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-unarmed-wf.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
printf 'name: broken\njobs: [unclosed\n  steps:\n    - run: echo hi\n' > "$WORK/unparseable.yml"
if [[ -n "$(findings_for "$WORK/unparseable.yml")" ]]; then
  ok "an unparseable workflow is flagged (fail closed)"
else
  fail "an unparseable workflow was NOT flagged"
fi

# 2. The real scan: every workflow and composite action, no allowlist.
# Only directories that exist are passed to find, so find's own errors
# stay visible instead of being discarded.
dirs=()
for d in "$ROOT/.github/workflows" "$ROOT/.github/actions"; do
  [[ -d "$d" ]] && dirs+=("$d")
done

scanned=0
if [[ "${#dirs[@]}" -gt 0 ]]; then
  while IFS= read -r -d '' wf; do
    scanned=$((scanned + 1))
    hits="$(findings_for "$wf")"
    [[ -z "$hits" ]] && continue
    while IFS= read -r h; do fail "${h#"$ROOT"/}"; done <<< "$hits"  # pipebuf: bounded-small (a few short problem lines)
  done < <(find "${dirs[@]}" -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)
fi

if [[ "$scanned" -eq 0 ]]; then
  fail "scanned 0 workflow files; the scan proves nothing"
else
  ok "scanned $scanned workflow and action files"
fi

echo "  $PASS passed, $FAILS failed"
[[ "$FAILS" == 0 ]] || exit 1
