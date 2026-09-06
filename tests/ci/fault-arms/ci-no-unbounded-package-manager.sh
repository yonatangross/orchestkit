#!/usr/bin/env bash
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/ci-no-unbounded-package-manager"

( cd "$REPO" && bash tests/ci/test-no-unbounded-package-manager.sh ) >&2
control_rc=$?

# fault: bin/ and scripts/ are GONE from the surface (renamed away). Both are
# skipped by `[ -d "$d" ] || continue`, so an offender planted in the renamed
# dir is never scanned. This is the exact #3557 shape the gate exists to stop.
rm -rf "$FIX"; mkdir -p "$FIX/tests/ci" "$FIX/.github/scripts" "$FIX/tools"
cp "$REPO/tests/ci/test-no-unbounded-package-manager.sh" "$FIX/tests/ci/"
cp "$REPO/.github/scripts/ensure-system-deps.sh" "$FIX/.github/scripts/"
printf '#!/bin/bash\nsudo apt-''get update -qq\n' > "$FIX/tools/ci-setup.sh"
bash "$FIX/tests/ci/test-no-unbounded-package-manager.sh" >&2
fault_rc=$?

# fault2: the bounded helper itself is missing
rm -rf "$FIX/f2"; mkdir -p "$FIX/f2/tests/ci" "$FIX/f2/.github" "$FIX/f2/bin" "$FIX/f2/scripts"
cp "$REPO/tests/ci/test-no-unbounded-package-manager.sh" "$FIX/f2/tests/ci/"
bash "$FIX/f2/tests/ci/test-no-unbounded-package-manager.sh" >&2
fault2_rc=$?

printf 'RESULT gate=%s control=%s fault=%s fault2=%s\n' "ci-no-unbounded-package-manager" "$control_rc" "$fault_rc" "$fault2_rc"
