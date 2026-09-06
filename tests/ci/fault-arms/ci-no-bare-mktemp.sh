#!/usr/bin/env bash
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/ci-no-bare-mktemp"

( cd "$REPO" && bash tests/ci/test-no-bare-mktemp.sh ) >&2
control_rc=$?

# fault: a git repo whose INDEX is empty. `git ls-files tests bin scripts .github`
# returns nothing, so zero files are scanned and the gate reports PASS.
# A real offender is planted on disk to prove the scan is what went blind.
rm -rf "$FIX"; mkdir -p "$FIX/tests/ci" "$FIX/bin"
cp "$REPO/tests/ci/test-no-bare-mktemp.sh" "$FIX/tests/ci/"
printf '#!/bin/bash\nd=$(mkte''mp -d)\necho "$d"\n' > "$FIX/bin/offender.sh"
git -C "$FIX" init -q
bash "$FIX/tests/ci/test-no-bare-mktemp.sh" >&2
fault_rc=$?

# fault2: same offender, but COMMITTED under a directory outside the four
# scanned names (src/). Surface is non-empty yet the offender is invisible.
rm -rf "$FIX/f2"; mkdir -p "$FIX/f2/tests/ci" "$FIX/f2/src"
cp "$REPO/tests/ci/test-no-bare-mktemp.sh" "$FIX/f2/tests/ci/"
printf '#!/bin/bash\nd=$(mkte''mp -d)\necho "$d"\n' > "$FIX/f2/src/offender.sh"
git -C "$FIX/f2" init -q
git -C "$FIX/f2" add -A >/dev/null 2>&1
bash "$FIX/f2/tests/ci/test-no-bare-mktemp.sh" >&2
fault2_rc=$?

printf 'RESULT gate=%s control=%s fault=%s fault2=%s\n' "ci-no-bare-mktemp" "$control_rc" "$fault_rc" "$fault2_rc"
