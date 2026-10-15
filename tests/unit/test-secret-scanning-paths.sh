#!/usr/bin/env bash
# .github/secret_scanning.yml may exempt test folders only.
#
# The hook tests under src/hooks/src/__tests__/ feed realistic fake
# credentials into the redaction code (alerts 5 to 10, #4763), so that
# folder is exempt from GitHub secret scanning. Every paths-ignore entry
# must sit inside a tests folder (__tests__, tests or fixtures): an entry
# such as "**" or "src/**" would silently turn scanning off for real code.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFG="$ROOT/.github/secret_scanning.yml"

PASS=0
FAILS=0
fail() { echo "✗ $1"; FAILS=$((FAILS + 1)); }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

# Prints the paths-ignore entries of a secret_scanning.yml, one per line,
# quotes stripped. Comment lines are skipped.
entries() {
  awk '
    /^[[:space:]]*#/ { next }
    /^paths-ignore:/ { inlist = 1; next }
    /^[^[:space:]-]/ { inlist = 0 }
    inlist && /^[[:space:]]*-[[:space:]]*/ {
      v = $0
      sub(/^[[:space:]]*-[[:space:]]*/, "", v)
      sub(/[[:space:]]+#.*$/, "", v)
      gsub(/["\047]/, "", v)
      print v
    }' "$1"
}

# Prints one problem per entry that is not inside a tests folder.
check_entries() {
  local e
  while IFS= read -r e; do
    [[ -n "$e" ]] || continue
    case "/$e" in
      */__tests__/*|*/tests/*|*/fixtures/*) ;;
      *) printf 'entry "%s" is not inside a tests folder\n' "$e" ;;
    esac
  done
}

# Self-check: broad entries are flagged, the test folder passes.
bad="$(printf '%s\n' '**' 'src/**' 'src/hooks/src/lib/**' | check_entries)"
if [[ "$(printf '%s\n' "$bad" | awk 'NF { n++ } END { print n + 0 }')" == 3 ]]; then
  ok "self-check: **, src/** and a lib folder are flagged"
else
  fail "self-check: broad entries were not all flagged: ${bad:-nothing}"
fi
good="$(printf '%s\n' 'src/hooks/src/__tests__/**' | check_entries)"
if [[ -z "$good" ]]; then
  ok "self-check: src/hooks/src/__tests__/** passes"
else
  fail "self-check: the test folder was flagged: $good"
fi

if [[ ! -f "$CFG" ]]; then
  fail ".github/secret_scanning.yml is missing, so the hook test fixtures keep raising alerts"
else
  list="$(entries "$CFG")"
  if printf '%s\n' "$list" | awk '$0 == "src/hooks/src/__tests__/**" { f = 1 } END { exit !f }'; then
    ok "src/hooks/src/__tests__/** is exempt"
  else
    fail "src/hooks/src/__tests__/** is not in paths-ignore: ${list:-empty list}"
  fi
  problems="$(printf '%s\n' "$list" | check_entries)"
  if [[ -z "$problems" ]]; then
    ok "every paths-ignore entry sits inside a tests folder"
  else
    while IFS= read -r p; do fail "$p"; done <<< "$problems"  # pipebuf: bounded-small (one short line per config entry)
  fi
fi

echo "  $PASS passed, $FAILS failed"
[[ "$FAILS" == 0 ]] || exit 1
