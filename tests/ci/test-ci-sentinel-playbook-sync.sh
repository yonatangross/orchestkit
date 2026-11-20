#!/usr/bin/env bash
# Test: the ci-sentinel prompt's inlined playbook matches the /ci-debug table.
#
# The sentinel runs claude -p with no tools, so it cannot load /ci-debug; the
# workflow prompt carries a one-line copy of every pattern instead (the line
# that starts "Walk these patterns"). Nothing tied the two together, so a
# pattern added to /ci-debug would silently never be classified by the
# sentinel. Assertions:
#   1. both lists parse and hold at least 5 patterns (an empty or short parse
#      fails instead of passing)
#   2. same count, numbered 1..N in order in both
#   3. pattern i starts with the same word in both (case, hyphens and dots
#      folded), so a reorder or a swap is caught, not only a count change
#   4. fault arms: a copy with one pattern dropped, one with two lines
#      swapped (numbers move with them), and one with two names swapped but
#      the numbers kept in order must all fail the same comparison; the
#      name swap must fail on the name, not on the numbering
# WORKFLOW_FILE and CI_DEBUG_FILE override the paths.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="${WORKFLOW_FILE:-$REPO_ROOT/.github/workflows/ci-sentinel.yml}"
DBG="${CI_DEBUG_FILE:-$REPO_ROOT/src/skills/ci-debug/SKILL.md}"

[ -f "$WF" ] || { echo "FAIL: $WF not found"; exit 1; }
[ -f "$DBG" ] || { echo "FAIL: $DBG not found"; exit 1; }

fail=0
bad() { echo "FAIL: $1"; fail=1; }

# First word of a pattern name, folded: "Root-lockfile drift" -> "root".
fold() { printf '%s\n' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[-.]/ /g; s/^ +//' | awk '{print $1}'; }

# "<n> <first-word>" per /ci-debug table row: | 1 | **Billing block** | ...
debug_list() {
  awk -F'|' '/^[|] *[0-9]+ *[|] *[*][*]/ {
    n=$2; gsub(/ /, "", n); name=$3; gsub(/\*\*/, "", name); sub(/^ +/, "", name)
    print n "\t" name
  }' "$1" | while IFS=$'\t' read -r n name; do printf '%s %s\n' "$n" "$(fold "$name")"; done
}

# "<n> <first-word>" per item of the prompt line: "...: 1 billing block (...); 2 ..."
sentinel_list() {
  local line
  line="$(grep -m1 'Walk these patterns in order' "$1" || true)"
  [ -n "$line" ] || return 0
  printf '%s\n' "${line#*first match wins:}" | tr ';' '\n' | sed -E 's/^ +//; s/\.$//' |
    awk 'NF' | while read -r n rest; do printf '%s %s\n' "$n" "$(fold "$rest")"; done
}

# Compare two "<n> <word>" lists; print the first problem, exit 1 on any.
compare() {
  local a="$1" b="$2" na nb
  na="$(printf '%s\n' "$a" | awk 'NF' | wc -l | tr -d ' ')"
  nb="$(printf '%s\n' "$b" | awk 'NF' | wc -l | tr -d ' ')"
  [ "$na" -eq "$nb" ] || { echo "count differs: ci-debug $na, sentinel $nb"; return 1; }
  local i=1
  while read -r n w && read -r m v <&3; do
    [ "$n" = "$i" ] || { echo "ci-debug row $i is numbered $n"; return 1; }
    [ "$m" = "$i" ] || { echo "sentinel item $i is numbered $m"; return 1; }
    [ "$w" = "$v" ] || { echo "pattern $i: ci-debug '$w', sentinel '$v'"; return 1; }
    i=$((i + 1))
  done < <(printf '%s\n' "$a") 3< <(printf '%s\n' "$b")
  return 0
}

dl="$(debug_list "$DBG")"
sl="$(sentinel_list "$WF")"
ndl="$(printf '%s\n' "$dl" | awk 'NF' | wc -l | tr -d ' ')"
nsl="$(printf '%s\n' "$sl" | awk 'NF' | wc -l | tr -d ' ')"

# 1. Both parses found a real list.
[ "$ndl" -ge 5 ] || bad "ci-debug table parsed $ndl patterns (want at least 5), parse proved nothing"
[ "$nsl" -ge 5 ] || bad "sentinel prompt parsed $nsl patterns (want at least 5), parse proved nothing"

# 2 and 3. Same list.
if [ "$fail" -eq 0 ]; then
  msg="$(compare "$dl" "$sl")" || bad "sentinel playbook copy drifted from /ci-debug: $msg"
fi

# 4. Fault arms: the comparison must reject a drop and a swap.
if [ "$fail" -eq 0 ]; then
  dropped="$(printf '%s\n' "$sl" | sed '$d')"
  compare "$dl" "$dropped" > /dev/null && bad "fault arm: a dropped pattern still compared equal"
  swapped="$(printf '%s\n' "$sl" | awk 'NR==2{a=$0; next} NR==3{print; print a; next} {print}')"
  compare "$dl" "$swapped" > /dev/null && bad "fault arm: two swapped patterns still compared equal"
  # Names 2 and 3 trade places, numbers stay 1..N, so only the name check can catch it.
  renamed="$(printf '%s\n' "$sl" | awk 'NR==2{n2=$1; w2=$2; next} NR==3{print n2, $2; print $1, w2; next} {print}')"
  if msg="$(compare "$dl" "$renamed")"; then
    bad "fault arm: two swapped names with numbers kept still compared equal"
  else
    case "$msg" in
      "pattern 2:"*) ;;
      *) bad "fault arm: name swap failed for the wrong reason: $msg" ;;
    esac
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: ci-sentinel playbook copy matches /ci-debug ($ndl patterns)"
fi
exit "$fail"
