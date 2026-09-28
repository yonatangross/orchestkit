#!/usr/bin/env bash
# Test suite: the standards gate verdict cannot be weakened by the PR it judges.
# Run: bash tests/unit/test-standards-gate-base-trust.sh
#
# The hole (#1983 follow-up): under pull_request the gate ran the PR's own
# workflow, script, allowlists and baseline, so a PR could turn it green by
# editing the gate. scripts/standards-gate-verdict.sh runs the TRUSTED reader
# against a BASE floor and reads the PR head only as data. This suite builds a
# synthetic trusted / base / head layout (the same three checkouts the
# workflow makes) and proves:
#   - a head edit to scripts/check-frontmatter.py is ignored: the trusted copy
#     runs, the head copy never executes, the planted violation is reported
#   - a loosened allowlist in the head registry fails (added key, dropped house
#     key, raised limit, changed pattern), with or without new debt
#   - a lowered baseline passes, a raised one fails, a tightening passes
#   - symlinked gate inputs in the head are refused (exit 2)
#   - a base without the registry falls back to the trusted copy, not to head
#   - the verdict workflow keeps its shape: pull_request_target, no paths
#     filter, permissions {}, persist-credentials false on every checkout,
#     nothing executed from head
# Two vacuity controls prove the suite can see the attacks: a driver that runs
# the HEAD script goes green on the script swap, and a driver without the
# widening step goes green on the loosened allowlist.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DRIVER="$REPO_ROOT/scripts/standards-gate-verdict.sh"
WORKFLOW="$REPO_ROOT/.github/workflows/standards-gate.yml"

TMP="$(mktemp -d -t std-gate-trust.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

check() {
  # check <name> <want rc> <needle> <rc> <output>
  local name="$1" want_rc="$2" needle="$3" rc="$4" out="$5"
  if [ "$rc" = "$want_rc" ] && [[ "$out" == *"$needle"* ]]; then
    PASS=$((PASS + 1)); echo "  ok    $name (rc=$rc)"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL  $name: want rc=$want_rc and '$needle', got rc=$rc"
    printf '%s\n' "$out" | while IFS= read -r line; do echo "        $line"; done
  fi
}

assert() {
  # assert <name> <command...>: pass when the command succeeds.
  local name="$1"
  shift
  if "$@"; then
    PASS=$((PASS + 1)); echo "  ok    $name"
  else
    FAIL=$((FAIL + 1)); echo "  FAIL  $name"
  fi
}

absent() {
  # absent <ERE> <file>: succeeds when no line of the file matches.
  ! grep -qE "$1" "$2"
}

skill() {
  # skill <tree> <name> [extra frontmatter line]
  mkdir -p "$1/src/skills/$2"
  {
    echo "---"
    echo "name: $2"
    echo "description: synthetic skill $2"
    [ -n "${3:-}" ] && echo "$3"
    echo "---"
    echo "body"
  } > "$1/src/skills/$2/SKILL.md"
}

edit_json() {
  # edit_json <file> <python statement over the parsed document d>
  python3 - "$1" "$2" <<'PY'
import json, sys
path, stmt = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    d = json.load(fh)
fm = d.get("frontmatter")
f = d.get("files")
exec(stmt)
with open(path, "w", encoding="utf-8") as fh:
    json.dump(d, fh, indent=2)
PY
}

# the trusted tree: this checkout's reader, driver and configs
TRUSTED="$TMP/trusted"
mkdir -p "$TRUSTED/scripts" "$TRUSTED/configs"
cp "$REPO_ROOT/scripts/check-frontmatter.py" "$DRIVER" "$TRUSTED/scripts/"
cp "$REPO_ROOT/configs/standards.json" "$REPO_ROOT/configs/frontmatter-baseline.json" "$TRUSTED/configs/"

# the pristine head: two skills (one carries baselined debt) and an agent
PRISTINE="$TMP/pristine"
mkdir -p "$PRISTINE/configs" "$PRISTINE/scripts" "$PRISTINE/src/agents"
skill "$PRISTINE" alpha
skill "$PRISTINE" beta "tags: [a, b]"
printf '%s\n' '---' 'name: gamma' 'description: synthetic agent' 'tools: "Read"' '---' > "$PRISTINE/src/agents/gamma.md"
cp "$REPO_ROOT/configs/standards.json" "$PRISTINE/configs/"
cp "$REPO_ROOT/scripts/check-frontmatter.py" "$PRISTINE/scripts/"
git -C "$PRISTINE" init -q
git -C "$PRISTINE" add -A
python3 "$REPO_ROOT/scripts/check-frontmatter.py" --root "$PRISTINE" \
  --registry "$PRISTINE/configs/standards.json" \
  --baseline "$PRISTINE/configs/frontmatter-baseline.json" --write-baseline --allow-new >/dev/null
git -C "$PRISTINE" add -A

# The base branch is the pristine configs (the floor a PR is judged by).
BASE="$TMP/base"
mkdir -p "$BASE/configs"
cp "$PRISTINE/configs/standards.json" "$PRISTINE/configs/frontmatter-baseline.json" "$BASE/configs/"

new_head() {
  # new_head <name>: a fresh copy of the pristine head to mutate; sets H.
  H="$TMP/head-$1"
  cp -R "$PRISTINE" "$H"
}

verdict() {
  # verdict <head> [driver]: run the verdict; sets RC and OUT.
  RC=0
  OUT="$(bash "${2:-$TRUSTED/scripts/standards-gate-verdict.sh}" \
    --trusted "$TRUSTED" --base "$BASE" --head "$1" 2>&1)" || RC=$?
}

echo "standards gate verdict (trusted reader, base floor, head as data)"

new_head clean
verdict "$H"
check "unchanged head passes" 0 "verdict: rc=0" "$RC" "$OUT"

# head edits to the script are ignored
new_head script-swap
SENTINEL="$TMP/head-script-ran"
cat > "$H/scripts/check-frontmatter.py" <<PY
import pathlib, sys
pathlib.Path("$SENTINEL").write_text("the head copy executed")
sys.exit(0)
PY
skill "$H" delta "version: 1.0.0"
git -C "$H" add -A
verdict "$H"
check "head script swapped to exit 0: trusted copy still reports the violation" 1 \
  "NEW  src/skills/delta/SKILL.md: house-key:version" "$RC" "$OUT"
assert "the head copy of check-frontmatter.py never executed" test ! -e "$SENTINEL"

# a loosened allowlist fails
new_head loosen
# Move tags from house_keys into the skill allowlist: beta's baselined debt
# disappears under the head rules. Merged, this registry becomes the next
# floor, so the widening itself must fail even though no file changed.
edit_json "$H/configs/standards.json" \
  'fm["house_keys"].remove("tags"); fm["skill"]["claude_code_keys"].append({"key": "tags", "evidence": "planted"})'
LOOSEN_HEAD="$H"
verdict "$H"
check "house key moved into the allowlist fails" 1 \
  "WIDENED skill: top-level key newly allowed: tags" "$RC" "$OUT"
check "  ... and the dropped house key is reported" 1 \
  "WIDENED house key dropped (recodes the baseline): tags" "$RC" "$OUT"

new_head loosen-plus-debt
edit_json "$H/configs/standards.json" \
  'fm["house_keys"].remove("tags"); fm["skill"]["claude_code_keys"].append({"key": "tags", "evidence": "planted"})'
skill "$H" epsilon "tags: [x]"
git -C "$H" add -A
verdict "$H"
check "loosened allowlist plus new debt: the base rules still see the debt" 1 \
  "NEW  src/skills/epsilon/SKILL.md: house-key:tags" "$RC" "$OUT"

new_head raise-limit
edit_json "$H/configs/standards.json" 'fm["limits"]["description_max"] += 500'
verdict "$H"
check "raised description_max fails" 1 "WIDENED limit raised: description_max" "$RC" "$OUT"

new_head pattern
edit_json "$H/configs/standards.json" 'fm["name_pattern"] = "^.+$"'
verdict "$H"
check "changed name_pattern fails" 1 "WIDENED name_pattern changed" "$RC" "$OUT"

new_head agent-key
edit_json "$H/configs/standards.json" \
  'fm["agent"]["claude_code_keys"].append({"key": "planted", "evidence": "planted"})'
verdict "$H"
check "new agent key allowed fails" 1 "WIDENED agent: top-level key newly allowed: planted" "$RC" "$OUT"

new_head tighten
edit_json "$H/configs/standards.json" 'fm["house_keys"].append("planted-house-key"); fm["limits"]["name_max"] -= 1'
verdict "$H"
check "tightened allowlist passes" 0 "0 finding(s)" "$RC" "$OUT"

# the baseline may fall, never rise
new_head lower
skill "$H" beta
edit_json "$H/configs/frontmatter-baseline.json" 'f.pop("src/skills/beta/SKILL.md", None)'
verdict "$H"
check "lowered baseline (debt fixed) passes" 0 "0 code(s) added" "$RC" "$OUT"

new_head raise
skill "$H" zeta "author: someone"
git -C "$H" add -A
edit_json "$H/configs/frontmatter-baseline.json" 'f["src/skills/zeta/SKILL.md"] = ["house-key:author"]'
verdict "$H"
check "new debt recorded in the head baseline still fails (base baseline decides)" 1 \
  "NEW  src/skills/zeta/SKILL.md: house-key:author" "$RC" "$OUT"
check "  ... and the raised baseline is reported" 1 "GROWN src/skills/zeta/SKILL.md" "$RC" "$OUT"

# symlinked inputs are refused
new_head symlink-skill
rm "$H/src/skills/alpha/SKILL.md"
ln -s "$REPO_ROOT/src/skills/commit/SKILL.md" "$H/src/skills/alpha/SKILL.md"
git -C "$H" add -A
verdict "$H"
check "symlinked SKILL.md in the head is refused" 2 "is a symlink" "$RC" "$OUT"

new_head symlink-config
mv "$H/configs/standards.json" "$H/configs/real-standards.json"
ln -s real-standards.json "$H/configs/standards.json"
verdict "$H"
check "symlinked configs/standards.json in the head is refused" 2 "is a symlink" "$RC" "$OUT"

# a base without the registry falls back to trusted, never to head
# The default branch here carries the pristine configs, so an unchanged head
# passes and the only failure left is the widening itself.
SAVED_BASE="$BASE" SAVED_TRUSTED="$TRUSTED"
TRUSTED="$TMP/trusted-pristine"
mkdir -p "$TRUSTED/scripts" "$TRUSTED/configs"
cp "$SAVED_TRUSTED"/scripts/* "$TRUSTED/scripts/"
cp "$PRISTINE/configs/standards.json" "$PRISTINE/configs/frontmatter-baseline.json" "$TRUSTED/configs/"
BASE="$TMP/empty-base"; mkdir -p "$BASE"
new_head no-floor-clean
verdict "$H"
check "base without the registry: unchanged head passes on the trusted floor" 0 \
  "absent on the PR base" "$RC" "$OUT"
new_head no-floor
edit_json "$H/configs/standards.json" 'fm["limits"]["name_max"] += 10'
verdict "$H"
check "base without the registry: a widening versus the trusted floor fails" 1 \
  "WIDENED limit raised: name_max" "$RC" "$OUT"
BASE="$SAVED_BASE" TRUSTED="$SAVED_TRUSTED"

# a head from before the gate carries no configs: steps 2 and 4 skip with a
# notice instead of failing rc=2, and step 3 still judges the tree on the floor
new_head absent-head
rm -rf "$H/configs"
git -C "$H" add -A
verdict "$H"
check "head without the gate configs passes on the floor" 0 "verdict: rc=0" "$RC" "$OUT"
check "  ... and the skip notice is printed" 0 "head predates the gate" "$RC" "$OUT"

new_head absent-head-debt
rm -rf "$H/configs"
skill "$H" eta "author: someone"
git -C "$H" add -A
verdict "$H"
check "absent head configs do not hide new debt (step 3 still judges)" 1 \
  "NEW  src/skills/eta/SKILL.md: house-key:author" "$RC" "$OUT"

# vacuity controls: the suite can see each attack
CONTROL="$TMP/control-head-script.sh"
# shellcheck disable=SC2016  # the literal $TRUSTED / $HEAD text is what gets rewritten
sed 's#GATE="$TRUSTED/scripts/check-frontmatter.py"#GATE="$HEAD/scripts/check-frontmatter.py"#' \
  "$TRUSTED/scripts/standards-gate-verdict.sh" > "$CONTROL"
# shellcheck disable=SC2016
assert "control driver rewired to the head script" grep -q 'GATE="$HEAD/' "$CONTROL"
verdict "$TMP/head-script-swap" "$CONTROL"
check "CONTROL: a driver that runs the HEAD script goes green on the swap" 0 "verdict: rc=0" "$RC" "$OUT"
assert "CONTROL: ... and the head copy did execute" test -e "$SENTINEL"

CONTROL2="$TMP/control-no-widening.sh"
python3 - "$TRUSTED/scripts/standards-gate-verdict.sh" "$CONTROL2" <<'PY'
import re, sys
src = open(sys.argv[1], encoding="utf-8").read()
out, n = re.subn(r'if \[ -f "\$HEAD/\$REGISTRY_REL" \]; then\n.*?^fi\n', "", src, flags=re.S | re.M)
if n != 1:
    sys.exit("widening step not found in the driver")
open(sys.argv[2], "w", encoding="utf-8").write(out)
PY
verdict "$LOOSEN_HEAD" "$CONTROL2"
check "CONTROL: without the widening step the loosened allowlist goes green" 0 "verdict: rc=0" "$RC" "$OUT"

# the verdict workflow keeps the shape that makes the above true
echo
echo "workflow shape (.github/workflows/standards-gate.yml)"
assert "triggered by pull_request_target" grep -qE '^  pull_request_target:' "$WORKFLOW"
assert "no pull_request trigger in the verdict workflow" absent '^  pull_request:' "$WORKFLOW"
assert "no paths filter (a required check must always report)" absent '^ *paths(-ignore)?:' "$WORKFLOW"
assert "top-level permissions: {}" grep -qE '^permissions: \{\}' "$WORKFLOW"
n_checkout="$(grep -cE 'uses: actions/checkout@' "$WORKFLOW" || true)"
n_nocreds="$(grep -cE 'persist-credentials: false' "$WORKFLOW" || true)"
same_count() { [ "$n_checkout" -ge 3 ] && [ "$n_checkout" = "$n_nocreds" ]; }
assert "persist-credentials: false on every checkout ($n_nocreds of $n_checkout)" same_count
assert "no step runs with head as its working directory" absent 'working-directory:.*head' "$WORKFLOW"
# shellcheck disable=SC2016  # $GITHUB_WORKSPACE is matched literally in the YAML
assert "nothing under head/ is executed" \
  absent '(bash|sh|python3?|uv run python|source|\.) +"?(\$GITHUB_WORKSPACE/)?head/' "$WORKFLOW"
assert "no unsafe checkout opt-in and no secrets" absent 'allow-unsafe-pr-checkout|secrets\.' "$WORKFLOW"
assert "the verdict runs the trusted driver" \
  grep -qE 'bash trusted/scripts/standards-gate-verdict\.sh' "$WORKFLOW"
assert "trusted checkout pinned to github.sha (default branch)" \
  grep -qE 'ref: \$\{\{ github\.sha \}\}' "$WORKFLOW"

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
