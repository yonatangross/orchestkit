#!/usr/bin/env bash
# Test: every Dependabot ecosystem entry carries a 14-day cooldown.
#
# The org supply-chain floor (conductor ruling 2026-11-02) is that no package
# younger than 14 days lands in a lockfile. Dependabot opened bumps for packages
# published days earlier, so the floor has to live in the config itself:
#   cooldown:
#     default-days: 14
# A semver-specific key left unset falls back to default-days, so one key covers
# major, minor and patch. Security updates are not delayed by cooldown.
#
# Two assertions:
#   1. at least one `- package-ecosystem:` entry exists (a parse that finds zero
#      entries must not pass as "all entries have a cooldown")
#   2. every entry has `cooldown:` with `default-days: 14` before the next entry

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPENDABOT="${DEPENDABOT_FILE:-$REPO_ROOT/.github/dependabot.yml}"

if [ ! -f "$DEPENDABOT" ]; then
  echo "FAIL: $DEPENDABOT not found"
  exit 1
fi

REPORT_FILE="$(mktemp "${TMPDIR:-/tmp}/ork.XXXXXX")"
trap 'rm -f "$REPORT_FILE"' EXIT

# One line per entry: "<ecosystem> <directory> cooldown=<0|1> default-days=<n|none>",
# then a final "ENTRIES <n>" line.
awk '
  function flush() {
    printf "%s %s cooldown=%s default-days=%s\n", name, dir, has_cd, (days == "" ? "none" : days)
  }
  /^[[:space:]]*-[[:space:]]+package-ecosystem:/ {
    if (n > 0) flush()
    n++
    name = $0
    sub(/^[[:space:]]*-[[:space:]]+package-ecosystem:[[:space:]]*/, "", name)
    gsub(/"/, "", name)
    dir = ""
    in_cd = 0; has_cd = 0; days = ""
    next
  }
  n > 0 && /^[[:space:]]+directory:/ {
    dir = $0
    sub(/^[[:space:]]+directory:[[:space:]]*/, "", dir)
    gsub(/"/, "", dir)
    next
  }
  n > 0 && /^[[:space:]]+cooldown:[[:space:]]*$/ { has_cd = 1; in_cd = 1; next }
  n > 0 && in_cd && /^[[:space:]]+default-days:/ {
    days = $0
    sub(/^[[:space:]]+default-days:[[:space:]]*/, "", days)
    sub(/[[:space:]]*#.*$/, "", days)
    next
  }
  n > 0 && in_cd && /^    [a-z-]+:/ { in_cd = 0 }
  END { if (n > 0) flush(); print "ENTRIES " n + 0 }
' "$DEPENDABOT" > "$REPORT_FILE"

ENTRIES="$(awk '$1 == "ENTRIES" {print $2}' "$REPORT_FILE")"
if [ "${ENTRIES:-0}" -lt 1 ]; then
  echo "FAIL: no package-ecosystem entries found in $DEPENDABOT"
  exit 1
fi
echo "entries found: $ENTRIES"

FAILED=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  case "$line" in
    ENTRIES*) ;;
    *"cooldown=1 default-days=14") echo "PASS: $line" ;;
    *) echo "FAIL: $line (want a cooldown block with default-days: 14)"; FAILED=1 ;;
  esac
done < "$REPORT_FILE"

if [ "$FAILED" -ne 0 ]; then
  echo "FAILED: every Dependabot ecosystem needs cooldown default-days: 14"
  exit 1
fi
echo "OK: all $ENTRIES Dependabot ecosystems have a 14-day cooldown"
