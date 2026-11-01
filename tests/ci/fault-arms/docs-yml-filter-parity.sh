#!/usr/bin/env bash
# strict-mode: opt-out a fault arm must observe the gate's non-zero exits, so no -e
# Fault arm for tests/ci/test-docs-yml-filter-parity.sh.
#
# control : the real tree must pass.
# fault   : one paths-filter docs entry changed in a fixture copy. The parity
#           arm must fail and say the lists differ.
# fault2  : diff itself errors (a PATH stub that exits 2, as `diff` did when
#           it could not open /dev/fd under a Claude Code session). The gate
#           must fail and say it could not compare, never report drift.
# Each fault value is the gate's exit code only when the expected message is
# also printed; otherwise it is 0, which the runner reads as a FAIL.
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/docs-yml-filter-parity"
GATE="tests/ci/test-docs-yml-filter-parity.sh"

( cd "$REPO" && bash "$GATE" ) >&2
control_rc=$?

# Every file the gate's exists arm checks; contents are not read.
INPUT_FILES=(
  scripts/build-plugins.sh
  scripts/build-docs.sh
  scripts/_build-docs-generate.py
  scripts/check-docs-facts.mjs
  shared/cc-support.json
  manifests/ork.json
  scripts/seo/link-graph.mjs
  scripts/lib/parse-frontmatter.js
  package.json
  package-lock.json
  .nvmrc
)

make_fixture() { # make_fixture <dir>: the gate, docs.yml and placeholder inputs
  local d="$1" f
  rm -rf "$d"; mkdir -p "$d/tests/ci" "$d/.github/workflows"
  cp "$REPO/$GATE" "$d/tests/ci/"
  cp "$REPO/.github/workflows/docs.yml" "$d/.github/workflows/"
  for f in "${INPUT_FILES[@]}"; do
    mkdir -p "$d/$(dirname "$f")"; : > "$d/$f"
  done
}

expect() { # expect <rc> <output> <message>: rc when the message is present, else 0
  if [[ "$1" -ne 0 && "$2" == *"$3"* ]]; then echo "$1"; else echo 0; fi
}

# control in a fixture: the copy must pass too, or the faults prove nothing
make_fixture "$FIX/c"
bash "$FIX/c/$GATE" >&2
fixture_control_rc=$?

# fault: the first paths-filter docs entry renamed
make_fixture "$FIX/f1"
awk '/^            docs:/ { d = 1; print; next }
     d && !done && /^              - / { sub(/'"'"'$/, "-renamed'"'"'"); done = 1 }
     { print }' "$REPO/.github/workflows/docs.yml" > "$FIX/f1/.github/workflows/docs.yml"
out="$(bash "$FIX/f1/$GATE" 2>&1)"; rc=$?
printf '%s\n' "$out" >&2
fault_rc="$(expect "$rc" "$out" "push paths and paths-filter docs differ")"

# fault2: diff errors instead of comparing
make_fixture "$FIX/f2"
mkdir -p "$FIX/f2/stub"
printf '#!/bin/sh\necho "diff: /dev/fd/63: Operation not permitted" >&2\nexit 2\n' > "$FIX/f2/stub/diff"
chmod +x "$FIX/f2/stub/diff"
out="$(PATH="$FIX/f2/stub:$PATH" bash "$FIX/f2/$GATE" 2>&1)"; rc=$?
printf '%s\n' "$out" >&2
fault2_rc="$(expect "$rc" "$out" "could not compare")"

printf 'RESULT gate=%s control=%s fixture_control=%s fault=%s fault2=%s\n' \
  "docs-yml-filter-parity" "$control_rc" "$fixture_control_rc" "$fault_rc" "$fault2_rc"
