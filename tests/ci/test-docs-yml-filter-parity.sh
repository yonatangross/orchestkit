#!/usr/bin/env bash
# Test: .github/workflows/docs.yml keeps the push `paths:` list and the
# paths-filter `docs:` list identical, and lists every script the docs
# build chain consumes.
#
# Why: docs.yml carries a comment contract, "every input the validate/build
# jobs consume must appear in BOTH places", that nothing enforced. The
# #4591 review caught scripts/_build-docs-generate.py and
# scripts/build-plugins.sh absent from BOTH lists, so a generator-only
# change earned a green required `build` check with no build and no
# validation. This test fails on either drift: the two lists differing, or
# a chain input missing from both.
#
# Arms:
#   parity:  push paths and paths-filter docs hold the same set
#   inputs:  every file in GENERATOR_INPUTS and JOB_INPUTS appears in
#            BOTH lists (a name removed from both lists keeps parity,
#            so the lists alone cannot catch it)
#   exists:  every file in GENERATOR_INPUTS and JOB_INPUTS exists on
#            disk (a rename that drops one must be loud, not silent)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="$REPO_ROOT/.github/workflows/docs.yml"

echo "=== docs.yml filter parity and generator-input gate ==="
echo ""

PASS=0
FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# The scripts the validate/build jobs consume:
#   npm run build -> scripts/build-plugins.sh -> scripts/build-docs.sh
#     -> python3 scripts/_build-docs-generate.py   (build chain)
#   node scripts/check-docs-facts.mjs              (validate job, direct)
GENERATOR_INPUTS=(
    scripts/build-plugins.sh
    scripts/build-docs.sh
    scripts/_build-docs-generate.py
    scripts/check-docs-facts.mjs
)

# The non-script files the validate/build jobs read, direct or through
# an import. #4591 round 2 (HOLD): each had 0 lines in docs.yml, so a
# change to one earned docs=false and a green required `build` notice
# with no validation. Globs cannot be -f checked; the exists arm skips
# them but both list checks still apply.
#   shared/cc-support.json        check-docs-facts.mjs reads supported_floor
#   manifests/ork.json            docs/site/lib/constants.ts imports it
#   scripts/seo/link-graph.mjs    gen-related-graph + search-suggest index
#   scripts/lib/parse-frontmatter.js  required by link-graph.mjs
#   package.json, package-lock.json, .nvmrc   npm ci + setup-node inputs
JOB_INPUTS=(
    shared/cc-support.json
    manifests/ork.json
    scripts/seo/link-graph.mjs
    scripts/lib/parse-frontmatter.js
    package.json
    package-lock.json
    .nvmrc
    "docs/stubs/**"
)

# extract_paths <mode>: print one path per line, quotes stripped.
#   push   -> the `push.paths:` block (6-space `      - ` items)
#   filter -> the paths-filter `docs:` block (14-space `              - ` items)
extract_paths() {
    local mode="$1"
    if [[ "$mode" == push ]]; then
        awk '
            /^  push:/ { inpush = 1 }
            inpush && /^    paths:/ { inpaths = 1; next }
            inpaths && /^      - / {
                line = $0; sub(/^      - /, "", line)
                gsub(/["'"'"']/, "", line); print line; next
            }
            inpaths { exit }
        ' "$WF"
    else
        awk '
            /^            docs:/ { indocs = 1; next }
            indocs && /^              - / {
                line = $0; sub(/^              - /, "", line)
                gsub(/["'"'"']/, "", line); print line; next
            }
            indocs { exit }
        ' "$WF"
    fi
}

PUSH_LIST="$(extract_paths push)"
FILTER_LIST="$(extract_paths filter)"

if [[ -z "$PUSH_LIST" || -z "$FILTER_LIST" ]]; then
    bad "could not extract one of the lists (push paths or paths-filter docs); the docs.yml layout may have changed"
else
    # parity arm: same set, same count
    if diff <(printf '%s\n' "$PUSH_LIST" | sort) \
            <(printf '%s\n' "$FILTER_LIST" | sort) >/dev/null; then
        ok "push paths and paths-filter docs hold the same set"
    else
        bad "push paths and paths-filter docs differ:"
        diff <(printf '%s\n' "$PUSH_LIST" | sort) \
             <(printf '%s\n' "$FILTER_LIST" | sort) | sed 's/^/      /' || true
    fi
fi

# inputs + exists arms
in_list() {  # in_list <needle> <haystack-lines>
    # Pure bash, exact whole-line match. Not `printf | grep -q`: under pipefail
    # grep -q exiting on the first hit can SIGPIPE printf and flip a hit to a
    # failure. Not `grep <<<"$2"` either: a here-string over PIPE_BUF can
    # deadlock on bash 5.3 builds (ork#3348). The quoted "$1" is literal.
    [[ $'\n'"$2"$'\n' == *$'\n'"$1"$'\n'* ]]
}
for f in "${GENERATOR_INPUTS[@]}" "${JOB_INPUTS[@]}"; do
    if [[ "$f" == *'*'* ]]; then
        : # glob entry: existence cannot be -f checked
    elif [[ -f "$REPO_ROOT/$f" ]]; then
        ok "$f exists on disk"
    else
        bad "$f is named a job input but is missing on disk"
    fi
    missing=""
    in_list "$f" "$PUSH_LIST"   || missing="push paths"
    in_list "$f" "$FILTER_LIST" || missing="${missing:+$missing and }paths-filter docs"
    if [[ -z "$missing" ]]; then
        ok "$f is in both docs.yml input lists"
    else
        bad "$f missing from $missing in docs.yml"
    fi
done

echo ""
if [[ "$FAIL" -gt 0 ]]; then
    echo "RESULT: FAIL ($FAIL failures, $PASS passed)"
    exit 1
fi
echo "RESULT: PASS ($PASS checks)"
