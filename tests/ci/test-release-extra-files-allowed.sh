#!/usr/bin/env bash
# Test: every extra-files path in .release-please-config.json must match the
# ALLOWED regex in .github/workflows/release-please.yml (#4176).
#
# Why (the #4173 class): the release-please build step refuses to execute a
# release branch whose diff from main touches any path outside ALLOWED. The
# extra-files list in .release-please-config.json is what puts version-stamped
# files on that branch, so a single extra-files entry that ALLOWED does not
# cover blocks EVERY release, and nothing checked the two against each other.
#
# The check is live on both ends: paths are parsed from the config JSON and
# the ALLOWED assignment is found in the workflow by its text (not by line
# number), so the test drifts with the shipped files rather than with a
# pasted copy. The regex is compiled with grep -E, the same engine the
# workflow step itself uses, so the test validates exactly the dialect that
# runs in production.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$REPO_ROOT/.release-please-config.json"
WF="$REPO_ROOT/.github/workflows/release-please.yml"

echo "=== release extra-files vs ALLOWED coverage (#4176) ==="
echo ""

PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# 1. Parse the unique extra-files paths from the release-please config.
#    python3 is already the JSON engine of this suite (tests/ci/test-no-bare-mktemp.sh).
extract_paths() {
    python3 - "$1" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
extra = cfg.get("packages", {}).get(".", {}).get("extra-files", [])
for p in sorted({e["path"] for e in extra if isinstance(e, dict) and "path" in e}):
    print(p)
PY
}
PATHS=""
if ! PATHS="$(extract_paths "$CONFIG")"; then
    echo "  note: python3 could not parse $CONFIG; treating extra-files as empty" >&2
    PATHS=""
fi
# silent: known-noise, grep -c exits 1 on a zero count and the empty-list case is a handled failure below
PATH_COUNT="$(printf '%s\n' "$PATHS" | grep -c .)" || true
if [[ -n "$PATHS" && "$PATH_COUNT" -gt 0 ]]; then
    ok "extra-files list non-empty: $PATH_COUNT unique paths in .release-please-config.json"
else
    bad ".release-please-config.json packages['.'].extra-files parsed to an empty path list; nothing can be checked"
fi

# 2. Find the ALLOWED='...' assignment by its text, not by line number, and
#    assert exactly one exists (a later PR may move the step into its own job).
ALLOWS=()
# silent: known-noise, zero assignments is the exactly-one failure below, not a crash
while IFS= read -r line; do
    [[ -n "$line" ]] && ALLOWS+=("$line")
done < <(grep -o "ALLOWED='[^']*'" "$WF")
if [[ ${#ALLOWS[@]} -eq 1 ]]; then
    ok "exactly one ALLOWED='...' assignment in .github/workflows/release-please.yml"
else
    bad "expected exactly one ALLOWED='...' assignment in .github/workflows/release-please.yml, found ${#ALLOWS[@]}"
fi
ALLOWED=""
if [[ ${#ALLOWS[@]} -ge 1 ]]; then
    ALLOWED="$(printf '%s' "${ALLOWS[0]}" | sed "s/^ALLOWED='//; s/'\$//")"
fi

# 3. Compile it, with the engine the workflow step actually uses (grep -E).
#    grep exits 2 on a regex compile error; 0/1 both mean it compiled.
COMPILE_RC=0
if [[ -n "$ALLOWED" ]]; then
    # silent: known-noise, grep only prints the probe or a no-match notice here; the rc is captured
    printf 'x' | grep -E "$ALLOWED" >/dev/null 2>&1 || COMPILE_RC=$?
fi
if [[ -n "$ALLOWED" && $COMPILE_RC -le 1 ]]; then
    ok "ALLOWED compiles as POSIX ERE under grep -E (rc=$COMPILE_RC)"
else
    bad "ALLOWED in .github/workflows/release-please.yml did not compile under grep -E (rc=$COMPILE_RC); the ERE syntax is invalid"
fi

# 4. Every extra-files path must match ALLOWED. The failure names the missing
#    path and both files, so the fix site is in the message.
if [[ -n "$PATHS" && -n "$ALLOWED" ]]; then
    while IFS= read -r p; do
        [[ -z "$p" ]] && continue
        if printf '%s' "$p" | grep -E "$ALLOWED" -q; then
            ok "extra-files path matches ALLOWED: $p"
        else
            bad "extra-files path '$p' (.release-please-config.json) does not match ALLOWED in .github/workflows/release-please.yml; every release branch touching it would be blocked"
        fi
    done < <(printf '%s\n' "$PATHS")
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]