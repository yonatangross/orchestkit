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
grep -q '/page-serve' "$SKILL" || fail "SKILL.md does not hand the page over with page-serve"

for needle in 'class="kpis"' 'data-lane="bugs"' 'class="route"' 'Capability map' 'id="decide"' 'id="raw"' 'wave=' 'followups='; do
  grep -q "$needle" "$PAGE" || fail "triage.html missing: $needle"
done

# No em dash in the template. The gate and the issue both forbid it.
if grep -q $'\u2014' "$PAGE"; then
  fail "triage.html contains an em dash"
fi

echo "✓ triage template is the routed page, with a parsable DECIDE pick"
