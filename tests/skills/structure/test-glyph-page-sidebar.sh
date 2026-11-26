#!/usr/bin/env bash
# strict-mode: opt-out each check is a match that may miss; the suite counts every miss and exits non-zero at the end
# test-glyph-page-sidebar.sh: the glyph page route keeps its section sidebar a thin index (#5421).
#
# A long status page built on the page route got a 230px sticky sidebar with
# 14px links and no max-height: with 16 sections it was taller than the
# viewport, the last links were unreachable without scrolling to the end, and
# tables lost width. The route said nothing about a sidebar, so every page
# invented its own. This pins the limits in both places a page is built from:
#   1. references/page-route.md carries the rule (width cap, compact links,
#      never taller than the viewport, chips above 12 sections).
#   2. templates/explainer.html ships a .rail baseline that obeys it.
# Matching is bash =~ on a variable: no pipes or here-strings (ork#3348).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROUTE="$ROOT/src/skills/glyph/references/page-route.md"
TPL="$ROOT/src/skills/glyph/templates/explainer.html"

pass=0
fail=0
ok() { pass=$((pass + 1)); echo "  PASS $1"; }
bad() { fail=$((fail + 1)); echo "  FAIL $1"; }
has() { [[ -f "$1" ]] && grep -qF -- "$2" "$1"; }

echo "glyph page sidebar limits (#5421)"

# 1. The rule in the page route.
if has "$ROUTE" '## Section sidebar'; then ok "page-route.md has a Section sidebar rule"; else bad "page-route.md has no '## Section sidebar' rule"; fi
for needle in '170px' 'max-height:calc(100vh - 24px)' 'overflow-y:auto' 'more than 12 sections'; do
  if has "$ROUTE" "$needle"; then ok "rule names $needle"; else bad "rule does not name $needle"; fi
done

# 2. The baseline in the template. Pull the .rail block out of the <style> and
#    read its numbers, so a later edit cannot widen it without failing here.
if [[ ! -f "$TPL" ]]; then
  bad "template missing: $TPL"
  echo "  $pass passed, $fail failed"
  exit 1
fi
css="$(tr -d '\n' < "$TPL")"

re_rail='\.rail\{([^}]*)\}'
re_link='\.rail a\{([^}]*)\}'
re_width='(^|[;{ ])width:([0-9.]+)px'
re_size='font-size:([0-9.]+)px'
re_chips='\.rail\.chips\{'

rail=''
if [[ "$css" =~ $re_rail ]]; then rail="${BASH_REMATCH[1]}"; ok "template has a .rail rule"; else bad "template has no .rail rule"; fi

width=''
if [[ ";$rail" =~ $re_width ]]; then width="${BASH_REMATCH[2]}"; fi
if [[ -n "$width" ]] && awk -v w="$width" 'BEGIN{exit !(w <= 170)}'; then
  ok ".rail width ${width}px <= 170px"
else
  bad ".rail width '${width:-none}' is missing or over 170px"
fi
if [[ "$rail" == *'position:sticky'* ]]; then ok ".rail is sticky"; else bad ".rail is not sticky"; fi
if [[ "$rail" == *'max-height:calc(100vh - 24px)'* ]]; then ok ".rail never taller than the viewport"; else bad ".rail has no max-height:calc(100vh - 24px)"; fi
if [[ "$rail" == *'overflow-y:auto'* ]]; then ok ".rail scrolls on its own"; else bad ".rail has no overflow-y:auto"; fi

size=''
if [[ "$css" =~ $re_link ]]; then
  link="${BASH_REMATCH[1]}"
  if [[ "$link" =~ $re_size ]]; then size="${BASH_REMATCH[1]}"; fi
fi
if [[ -n "$size" ]] && awk -v s="$size" 'BEGIN{exit !(s <= 13)}'; then
  ok ".rail link font ${size}px <= 13px"
else
  bad ".rail link font '${size:-none}' is missing or over 13px"
fi

# 3. Many sections fold into a chip row instead of a tall column.
if [[ "$css" =~ $re_chips ]]; then ok "template has the .rail.chips row"; else bad "template has no .rail.chips row for long pages"; fi

echo "  $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
