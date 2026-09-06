#!/usr/bin/env bash
# Gate: tests/plugins/test-build-drift.sh
# Pass condition: DRIFTED == 0 (line 141). Sections A to D are four `for` loops over
# src/skills/*/SKILL.md, src/agents/*.md, src/skills/*/{rules,references}/*.md and
# src/hooks/dist/*.mjs. Each compares a SOURCE file against its built twin, so an
# empty source tree yields zero comparisons and cannot drift.
# Section E is the one hardcoded check, and it reads only the plugins/ side.
#
# SECTION B IS EXCLUDED FROM THIS PROBE, with cause. It runs
#   head -n "$src_lines" "$dest_agent" | diff -q - "$src_agent"
# and Apple diff (FreeBSD) cannot read "-" from a pipe at all:
#   $ printf a | diff -q - file   ->  "diff: -: Operation not permitted", rc 2
# So on macOS section B reports every agent as CHANGED unconditionally. Measured on
# the real repo: 36 of 36 agents flagged, gate exits 1. That is a fail-CLOSED defect,
# not the fails-open shape, and it would mask the arms below. Both fixture trees
# therefore carry no agents.
set -uo pipefail

REPO="${REPO:?set by the fault-arms runner}"
FIX="$H/fixtures/build-drift"
NUDGE_REF="skills/doctor/references/version-compatibility.md"
NUDGE_URL="https://github.com/yonatangross/orchestkit/issues?q=is%3Aissue%20label%3Acc-adoption"

build_arm() {
  local arm="$1" populate_src="$2"
  local root="$FIX/$arm"
  mkdir -p "$root/tests/plugins" \
           "$root/src/skills" "$root/src/agents" "$root/src/hooks/dist" \
           "$root/plugins/ork/skills/doctor/references" \
           "$root/plugins/ork/agents" "$root/plugins/ork/hooks/dist"
  cp "$REPO/tests/plugins/test-build-drift.sh" "$root/tests/plugins/"

  # The plugins/ side is fully built in EVERY arm. Only the src/ side varies.
  printf -- '---\nname: doctor\ndescription: d\n---\nbody\n' \
    > "$root/plugins/ork/skills/doctor/SKILL.md"
  printf 'compat table\n' > "$root/plugins/ork/skills/doctor/references/version-compatibility.md"
  printf 'const REF="%s";const FALLBACK="%s";\n' "$NUDGE_REF" "$NUDGE_URL" \
    > "$root/plugins/ork/hooks/dist/lifecycle.mjs"

  if [[ "$populate_src" == "yes" ]]; then
    mkdir -p "$root/src/skills/doctor/references"
    cp "$root/plugins/ork/skills/doctor/SKILL.md" "$root/src/skills/doctor/SKILL.md"
    cp "$root/plugins/ork/skills/doctor/references/version-compatibility.md" \
       "$root/src/skills/doctor/references/version-compatibility.md"
    cp "$root/plugins/ork/hooks/dist/lifecycle.mjs" "$root/src/hooks/dist/lifecycle.mjs"
  fi
}

rm -rf "$FIX"
build_arm control yes
build_arm fault no      # src/skills, src/hooks/dist exist and are EMPTY
build_arm fault2 yes
# fault2 is the negative control: real drift between the two layers must be caught.
printf -- '---\nname: doctor\ndescription: EDITED IN SRC ONLY\n---\nbody\n' \
  > "$FIX/fault2/src/skills/doctor/SKILL.md"

control_rc=0; fault_rc=0; fault2_rc=0
bash "$FIX/control/tests/plugins/test-build-drift.sh" >"$FIX/control.log" 2>&1 || control_rc=$?
bash "$FIX/fault/tests/plugins/test-build-drift.sh"   >"$FIX/fault.log"   2>&1 || fault_rc=$?
bash "$FIX/fault2/tests/plugins/test-build-drift.sh"  >"$FIX/fault2.log"  2>&1 || fault2_rc=$?

{
  echo "--- control tail ---"; tail -4 "$FIX/control.log"
  echo "--- fault (empty src/) tail ---"; tail -5 "$FIX/fault.log"
  echo "--- fault2 (real drift) rc=$fault2_rc ---"; tail -3 "$FIX/fault2.log"
} >&2

printf 'RESULT gate=%s control=%s fault=%s fault2=%s\n' \
  "build-drift" "$control_rc" "$fault_rc" "$fault2_rc"
