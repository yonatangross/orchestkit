#!/usr/bin/env bash
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/verify-cc-keys"

# `npm run verify:cc-keys` (scripts/derive-cc-output-keys.mjs --check) judges
# the generated allow-list against the CC binary. spec/cc-output-keys.spec.yml
# is the declared source of truth that module is hand-mirrored from (EPIC B
# residue, #3307). control: spec present. fault: spec emptied. fault2: spec
# missing. Measured 2026-09-06 before the guard: all three exited 0, because
# --check never opened the spec at all.
#
# The binary is a fixture, not the installed CC. ci.yml does not install CC,
# and a control arm that depends on whatever binary the host happens to pin is
# the exact "passed with nothing to compare" shape this arm exists to rule
# out. The fake names every event the generated allow-list asserts, in the
# prose form the script greps for, so the binary comparison is satisfied and
# only the spec input varies between arms.

rm -rf "$FIX"
mkdir -p "$FIX/tree/scripts" "$FIX/tree/src/hooks/bin" "$FIX/tree/spec" "$FIX/bin" "$FIX/home"
cp "$REPO/scripts/derive-cc-output-keys.mjs" "$FIX/tree/scripts/"
cp "$REPO/src/hooks/bin/cc-output-keys.generated.mjs" "$FIX/tree/src/hooks/bin/"
cp "$REPO/spec/cc-output-keys.spec.yml" "$FIX/tree/spec/"

{
    echo "hookSpecificOutput fixture binary for tests/ci/fault-arms/verify-cc-keys.sh"
    node -e '
      import(process.argv[1]).then((m) => {
        for (const e of m.EVENTS_WITH_ADDITIONAL_CONTEXT)
          console.log(`Hook-specific output for the ${e} event. additionalContext is non-error feedback delivered to the model.`);
      });
    ' "$FIX/tree/src/hooks/bin/cc-output-keys.generated.mjs"
} > "$FIX/bin/claude"
chmod +x "$FIX/bin/claude"

run_check() {
    ( cd "$FIX/tree" && HOME="$FIX/home" PATH="$FIX/bin:$PATH" node scripts/derive-cc-output-keys.mjs --check ) >&2
}

run_check; control_rc=$?

: > "$FIX/tree/spec/cc-output-keys.spec.yml"
run_check; fault_rc=$?

rm -f "$FIX/tree/spec/cc-output-keys.spec.yml"
run_check; fault2_rc=$?

printf 'RESULT gate=%s control=%s fault=%s fault2=%s\n' "verify-cc-keys" "$control_rc" "$fault_rc" "$fault2_rc"
