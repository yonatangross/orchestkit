#!/usr/bin/env bash
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/sync-skills-validate"

( cd "$REPO" && bash bin/sync-skills.sh validate --quiet ) >&2; c1=$?
( cd "$REPO" && bash bin/sync-skills.sh validate --check-orphans --quiet ) >&2; c2=$?
control_rc=$(( c1 > c2 ? c1 : c2 ))

# fault: plugins/ is ABSENT -> plugin_count 0 -> "No plugins found" -> exit 0,
# while src/skills still holds skills that nothing links.
rm -rf "$FIX"; mkdir -p "$FIX/bin" "$FIX/src/skills/alpha" "$FIX/src/skills/beta"
cp "$REPO/bin/sync-skills.sh" "$FIX/bin/"
printf -- '---\nname: alpha\n---\n' > "$FIX/src/skills/alpha/SKILL.md"
printf -- '---\nname: beta\n---\n' > "$FIX/src/skills/beta/SKILL.md"
bash "$FIX/bin/sync-skills.sh" validate --quiet >&2
fault_rc=$?

# fault2: the plugin dir EXISTS but its skills dir is empty -> 0 entries checked,
# 2 orphans, still exit 0 (orphans only warn).
rm -rf "$FIX/f2"; mkdir -p "$FIX/f2/bin" "$FIX/f2/src/skills/alpha" "$FIX/f2/plugins/ork/skills"
cp "$REPO/bin/sync-skills.sh" "$FIX/f2/bin/"
printf -- '---\nname: alpha\n---\n' > "$FIX/f2/src/skills/alpha/SKILL.md"
bash "$FIX/f2/bin/sync-skills.sh" validate --check-orphans >&2
fault2_rc=$?

printf 'RESULT gate=%s control=%s fault=%s fault2=%s\n' "sync-skills-validate" "$control_rc" "$fault_rc" "$fault2_rc"
