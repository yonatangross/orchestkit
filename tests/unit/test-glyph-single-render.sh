#!/usr/bin/env bash
# GH-4159 defect 2: glyph and ork:glyph are one skill.
# The front door must render itself, never hand off to a second invocation.
# Width (defect 1) is pinned by test-glyph-non-tty-width.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL="$ROOT/src/skills/glyph/SKILL.md"
RULE="$ROOT/src/skills/glyph/rules/visual-style.md"
FEATURED="$ROOT/src/skills/glyph/examples/_featured.md"

fail() { echo "✗ $1"; exit 1; }

grep -q 'Do not call the Skill tool for `glyph`, `/glyph`, or `/ork:glyph`' "$SKILL" \
  || fail "SKILL.md does not forbid a second glyph invocation"
grep -q 'The front door does not delegate' "$SKILL" \
  || fail "SKILL.md still allows the front door to hand off"

grep -q 'do not invoke the other' "$RULE" \
  || fail "shipped visual-style rule still tells a loaded glyph to re-invoke"

if grep -q 'the front door: same dials, may route' "$FEATURED"; then
  fail "featured examples still describe /glyph as a router into another skill"
fi
grep -q 'same skill as /ork:glyph; renders here, does not hand off' "$FEATURED" \
  || fail "featured examples do not state that /glyph renders in place"

echo "✓ glyph front door renders once; it does not hand off to ork:glyph"
