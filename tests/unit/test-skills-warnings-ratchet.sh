#!/usr/bin/env bash
# Controls for the skills advisory-warnings ratchet gate (orchestkit row 12, 2026-11-13).
#
# Until row 12 the ratchet in tests/run-all-tests.sh printed "GREW" and exited 0, and no
# required CI row called it. This test runs the REAL runner against a fixture tree whose
# skills runner prints a planted warning count, and checks four things:
#   1. above baseline fails with "Advisory warnings: N (baseline B)", at or below passes;
#   2. an unreadable count (no warnings line, non-numeric value, non-numeric baseline,
#      too few tests) fails with a message distinct from the growth message;
#   3. the gate is wired into a job the required "CI Summary" check needs, in ci.yml;
#   4. the baseline was not raised and no workflow sets ORK_WARNINGS_BASELINE.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER="$REPO_ROOT/tests/run-all-tests.sh"
CI_YML="$REPO_ROOT/.github/workflows/ci.yml"
BASELINE_CEILING=267   # the baseline may only fall: this number is never raised

PASS=0
FAIL=0
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork.ratchet.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# A fixture tree: the real runner, a fake CI engine that prints what the environment asks
# for, and an empty tests/skills so the skills block runs. Not a git work tree, so the
# exec-bit preflight is skipped (tests/ci/test-run-all-tests-no-mutation.sh covers it).
FIX="$TMP/fixture"
mkdir -p "$FIX/tests/skills" "$FIX/scripts/ci"
cp "$RUNNER" "$FIX/tests/run-all-tests.sh"
# set_baselines <text>: the fixture's per-category baselines file (one "label=N" line each)
set_baselines() { printf '%b' "$1" > "$FIX/tests/warnings-baselines.txt"; }
set_baselines '# fixture\nSkills=267\n'
cat > "$FIX/scripts/ci/run-tests.sh" <<'ENGINE'
#!/usr/bin/env bash
# fake engine: FAKE_TESTS "[RUN]" lines, then FAKE_WARN_TEXT verbatim
n="${FAKE_TESTS:-200}"
for ((i = 1; i <= n; i++)); do echo "[RUN] $1/test-$i.sh"; done
printf '%b' "${FAKE_WARN_TEXT:-}"
ENGINE

# run_fixture <outfile> <warn text> [tests] [baseline]: prints the exit code of the runner in
# --skills mode. The code is recorded and returned, never swallowed.
run_fixture() {
    # The baseline is pinned to 267 here so these controls do not move when the committed
    # default falls; section 4 below checks the committed default separately.
    local out="$1" warn="$2" tests="${3:-200}" baseline="${4:-267}"
    local rc=0
    (
        cd "$FIX"
        export FAKE_WARN_TEXT="$warn" FAKE_TESTS="$tests" ORK_WARNINGS_BASELINE="$baseline"
        bash tests/run-all-tests.sh --skills
    ) > "$out" 2>&1 || rc=$?
    echo "$rc"
}
# has <transcript> <text>: the transcript, colour codes removed, contains the text.
# Written to a file first: a pipe into grep --quiet can die of SIGPIPE under pipefail.
has() {
    sed $'s/\033\\[[0-9;]*m//g' "$1" > "$TMP/plain.txt"
    grep --quiet --fixed-strings -- "$2" "$TMP/plain.txt"
}

echo "1. growth fails, a count below the line fails too (strict), only AT the line passes"
rc="$(run_fixture "$TMP/o1" 'Warnings: 268\n')"
if [[ "$rc" -ne 0 ]] && has "$TMP/o1" "Advisory warnings: 268 (baseline 267)"; then
    ok "268 against baseline 267 exits non-zero and names the count and the baseline (rc=$rc)"
else
    bad "268 against baseline 267 should exit non-zero with the count line (rc=$rc)"
fi
rc="$(run_fixture "$TMP/o2" 'Warnings: 267\n')"
if [[ "$rc" -eq 0 ]] && has "$TMP/o2" "Advisory warnings: 267 (baseline 267)"; then
    ok "267 against baseline 267 exits 0"
else
    bad "267 against baseline 267 should exit 0 (rc=$rc)"
fi
rc="$(run_fixture "$TMP/o3" 'Warnings: 266\n')"
if [[ "$rc" -ne 0 ]] && has "$TMP/o3" "Advisory warnings: 266 (baseline 267) BELOW the baseline" \
    && has "$TMP/o3" "write the line 'Skills=266' in tests/warnings-baselines.txt" \
    && has "$TMP/o3" "set WARNINGS_BASELINE to 266 in tests/run-all-tests.sh"; then
    ok "266 against baseline 267 FAILS (strict: no slack under a line) and names the exact lines to write"
else
    bad "266 against baseline 267 should fail as BELOW with the exact lines (rc=$rc)"
fi
set_baselines '# fixture\nSkills=266\n'
rc="$(run_fixture "$TMP/o3b" 'Warnings: 266\n' 200 266)"
if [[ "$rc" -eq 0 ]]; then ok "lowering both lines to 266 in the same change passes"; else bad "266 against lowered lines should pass (rc=$rc)"; fi
set_baselines '# fixture\nSkills=267\n'
rc="$(run_fixture "$TMP/o4" 'Warnings: 12\n' 200 11)"
if [[ "$rc" -ne 0 ]] && has "$TMP/o4" "Advisory warnings: 12 (baseline 11)"; then
    ok "ORK_WARNINGS_BASELINE one below the measured count fails (the planted-baseline form)"
else
    bad "ORK_WARNINGS_BASELINE=11 with 12 warnings should fail (rc=$rc)"
fi
rc="$(run_fixture "$TMP/o5" 'Warnings: 100\nWarnings: 100\nWarnings: 68\n')"
if [[ "$rc" -ne 0 ]] && has "$TMP/o5" "Advisory warnings: 268 (baseline 267)"; then
    ok "several warning lines are summed before the comparison"
else
    bad "100+100+68 should read as 268 and fail (rc=$rc)"
fi

echo "1b. every category is gated by its own baseline (row 12 ruling)"
set_baselines 'Skills=5\n'
# (the aggregate skills-block baseline is pinned to the measured count in 1b, so only the
# category line is under test)
rc="$(run_fixture "$TMP/c1" 'Warnings: 6\n' 200 6)"
if [[ "$rc" -ne 0 ]] && has "$TMP/c1" "Advisory warnings: 6 (baseline 5) GREW in category Skills"; then
    ok "a category one above its own line fails and names the category"
else
    bad "Skills=6 against its own line 5 should fail naming the category (rc=$rc)"
fi
rc="$(run_fixture "$TMP/c2" 'Warnings: 5\n' 200 5)"
if [[ "$rc" -eq 0 ]]; then ok "a category at its own line passes (negative control, the gate does not fail everything)"; else bad "Skills=5 against line 5 should pass (rc=$rc)"; fi
rc="$(run_fixture "$TMP/c3" 'Warnings: 4\n' 200 4)"
if [[ "$rc" -ne 0 ]] \
    && has "$TMP/c3" "Advisory warnings: 4 (baseline 5) BELOW the baseline in category Skills: write the line 'Skills=4' in tests/warnings-baselines.txt"; then
    ok "a category BELOW its line fails and names the category, the count, the baseline and the exact line"
else
    bad "Skills=4 against line 5 should fail as BELOW with the exact line (rc=$rc)"
fi
set_baselines 'Skills=4\n'
rc="$(run_fixture "$TMP/c3b" 'Warnings: 4\n' 200 4)"
if [[ "$rc" -eq 0 ]]; then ok "lowering the category line in the same change passes"; else bad "Skills=4 against the lowered line 4 should pass (rc=$rc)"; fi
set_baselines '# no Skills line here\nAgents=3\n'
rc="$(run_fixture "$TMP/c4" 'Warnings: 5\n' 200 5)"
if [[ "$rc" -ne 0 ]] && has "$TMP/c4" "Warnings ratchet NO BASELINE in category Skills" && ! has "$TMP/c4" "GREW"; then
    ok "a category with no baseline line fails with its own message"
else
    bad "a category with no baseline line should fail as NO BASELINE (rc=$rc)"
fi
set_baselines 'Skills=lots\n'
rc="$(run_fixture "$TMP/c5" 'Warnings: 5\n' 200 5)"
if [[ "$rc" -ne 0 ]] && has "$TMP/c5" "Warnings ratchet UNREADABLE in category Skills"; then
    ok "a non-numeric baseline line fails as UNREADABLE for that category"
else
    bad "Skills=lots should fail as UNREADABLE (rc=$rc)"
fi
set_baselines 'Skills=267\n'
rc="$(run_fixture "$TMP/c6" 'Warnings: 5\nWarnings: lots\n')"
if [[ "$rc" -ne 0 ]] && has "$TMP/c6" "Warnings ratchet UNREADABLE"; then
    ok "unreadable warning lines fail even when the baselines are fine"
else
    bad "an unreadable warning line should fail (rc=$rc)"
fi
rm -f "$FIX/tests/warnings-baselines.txt"
rc="$(run_fixture "$TMP/c7" 'Warnings: 5\n' 200 5)"
if [[ "$rc" -ne 0 ]] && has "$TMP/c7" "the baselines file" && has "$TMP/c7" "Skills"; then
    ok "a missing baselines file fails, and the table still shows the measured counts"
else
    bad "a missing baselines file should fail with its own message (rc=$rc)"
fi
set_baselines '# fixture\nSkills=267\n'

echo "2. unknown is not a pass, and each unknown has its own message"
rc="$(run_fixture "$TMP/u1" 'nothing to see\n')"
if [[ "$rc" -ne 0 ]] && has "$TMP/u1" "0 warnings were counted" && ! has "$TMP/u1" "GREW"; then
    ok "no warnings line fails with the floor message, not the growth message"
else
    bad "a transcript with no warnings line should fail with its own message (rc=$rc)"
fi
rc="$(run_fixture "$TMP/u2" 'Warnings: 5\nWarnings: lots\n')"
if [[ "$rc" -ne 0 ]] && has "$TMP/u2" "Warnings ratchet UNREADABLE" && ! has "$TMP/u2" "GREW"; then
    ok "a non-numeric warnings value fails as UNREADABLE, not as growth"
else
    bad "a non-numeric warnings value should fail as UNREADABLE (rc=$rc)"
fi
rc="$(run_fixture "$TMP/u3" 'Warnings: 5\n' 200 abc)"
if [[ "$rc" -ne 0 ]] && has "$TMP/u3" "Warnings ratchet UNREADABLE"; then
    ok "a non-numeric baseline fails as UNREADABLE"
else
    bad "a non-numeric baseline should fail as UNREADABLE (rc=$rc)"
fi
rc="$(run_fixture "$TMP/u4" 'Warnings: 5\n' 3)"
if [[ "$rc" -ne 0 ]] && has "$TMP/u4" "Skills run floor: only 3 tests ran" && ! has "$TMP/u4" "GREW"; then
    ok "too few tests fails with the floor message"
else
    bad "3 tests against the floor of 150 should fail with the floor message (rc=$rc)"
fi
rc="$(run_fixture "$TMP/u5" '' 0)"
if [[ "$rc" -ne 0 ]]; then ok "an empty transcript fails"; else bad "an empty transcript should fail (rc=$rc)"; fi

echo "3. enforcing: the gate runs in a job the required CI Summary needs"
awk '$0 == "  agent-skill-tests:" {on=1; next} on && /^  [A-Za-z0-9_-]+:$/ {exit} on {print}' "$CI_YML" > "$TMP/job.txt"
awk '$0 == "  summary:" {on=1} on && /^    needs:/ {print; exit}' "$CI_YML" > "$TMP/needs.txt"
if grep --quiet --extended-regexp '^          bash tests/run-all-tests\.sh$' "$TMP/job.txt"; then
    ok "ci.yml agent-skill-tests (Agents & Skills) runs the full tests/run-all-tests.sh"
else
    bad "ci.yml agent-skill-tests has no step running the full tests/run-all-tests.sh"
fi
if grep --quiet --extended-regexp '^    name: Agents & Skills$' "$TMP/job.txt"; then
    ok "the job keeps its check name, Agents & Skills"
else
    bad "the job must keep the name Agents & Skills (branch protection waits on it)"
fi
if grep --quiet --fixed-strings 'agent-skill-tests' "$TMP/needs.txt"; then
    ok "CI Summary needs agent-skill-tests"
else
    bad "CI Summary does not need agent-skill-tests"
fi
if grep --quiet --regexp='^    if:' "$TMP/job.txt"; then
    bad "agent-skill-tests carries an if: condition, the gate could be skipped"
else
    ok "agent-skill-tests has no job-level if: (no path filter can skip the gate)"
fi
# The full run includes the Performance category, whose down-only check needs origin/<base> (#5231).
fetch_line="$(grep --line-number --fixed-strings 'name: Fetch the base branch for the ratchet check' "$TMP/job.txt" | head -n 1 | cut -d: -f1)"
gate_line="$(grep --line-number --fixed-strings 'name: Warnings ratchet (every category)' "$TMP/job.txt" | head -n 1 | cut -d: -f1)"
if [[ -n "$fetch_line" && -n "$gate_line" && "$fetch_line" -lt "$gate_line" ]]; then
    ok "agent-skill-tests fetches the base branch before the full run"
else
    bad "agent-skill-tests must fetch the base branch before the full run (fetch line '$fetch_line', gate line '$gate_line')"
fi
if grep --quiet --fixed-strings 'BASE_REF: ${{ github.base_ref }}' "$TMP/job.txt" \
    && grep --quiet --fixed-strings 'refs/remotes/origin/${BASE_REF}' "$TMP/job.txt"; then
    ok "the base fetch takes the ref through env BASE_REF, not inline"
else
    bad "the base fetch must read github.base_ref through env BASE_REF"
fi

echo "4. the baseline only falls"
DEFAULT="$(sed -n 's/^WARNINGS_BASELINE="${ORK_WARNINGS_BASELINE:-\([0-9][0-9]*\)}".*/\1/p' "$RUNNER")"
if [[ "$DEFAULT" =~ ^[0-9]+$ ]] && [[ "$DEFAULT" -le "$BASELINE_CEILING" ]]; then
    ok "WARNINGS_BASELINE default is $DEFAULT (ceiling $BASELINE_CEILING)"
else
    bad "WARNINGS_BASELINE default '$DEFAULT' is unreadable or above $BASELINE_CEILING"
fi
# git grep exits 1 for no match and 128 for an error: only 1 is an honest "none". Comment-only
# lines may name the variable (ci.yml explains why it is never set); a code line may not.
grep_rc=0
git -C "$REPO_ROOT" grep --quiet --extended-regexp '^[[:space:]]*[^#[:space:]].*ORK_WARNINGS_BASELINE' -- .github || grep_rc=$?
if [[ "$grep_rc" -eq 1 ]]; then
    ok "no workflow sets ORK_WARNINGS_BASELINE or ORK_WARNINGS_BASELINES_FILE"
elif [[ "$grep_rc" -eq 0 ]]; then
    bad "a workflow line sets or uses ORK_WARNINGS_BASELINE"
else
    bad "git grep over .github failed (exit $grep_rc), cannot tell"
fi

echo "5. every category the runner dispatches has a baseline line, and no line is stale"
BASELINES="$REPO_ROOT/tests/warnings-baselines.txt"
# (a call may carry one VAR=value prefix, as the Orphans line does)
sed -n 's/^[[:space:]]*\([A-Z_]*=[^ ]* \)\{0,1\}run_dir "\([^"]*\)".*/\2/p; s/^[[:space:]]*run_script "\([^"]*\)".*/\1/p' "$RUNNER" > "$TMP/labels.txt"
if [[ -s "$TMP/labels.txt" ]]; then
    ok "found $(wc -l < "$TMP/labels.txt" | tr -d ' ') dispatched categories in the runner"
else
    bad "could not read any run_dir / run_script label from the runner"
fi
sed -n '/^[[:space:]]*#/d; /^[[:space:]]*$/d; s/=[^=]*$//p' "$BASELINES" > "$TMP/keys.txt"
# silent: grep -v exits 1 when every line matched, which is the pass case here (empty list)
missing="$(grep --invert-match --line-regexp --fixed-strings --file="$TMP/keys.txt" "$TMP/labels.txt" || true)"
# silent: same as above, for the stale-line direction
stale="$(grep --invert-match --line-regexp --fixed-strings --file="$TMP/labels.txt" "$TMP/keys.txt" || true)"
if [[ -z "$missing" ]]; then ok "every dispatched category has a line in tests/warnings-baselines.txt"; else bad "categories with no baseline line: $missing"; fi
if [[ -z "$stale" ]]; then ok "every baseline line names a category the runner dispatches"; else bad "baseline lines for categories that do not exist: $stale"; fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
