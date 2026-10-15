#!/usr/bin/env bash
# .github/secret_scanning.yml may exempt only the approved fixture files.
#
# The hook tests feed realistic fake credentials into the redaction code
# (alerts 5 to 10, #4763). Those fakes must keep a real scanner shape, so
# they live in dedicated fixture files that hold only reviewed fake values,
# and paths-ignore may name those files only. A directory or glob entry
# exempts every current and future file under it: a real credential pasted
# there would be closed as ignored by configuration instead of alerting.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFG="$ROOT/.github/secret_scanning.yml"

# The only paths .github/secret_scanning.yml may exempt. Each is a dedicated
# fixture file that holds reviewed fake values. Adding an exemption means
# updating this list and the config in the same commit.
APPROVED=(
  "src/hooks/src/__tests__/fixtures/positive-seeds.ts"
  "src/hooks/src/__tests__/fixtures/secret-scanning-fixtures.ts"
)

PASS=0
FAILS=0
fail() { echo "✗ $1"; FAILS=$((FAILS + 1)); }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

approved() {
  local e="$1" a
  for a in "${APPROVED[@]}"; do
    [[ "$e" == "$a" ]] && return 0
  done
  return 1
}

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

# Prints one problem per entry that is not an approved literal fixture file.
check_entries() {
  local e
  while IFS= read -r e; do
    [[ -n "$e" ]] || continue
    if ! approved "$e"; then
      printf 'entry "%s" is not an approved fixture file\n' "$e"
      continue
    fi
    case "$e" in
      *[\*\?\[]*)
        printf 'entry "%s" is a glob, only literal file paths are allowed\n' "$e"
        continue
        ;;
    esac
    if [[ ! -f "$ROOT/$e" ]]; then
      printf 'entry "%s" does not name a regular file\n' "$e"
    fi
  done
}

# Self-check: broad, glob and unlisted entries are flagged, an approved
# fixture file passes. The __tests__ glob is the regression this test guards.
bad="$(printf '%s\n' '**' 'src/**' 'src/hooks/src/lib/**' 'src/hooks/src/__tests__/**' 'src/hooks/src/__tests__/fixtures/**' 'src/hooks/src/__tests__/live.env' | check_entries)"
if [[ "$(printf '%s\n' "$bad" | awk 'NF { n++ } END { print n + 0 }')" == 6 ]]; then
  ok "self-check: broad, glob and unlisted entries are flagged"
else
  fail "self-check: bad entries were not all flagged: ${bad:-nothing}"
fi
good="$(printf '%s\n' "${APPROVED[0]}" | check_entries)"
if [[ -z "$good" ]]; then
  ok "self-check: an approved fixture file passes"
else
  fail "self-check: an approved fixture file was flagged: $good"
fi

if [[ ! -f "$CFG" ]]; then
  fail ".github/secret_scanning.yml is missing, so the hook test fixtures keep raising alerts"
else
  list="$(entries "$CFG")"
  if [[ -z "$list" ]]; then
    fail "paths-ignore is empty in .github/secret_scanning.yml"
  fi
  problems="$(printf '%s\n' "$list" | check_entries)"
  if [[ -z "$problems" && -n "$list" ]]; then
    ok "every paths-ignore entry is an approved fixture file"
  else
    while IFS= read -r p; do [[ -n "$p" ]] && fail "$p"; done <<< "$problems"
  fi
fi

echo "  $PASS passed, $FAILS failed"
[[ "$FAILS" == 0 ]] || exit 1
