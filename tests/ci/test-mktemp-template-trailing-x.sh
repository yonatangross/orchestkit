#!/usr/bin/env bash
# Test: no tracked .sh passes mktemp a template with text after its X run.
#
# Why: BSD mktemp (macOS) replaces only TRAILING X's. A template such as
# "ork-hang.XXXXXX.mjs" is therefore a fixed path, the same on every run.
# A solo run passes because the test removes the file at the end, but two
# pre-push runs at the same time collide ("mkstemp failed ... File exists"),
# and a run killed before its cleanup leaves the file so every later run
# fails. On 2026-11-11 two ship seats failed their pre-push this way at once
# (tests/unit/test-image-paste-guard.sh). GNU mktemp in CI accepts such a
# template only with --suffix, so CI never showed it.
#
# The safe forms: reserve a unique name with trailing X's and add the
# extension by rename, or make a directory with mktemp -d and put the file
# with the extension it needs inside it.
#
# Fail closed: outside a git work tree, or when the listing comes back empty,
# the test FAILS rather than passing. Self-checks prove the matcher flags a
# suffixed template and leaves the safe forms alone.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SELF="tests/ci/$(basename "${BASH_SOURCE[0]}")"

echo "=== mktemp Template Trailing-X Test ==="
echo ""

cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "FAIL: $REPO_ROOT is not a git work tree; the check cannot run"
    exit 2
fi

# A non-comment line that calls mktemp with a run of 3+ X's followed by an
# extension (".mjs", "-x.yaml") that ends at a quote, a paren or a space.
# Message text that only names a template ("tmp.XXXX: Operation not
# permitted", an escaped \"...XXXXXX\") is not a call and stays clean.
PATTERN='^[^#]*mktemp[^#]*X{3,}[._-][A-Za-z0-9._-]*["'"'"')[:space:]]'

FAILS=0
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-mktemp-lint.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

expect() {
    local want="$1" name="$2" body="$3"
    printf '%s\n' "$body" > "$WORK/$name.sh"
    local got=clean
    if grep -qE "$PATTERN" "$WORK/$name.sh"; then got=flagged; fi
    if [[ "$got" == "$want" ]]; then
        echo "  ok self-check $name: $got"
    else
        echo "  FAIL self-check $name: wanted $want, got $got"
        FAILS=$((FAILS + 1))
    fi
}

expect flagged suffix-mjs 'f=$(mktemp "${TMPDIR:-/tmp}/ork-hang.XXXXXX.mjs")'
expect flagged suffix-yaml 'f=$(mktemp "${TMPDIR:-/tmp}/ork-opt-train-XXXXXX.yaml")'
expect clean trailing-x 'f=$(mktemp "${TMPDIR:-/tmp}/ork-hang-err.XXXXXX")'
expect clean dir-form 'd=$(mktemp -d "${TMPDIR:-/tmp}/ork-hang.XXXXXX"); f="$d/hang.mjs"'
expect clean unquoted 'f=$(mktemp /tmp/ork.XXXXXX)'
expect clean comment '# never write mktemp ork.XXXXXX.mjs'
expect clean error-text 'echo "mktemp: mkstemp failed on /var/folders/x/T/tmp.XXXX: Operation not permitted" >&2'
expect clean escaped-quote 'echo "Use: D=\$(mktemp -d \"\${TMPDIR:-/tmp}/ork-x.XXXXXX\")"'

CHECKED=0
BAD=()
while IFS= read -r -d '' path; do
    [ -n "$path" ] || continue
    [ -f "$path" ] || continue
    [[ "$path" == "$SELF" ]] && continue
    CHECKED=$((CHECKED + 1))
    while IFS= read -r hit; do
        [ -n "$hit" ] && BAD+=("$path:$hit")
    done < <(grep -nE "$PATTERN" "$path" | cut -d: -f1)
done < <(git -c core.quotePath=false ls-files -z -- '*.sh')

if [[ $CHECKED -eq 0 ]]; then
    echo "FAIL: no tracked .sh files listed; the check cannot have run"
    exit 2
fi

if [[ ${#BAD[@]} -gt 0 ]]; then
    echo "FAIL: ${#BAD[@]} mktemp template(s) with text after the X run (fixed path on macOS):"
    for b in "${BAD[@]}"; do
        echo "  $b"
    done
    echo "  fix: b=\$(mktemp \".../name.XXXXXX\"); f=\"\$b.ext\"; mv \"\$b\" \"\$f\""
    FAILS=$((FAILS + 1))
fi

if [[ $FAILS -gt 0 ]]; then
    exit 1
fi
echo "PASS: $CHECKED tracked .sh files, no mktemp template with a suffix after its X run"
