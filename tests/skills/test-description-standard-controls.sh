#!/usr/bin/env bash
# Controls for the skill description checks (orchestkit row 11, 2026-11-13).
#
# After #5043 the four description checks were changed to judge a description by the
# shared standard in tests/fixtures/description-standard.sh. A check that only ever
# goes quiet proves nothing, so this test plants descriptions and runs the REAL check
# scripts over them (through ORK_SKILLS_DIR and ORK_TRIGGER_CASES):
#   - a description that follows the #5043 shape must NOT be warned about,
#   - a description that really lacks trigger words MUST still be warned about,
#   - a skill whose name carries the query words must be matched through its name.
# Each assertion selects the check's own line for the planted skill by name, so one
# check's output cannot satisfy another's assertion.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../fixtures/description-standard.sh
source "$REPO_ROOT/tests/fixtures/description-standard.sh"

DISCOVERY="$REPO_ROOT/tests/skills/semantic-matching/test-skill-discovery.sh"
TRIGGERS="$REPO_ROOT/tests/skills/test-description-triggers.sh"
SKILL_MD="$REPO_ROOT/tests/skills/structure/test-skill-md.sh"
TRIGGERING="$REPO_ROOT/tests/skills/triggering/test-skill-triggering.sh"

PASS=0
FAIL=0
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork.descstd.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Part 1: the shared phrase rule itself
# ---------------------------------------------------------------------------
echo "Phrase rule: standard-shaped openings are triggers, a bare routing boundary is not"
for d in \
    "Rates code. Use when evaluating options." \
    "Maps a repo. Use to map an unfamiliar repo." \
    "Audits a tree. Use before a release." \
    "Syncs notes. Use after tagging a release." \
    "Opens a PR. Use only when asked for this skill." \
    "Shows status. Use for status or rankings." \
    "Does a thing. Triggers on build errors." \
    "Does a thing. Activates for new repos."; do
    if description_has_trigger_phrase "$d"; then ok "trigger: $d"; else bad "should be a trigger: $d"; fi
done
for d in \
    "Async Python: asyncio TaskGroup, FastAPI. Not for the API contract (use api-design)." \
    "Does stuff." \
    "For Storybook MCP tools alone, use storybook-mcp-integration." \
    "Reuse existing components. Misuse of the word is not a trigger."; do
    if description_has_trigger_phrase "$d"; then bad "should NOT be a trigger: $d"; else ok "not a trigger: $d"; fi
done

# ---------------------------------------------------------------------------
# Part 2: the real checks over a planted skills tree
# ---------------------------------------------------------------------------
SKILLS="$TMP/skills"
mkdir -p "$SKILLS/planted-good" "$SKILLS/planted-bad" "$SKILLS/frobnicate-sprockets"

write_skill() {
    local dir="$1" name="$2" desc="$3"
    printf -- '---\nname: %s\ndescription: "%s"\nuser-invocable: false\nversion: 1.0.0\n---\n\n# %s\n\n```bash\necho planted\n```\n' \
        "$name" "$desc" "$name" > "$SKILLS/$dir/SKILL.md"
}

# Follows the #5043 shape: no skill name inside, a Use when sentence, a Not for boundary.
write_skill planted-good planted-good "Rates widgets across quality dimensions. Use when you compare or evaluate widgets. Not for building them (use other-skill)."
# Really lacks trigger words, and says nothing about its name.
write_skill planted-bad planted-bad "Handles various miscellaneous things in a generic manner without any further detail whatsoever."
# Trigger phrase present, but the query words live only in the skill name.
write_skill frobnicate-sprockets frobnicate-sprockets "Adjusts gears and levers on request. Use when a machine needs tuning."

CASES="$TMP/trigger-cases.yaml"
cat > "$CASES" <<'EOF'
skills:
  planted-good:
    should_trigger:
      - "compare widgets"
      - "evaluate widgets"
    should_not_trigger:
      - "bake bread recipes"
  planted-bad:
    should_trigger:
      - "quantize sprockets"
    should_not_trigger:
      - "bake bread recipes"
  frobnicate-sprockets:
    should_trigger:
      - "frobnicate sprockets"
    should_not_trigger:
      - "bake bread recipes"
EOF

run_check() {
    local script="$1" out
    # silent: gating-relaxed (a check exits 1 when it finds a failure; its output is what is asserted)
    out="$(ORK_SKILLS_DIR="$SKILLS" ORK_TRIGGER_CASES="$CASES" bash "$script" 2>&1)" || true
    printf '%s' "$out"
}

assert_has() {
    local label="$1" out="$2" needle="$3"
    if [[ "$out" == *"$needle"* ]]; then ok "$label"; else bad "$label (missing: $needle)"; fi
}
assert_lacks() {
    local label="$1" out="$2" needle="$3"
    if [[ "$out" == *"$needle"* ]]; then bad "$label (unexpected: $needle)"; else ok "$label"; fi
}

echo "test-skill-discovery.sh"
OUT="$(run_check "$DISCOVERY")"
assert_has   "discovery checked the 3 planted skills" "$OUT" "Checked:  3 skills"
assert_has   "discovery warns: bad description has no trigger phrasing" "$OUT" "WARN: planted-bad - Missing trigger phrasing"
assert_has   "discovery warns: bad description has no name or fragment" "$OUT" "WARN: planted-bad - Description does not mention skill name or fragments"
assert_lacks "discovery is quiet on the #5043-shaped description" "$OUT" "WARN: planted-good"
assert_lacks "discovery is quiet on the name-only skill (it has a trigger phrase)" "$OUT" "WARN: frobnicate-sprockets"

echo "test-description-triggers.sh"
OUT="$(run_check "$TRIGGERS")"
assert_has   "triggers checked the 3 planted skills" "$OUT" "Checked: 3 skills"
assert_has   "triggers warns on the bad description" "$OUT" "WARN: planted-bad - Missing trigger keywords"
assert_lacks "triggers is quiet on the #5043-shaped description" "$OUT" "WARN: planted-good"

echo "test-skill-md.sh (Test 5)"
OUT="$(run_check "$SKILL_MD")"
assert_has   "skill-md warns on the bad description" "$OUT" "WARN planted-bad: Missing Overview section and no trigger phrases in description"
assert_lacks "skill-md is quiet on the #5043-shaped description" "$OUT" "WARN planted-good: Missing Overview"

echo "test-skill-triggering.sh"
OUT="$(run_check "$TRIGGERING")"
assert_has   "triggering scores the bad description 0 percent" "$OUT" "FAIL: planted-bad - Trigger keyword score: 0%"
assert_has   "triggering passes the good description" "$OUT" "PASS: planted-good - Trigger keyword score: 100%"
assert_has   "triggering matches query words through the skill name" "$OUT" "PASS: frobnicate-sprockets - Trigger keyword score: 100%"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
