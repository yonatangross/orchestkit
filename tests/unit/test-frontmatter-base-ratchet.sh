#!/usr/bin/env bash
# Test suite for the base ratchet in scripts/check-frontmatter.py (hq-ext-plugin #1983).
# Run: bash tests/unit/test-frontmatter-base-ratchet.sh
#
# The hole under test: the gate read configs/frontmatter-baseline.json from the
# PR head only, so a PR could add a violation and record it in the baseline in
# the same commit and still pass. --base-baseline compares the head baseline to
# the base branch copy: any code the base did not hold fails, lowering passes,
# and a baseline absent on base (its first PR) has no floor.
#
# Hermetic against the tree: the head baseline is regenerated from the current
# tree into a scratch dir first, so a violation added elsewhere later cannot
# turn these cases red for an unrelated reason.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GATE="$REPO_ROOT/scripts/check-frontmatter.py"

TMPDIR_TEST="$(mktemp -d -t fm-base-ratchet.XXXXXX)"
trap 'rm -rf "$TMPDIR_TEST"' EXIT

PASS=0
FAIL=0

check() {
  local name="$1" want_rc="$2" needle="$3" rc="$4" out="$5"
  if [ "$rc" = "$want_rc" ] && [[ "$out" == *"$needle"* ]]; then
    PASS=$((PASS + 1)); echo "  ok    $name (rc=$rc)"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL  $name: want rc=$want_rc and '$needle', got rc=$rc"
    echo "$out"
  fi
}

run_gate() {
  # run_gate <head baseline> <base baseline>; sets RC and OUT.
  # rc 1 is an expected verdict here, so capture it instead of letting -e exit.
  RC=0
  OUT="$(python3 "$GATE" --root "$REPO_ROOT" --baseline "$1" --base-baseline "$2" 2>&1)" || RC=$?
}

# mutate <in> <out> <python statement over the files dict f; first = first path>
mutate() {
  python3 - "$1" "$2" "$3" <<'PY'
import json, sys
src, dst, stmt = sys.argv[1], sys.argv[2], sys.argv[3]
with open(src, encoding="utf-8") as fh:
    data = json.load(fh)
f = data["files"]
first = sorted(f)[0]
exec(stmt)
with open(dst, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
PY
}

HEAD_BL="$TMPDIR_TEST/head.json"
python3 "$GATE" --root "$REPO_ROOT" --baseline "$HEAD_BL" --write-baseline --allow-new >/dev/null

echo "base ratchet (scripts/check-frontmatter.py --base-baseline)"

run_gate "$HEAD_BL" "$HEAD_BL"
check "unchanged baseline passes" 0 "0 code(s) added" "$RC" "$OUT"

mutate "$HEAD_BL" "$TMPDIR_TEST/raised.json" 'f[first] = f[first] + ["house-key:planted-raise"]'
run_gate "$TMPDIR_TEST/raised.json" "$HEAD_BL"
check "raised count fails" 1 "GROWN" "$RC" "$OUT"

mutate "$HEAD_BL" "$TMPDIR_TEST/newfile.json" 'f["src/skills/planted-new/SKILL.md"] = ["house-key:tags"]'
run_gate "$TMPDIR_TEST/newfile.json" "$HEAD_BL"
check "new file in the baseline fails" 1 "GROWN src/skills/planted-new/SKILL.md" "$RC" "$OUT"

mutate "$HEAD_BL" "$TMPDIR_TEST/swap.json" 'f[first] = f[first][1:] + ["house-key:planted-swap"]'
run_gate "$TMPDIR_TEST/swap.json" "$HEAD_BL"
check "swap at equal count fails" 1 "added house-key:planted-swap" "$RC" "$OUT"

mutate "$HEAD_BL" "$TMPDIR_TEST/base-higher.json" 'f[first] = f[first] + ["house-key:planted-fixed"]'
run_gate "$HEAD_BL" "$TMPDIR_TEST/base-higher.json"
check "lowered baseline passes" 0 "0 code(s) added" "$RC" "$OUT"

run_gate "$HEAD_BL" "$TMPDIR_TEST/absent-on-base.json"
check "absent base passes (no floor)" 0 "absent" "$RC" "$OUT"

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
