#!/usr/bin/env bash
# strict-mode: opt-out each check is a grep that may miss; the suite counts every miss and exits non-zero at the end
# test-glyph-dials.sh: contract for the glyph output modes (ork-output-modes-2026-10-06).
#
# Guards four promises that drifted apart before this test existed:
#   1. ork:glyph documents the two dials (surface, audience), the announce line,
#      and every flag it accepts in argument-hint.
#   2. The docs page for glyph never advertises a flag the skill does not accept
#      (the old page promised --eli5 while the skill had no dial logic).
#   3. The done sign-off rule carries the three exact option labels, and
#      ork:verify loads it.
#   4. The output modes guide lists exactly the display env vars that the hook
#      sources read, and ships its approved mockup and data.json.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
GLYPH="$ROOT/src/skills/glyph/SKILL.md"
DIALS="$ROOT/src/skills/glyph/references/dials.md"
GLYPH_MDX="$ROOT/docs/site/content/docs/reference/skills/glyph.mdx"
SIGNOFF="$ROOT/src/shared/rules/done-signoff.md"
VERIFY="$ROOT/src/skills/verify/SKILL.md"
GUIDE_DIR="$ROOT/docs/site/content/docs/guides/output-modes"
GUIDE="$GUIDE_DIR/index.mdx"
DATA="$GUIDE_DIR/data.json"
HOOKS_SRC="$ROOT/src/hooks/src"

FLAGS=(--chat --ask --page --eli5 --decide --signoff)
LABELS=("Accept done" "Show me the evidence" "Not satisfied")

pass=0
fail=0
ok() { pass=$((pass + 1)); echo "  PASS $1"; }
bad() { fail=$((fail + 1)); echo "  FAIL $1"; }
# has FILE PATTERN: fixed-string match; a missing file is a plain miss, reported by the caller.
has() { [[ -f "$1" ]] && grep -qF -- "$2" "$1"; }

echo "glyph dials contract"

hint="$(grep -m1 '^argument-hint:' "$GLYPH")"
for f in "${FLAGS[@]}"; do
  if [[ "$hint" == *"$f"* ]]; then ok "argument-hint has $f"; else bad "argument-hint lacks $f"; fi
done

tools="$(grep -m1 '^allowed-tools:' "$GLYPH")"
for t in AskUserQuestion Write; do
  if [[ "$tools" == *"$t"* ]]; then ok "allowed-tools has $t"; else bad "allowed-tools lacks $t"; fi
done

if has "$GLYPH" '→ chat · operator'; then ok "announce line documented"; else bad "announce line '→ chat · operator' missing from SKILL.md"; fi
if grep -qi 'are one skill' "$GLYPH"; then bad "SKILL.md still claims glyph and ork:glyph are one skill"; else ok "no one-skill claim"; fi
if [[ -f "$DIALS" ]]; then ok "references/dials.md exists"; else bad "references/dials.md missing"; fi

# Broken-promise guard: every flag shown after /ork:glyph on the docs page must be accepted.
if [[ -f "$GLYPH_MDX" ]]; then
  mapfile -t docs_flags < <(grep -oE '/ork:glyph( +--[a-z0-9-]+)+' "$GLYPH_MDX" | grep -oE -- '--[a-z0-9-]+' | sort -u)
  if [[ "${#docs_flags[@]}" -eq 0 ]]; then bad "docs page shows no /ork:glyph flag at all"; fi
  for flag in "${docs_flags[@]}"; do
    if [[ "$hint" == *"$flag"* ]]; then ok "docs flag $flag is accepted"; else bad "docs advertise $flag, skill does not accept it"; fi
  done
  if grep -qi 'same skill as /ork:glyph' "$GLYPH_MDX"; then bad "docs still say /glyph is the same skill"; else ok "docs drop the same-skill claim"; fi
else
  bad "glyph.mdx missing"
fi

# Done sign-off rule.
for l in "${LABELS[@]}"; do
  if has "$SIGNOFF" "\"$l\""; then ok "sign-off label '$l'"; else bad "sign-off label '$l' missing from $SIGNOFF"; fi
done
if has "$VERIFY" 'shared/rules/done-signoff.md'; then ok "verify loads done-signoff"; else bad "verify does not load done-signoff"; fi
if has "$GLYPH" 'shared/rules/done-signoff.md' || has "$DIALS" 'shared/rules/done-signoff.md'; then
  ok "glyph --signoff loads done-signoff"
else
  bad "glyph does not point --signoff at done-signoff"
fi

# Output modes guide: env var table matches the hook sources.
if [[ -f "$GUIDE" ]]; then
  mapfile -t vars < <(grep -oE '^\| `(ORK|ORCHESTKIT)_[A-Z_]+' "$GUIDE" | tr -d '|` ' | sort -u)
  if [[ "${#vars[@]}" -eq 16 ]]; then ok "guide lists 16 display env vars"; else bad "guide lists ${#vars[@]} display env vars, want 16"; fi
  for v in "${vars[@]}"; do
    if grep -rqF --include='*.ts' -- "$v" "$HOOKS_SRC"; then ok "$v is read by a hook"; else bad "$v is not read by any hook in src/hooks/src"; fi
  done
else
  bad "docs/site/content/docs/guides/output-modes/index.mdx missing"
fi
if [[ -s "$GUIDE_DIR/approved-design/mockup.txt" ]]; then ok "approved mockup saved"; else bad "approved-design/mockup.txt missing"; fi
if has "$DATA" '"serves": "ork-output-modes-2026-10-06"'; then ok "data.json serves the card"; else bad "data.json with serves missing"; fi

echo "glyph dials: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
