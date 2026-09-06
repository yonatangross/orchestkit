#!/usr/bin/env bash
# Gate: tests/manifests/test-version-consistency.mjs
# Pass condition: failed === 0 (line 100). The two version comparisons are plain
#   === on values read with optional chaining, so if BOTH package.json .version and
#   the lockfile's two version fields are absent the comparison is
#   undefined === undefined and both log a PASS.
# Derives ROOT from import.meta.url (line 36), ignores CLAUDE_PROJECT_DIR.
# control: real package.json / package-lock.json / .release-please-config.json -> 0
# fault:   version key removed from package.json AND both lockfile paths       -> expect non-zero
# fault2:  lockfile stale (version bumped only in package.json)                -> expect non-zero
# fault3:  release-please extra-files entries for the lockfile removed         -> expect non-zero
set -uo pipefail

REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
SLUG="version-consistency"
F="$H/fixtures/$SLUG"
GATE="tests/manifests/test-version-consistency.mjs"

fresh() {
  rm -rf "$F"
  mkdir -p "$F/tests/manifests"
  cp "$REPO/$GATE" "$F/$GATE"
  jq '{name, version}' "$REPO/package.json" > "$F/package.json"
  jq '{name, version, lockfileVersion, packages: {"": {version: .packages[""].version}}}' \
    "$REPO/package-lock.json" > "$F/package-lock.json"
  cp "$REPO/.release-please-config.json" "$F/.release-please-config.json"
}

fresh
echo "--- control arm (versions agree, config governs both paths) ---" >&2
( cd "$F" && node "$F/$GATE" ) >&2
control_rc=$?

fresh
jq 'del(.version)' "$F/package.json" > "$F/p.tmp" && mv "$F/p.tmp" "$F/package.json"
jq 'del(.version) | del(.packages[""].version)' "$F/package-lock.json" > "$F/l.tmp" && mv "$F/l.tmp" "$F/package-lock.json"
echo "--- fault arm (version key absent from both files) ---" >&2
( cd "$F" && node "$F/$GATE" ) >&2
fault_rc=$?

fresh
jq '.version = "99.0.0"' "$F/package.json" > "$F/p.tmp" && mv "$F/p.tmp" "$F/package.json"
echo "--- fault2 arm (lockfile stale) ---" >&2
( cd "$F" && node "$F/$GATE" ) >&2
fault2_rc=$?

fresh
jq '.packages["."]["extra-files"] = []' "$F/.release-please-config.json" > "$F/c.tmp" && mv "$F/c.tmp" "$F/.release-please-config.json"
echo "--- fault3 arm (extra-files emptied) ---" >&2
( cd "$F" && node "$F/$GATE" ) >&2
fault3_rc=$?

printf 'RESULT gate=%s control=%s fault=%s fault2=%s fault3=%s\n' "$SLUG" "$control_rc" "$fault_rc" "$fault2_rc" "$fault3_rc"
