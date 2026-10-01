#!/usr/bin/env bash
# Test: the feature-loop effort ladder (claude.dev "Spending your effort")
#
# Interview for a spec, implement on low, review, then verify and test on high.
# Low effort also suits in-the-loop brainstorming, but only the divergent phase:
# devil's-advocate scoring keeps the session effort.
#
# Skill `effort:` frontmatter covers the whole skill, so the ladder is pinned
# here as:
#   - verify and cover carry effort: high (rung 4 applies it on its own);
#   - brainstorm and implement carry NO skill-level effort key (it would lower
#     brainstorm's Phase 4, and force every implement run, spec-complete or
#     not, to one level);
#   - brainstorm's divergent phase runs through workflows/brainstorm-diverge.js
#     (which passes effort low per call, see tests/unit/test-brainstorm-diverge.mjs)
#     and the manifest ships it;
#   - implement documents when low is right in references/effort-ladder.md.
# Changing any of these is a deliberate edit to this file.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_DIR="$REPO_ROOT/src/skills"

FAILED=0
fail() { echo "FAIL: $1"; FAILED=1; }
pass() { echo "PASS: $1"; }

# Effort from the frontmatter block only (between the first two ---).
effort_of() {
    awk '/^---$/{n++; next} n==1 && /^effort:/{print $2; exit}' "$SKILLS_DIR/$1/SKILL.md"
}

echo "=== Skill effort ladder test ==="

for skill in verify cover; do
    effort=$(effort_of "$skill")
    if [[ "$effort" == "high" ]]; then pass "$skill effort: high"; else fail "$skill effort: ${effort:-<unset>} (want high)"; fi
done

for skill in brainstorm implement; do
    effort=$(effort_of "$skill")
    if [[ -z "$effort" ]]; then pass "$skill has no skill-level effort key"; else fail "$skill effort: $effort (want no skill-level key, see the header)"; fi
done

WF="$SKILLS_DIR/brainstorm/workflows/brainstorm-diverge.js"
if [[ -f "$WF" ]]; then pass "brainstorm-diverge.js exists"; else fail "$WF not found"; fi

if grep -Fq 'skills/brainstorm/workflows/brainstorm-diverge.js' "$REPO_ROOT/manifests/ork.json"; then
    pass "manifest ships brainstorm-diverge.js"
else
    fail "manifests/ork.json does not list skills/brainstorm/workflows/brainstorm-diverge.js"
fi

if grep -Fq 'workflows/brainstorm-diverge.js' "$SKILLS_DIR/brainstorm/references/phase-workflow.md"; then
    pass "Phase 2 runs through brainstorm-diverge.js"
else
    fail "references/phase-workflow.md Phase 2 does not call brainstorm-diverge.js"
fi

if grep -Eq '^allowed-tools:.*\bWorkflow\b' "$SKILLS_DIR/brainstorm/SKILL.md"; then
    pass "brainstorm allows the Workflow tool"
else
    fail "brainstorm allowed-tools lacks Workflow"
fi

LADDER="$SKILLS_DIR/implement/references/effort-ladder.md"
if [[ -f "$LADDER" ]] && grep -Fq 'Low is right when ALL of these hold' "$LADDER" && grep -Fq '/ork:verify' "$LADDER"; then
    pass "implement documents when low is right"
else
    fail "$LADDER missing or lacks the 'Low is right' section and the verify hand-off"
fi

if grep -Fq 'references/effort-ladder.md' "$SKILLS_DIR/implement/SKILL.md"; then
    pass "implement SKILL.md points at the ladder"
else
    fail "implement SKILL.md does not reference references/effort-ladder.md"
fi

exit "$FAILED"
