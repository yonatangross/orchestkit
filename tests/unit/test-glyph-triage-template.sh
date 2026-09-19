#!/usr/bin/env bash
# GH-4162: triage asks always use templates/triage.html, and the page
# carries the six-part contract plus a machine-parsable DECIDE pick.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL="$ROOT/src/skills/glyph/SKILL.md"
PAGE="$ROOT/src/skills/glyph/templates/triage.html"
fail() { echo "✗ $1"; exit 1; }

grep -q 'templates/triage.html' "$SKILL" || fail "SKILL.md does not route triage asks to the template"
grep -q 'wave=LANE followups=CSV' "$SKILL" || fail "SKILL.md does not name the pick token"
grep -q 'never `followups=0`' "$SKILL" || fail "SKILL.md still allows followups=0 for an empty pick"
grep -q 'gh pr list' "$SKILL" || fail "SKILL.md fills open PRs from the issue snapshot"
grep -q 'except the triage page' "$SKILL" || fail "inline rule still forbids the triage file"
grep -q 'other than the triage page' "$SKILL" || fail "visualize-plan still claims every file output"
grep -q '/page-serve' "$SKILL" || fail "SKILL.md does not hand the page over with page-serve"

for needle in 'class="kpis"' 'data-lane="bugs"' 'class="route"' 'Capability map' 'id="decide"' 'id="raw"' 'wave=' 'followups=' 'EXAMPLE' 'gh pr list'; do
  grep -q "$needle" "$PAGE" || fail "triage.html missing: $needle"
done

if grep -q 'followups=0' "$PAGE"; then
  fail "empty follow-ups still emit followups=0"
fi
if grep -Eq '#(4159|4162|3131)|value="(4159|4162|3131)"' "$PAGE"; then
  fail "triage.html still uses live issue numbers as sample data"
fi

# No em dash in the template. The gate and the issue both forbid it.
if grep -q $'\u2014' "$PAGE"; then
  fail "triage.html contains an em dash"
fi

echo "✓ triage template is the routed page, with a parsable DECIDE pick"
