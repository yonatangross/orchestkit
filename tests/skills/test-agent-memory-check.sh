#!/usr/bin/env bash
# Fixture tests for src/skills/doctor/scripts/check-agent-memory.sh
# One case per check: orphan, staleness, size, secret. Plus a clean tree
# and an old MEMORY.md whose agent did not run (must not be called stale).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHECK="$ROOT/src/skills/doctor/scripts/check-agent-memory.sh"
[[ -x "$CHECK" ]] || { echo "FAIL: $CHECK not executable"; exit 1; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork-agent-mem.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

# Fixed clock: 2026-09-19 00:00:00 UTC
NOW=1758240000
DAY=86400

write_agent() {
  local dir="$1" name="$2"
  mkdir -p "$dir"
  printf '%s\n' '---' "name: $name" '---' '' "body for $name" > "$dir/$name.md"
}

fresh() {
  rm -rf "$TMP/mem" "$TMP/agents" "$TMP/activity"
  mkdir -p "$TMP/mem" "$TMP/agents"
  write_agent "$TMP/agents" scribe
}

run() {
  set +e
  OUT=$("$CHECK" --memory-root "$TMP/mem" --agents-dir "$TMP/agents" --now "$NOW" "$@")
  RC=$?
  set -e
}

# --- clean ---
fresh
mkdir -p "$TMP/mem/scribe"
printf 'short note\n' > "$TMP/mem/scribe/MEMORY.md"
python3 -c 'import os,sys; os.utime(sys.argv[1], (int(sys.argv[2]), int(sys.argv[2])))' \
  "$TMP/mem/scribe/MEMORY.md" "$((NOW - DAY))"
printf 'scribe\t%s\n' "$((NOW - 2 * DAY))" > "$TMP/activity"
run --activity-file "$TMP/activity" --stale-days 14
if [[ "$RC" -eq 0 ]] && grep -q 'OK agent-memory' <<< "$OUT"; then ok "clean tree"; else bad "clean tree rc=$RC out=$OUT"; fi

# --- orphan ---
fresh
mkdir -p "$TMP/mem/ghost" "$TMP/mem/scribe"
printf 'ok\n' > "$TMP/mem/scribe/MEMORY.md"
printf 'orphan note\n' > "$TMP/mem/ghost/MEMORY.md"
run
if [[ "$RC" -eq 1 ]] && grep -q 'ORPHAN ghost' <<< "$OUT"; then ok "orphan dir"; else bad "orphan dir rc=$RC out=$OUT"; fi

# --- stale: old file, agent ran after the write ---
fresh
mkdir -p "$TMP/mem/scribe"
printf 'old\n' > "$TMP/mem/scribe/MEMORY.md"
python3 -c 'import os,sys; os.utime(sys.argv[1], (int(sys.argv[2]), int(sys.argv[2])))' \
  "$TMP/mem/scribe/MEMORY.md" "$((NOW - 40 * DAY))"
printf 'scribe\t%s\n' "$((NOW - DAY))" > "$TMP/activity"
run --activity-file "$TMP/activity" --stale-days 14
if [[ "$RC" -eq 1 ]] && grep -q 'STALE scribe/MEMORY.md' <<< "$OUT"; then ok "stale after a later run"; else bad "stale rc=$RC out=$OUT"; fi

# --- old file, agent did not run after the write: not stale ---
fresh
mkdir -p "$TMP/mem/scribe"
printf 'old but idle\n' > "$TMP/mem/scribe/MEMORY.md"
python3 -c 'import os,sys; os.utime(sys.argv[1], (int(sys.argv[2]), int(sys.argv[2])))' \
  "$TMP/mem/scribe/MEMORY.md" "$((NOW - 40 * DAY))"
printf 'scribe\t%s\n' "$((NOW - 50 * DAY))" > "$TMP/activity"
run --activity-file "$TMP/activity" --stale-days 14
if [[ "$RC" -eq 0 ]]; then ok "idle agent is not stale"; else bad "idle agent rc=$RC out=$OUT"; fi

# --- size ---
fresh
mkdir -p "$TMP/mem/scribe"
python3 -c 'print("\n".join(["line"]*160), end="\n")' > "$TMP/mem/scribe/MEMORY.md"
run --warn-lines 150
if [[ "$RC" -eq 1 ]] && grep -q 'SIZE scribe/MEMORY.md: 160 lines' <<< "$OUT"; then ok "size warn at 150"; else bad "size rc=$RC out=$OUT"; fi

# --- secret ---
fresh
mkdir -p "$TMP/mem/scribe"
printf 'token ghp_abcdefghijklmnopqrstuvwxyz012345\n' > "$TMP/mem/scribe/MEMORY.md"
run
if [[ "$RC" -eq 1 ]] && grep -q 'SECRET scribe/MEMORY.md' <<< "$OUT"; then ok "secret backstop"; else bad "secret rc=$RC out=$OUT"; fi

echo
echo "passed=$PASS failed=$FAIL"
[[ "$FAIL" -eq 0 ]]
