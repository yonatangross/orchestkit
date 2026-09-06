#!/usr/bin/env bash
# Gate: tests/manifests/test-skill-activation-channels.mjs
# Pass condition: islands.length === 0 (line 151/161). islands is only filled by
#   iterating userInvocable, which is built from readdirSync(src/skills), so an
#   empty src/skills prints "PASSED - all 0 user-invocable skills have a trigger
#   path" and exits 0. Honors CLAUDE_PROJECT_DIR (line 29).
# control: 2 skills, one user-invocable and chained by the other -> expect 0
# fault:   src/skills present but empty                          -> expect non-zero
# fault2:  a user-invocable skill with no incoming reference      -> expect non-zero
set -uo pipefail

REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
SLUG="skill-activation-channels"
F="$H/fixtures/$SLUG"
GATE="$REPO/tests/manifests/test-skill-activation-channels.mjs"

fresh() { rm -rf "$F"; mkdir -p "$F/src/skills" "$F/src/agents"; }

fresh
mkdir -p "$F/src/skills/alpha" "$F/src/skills/parent"
printf -- '---\nname: alpha\nuser-invocable: true\n---\nbody\n' > "$F/src/skills/alpha/SKILL.md"
printf -- '---\nname: parent\n---\nCalls /ork:alpha when needed.\n' > "$F/src/skills/parent/SKILL.md"
echo "--- control arm (alpha is chained by parent) ---" >&2
( cd "$F" && CLAUDE_PROJECT_DIR="$F" node "$GATE" ) >&2
control_rc=$?

fresh
echo "--- fault arm (src/skills present but empty) ---" >&2
( cd "$F" && CLAUDE_PROJECT_DIR="$F" node "$GATE" ) >&2
fault_rc=$?

fresh
mkdir -p "$F/src/skills/alpha"
printf -- '---\nname: alpha\nuser-invocable: true\n---\nbody\n' > "$F/src/skills/alpha/SKILL.md"
echo "--- fault2 arm (user-invocable island, no referrer) ---" >&2
( cd "$F" && CLAUDE_PROJECT_DIR="$F" node "$GATE" ) >&2
fault2_rc=$?

printf 'RESULT gate=%s control=%s fault=%s fault2=%s\n' "$SLUG" "$control_rc" "$fault_rc" "$fault2_rc"
