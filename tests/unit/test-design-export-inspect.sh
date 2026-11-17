#!/usr/bin/env bash
# Exercises src/skills/design-to-code/scripts/inspect-export.mjs with fixtures
# built on the fly (tests/fixtures/design-export/build-fixtures.py), so no
# binary archive is committed.
#
# What this pins:
#   - a .zip export, a standalone .html, an unpacked folder and the
#     standalone-site .tar.gz bundle are all read (exit 0) and reported
#   - an export with no HTML reads as status "incomplete", not as an error
#   - the same bytes give the same bundle_id wherever the file is saved
#   - hostile archives are refused (exit 1) and write nothing outside the
#     output folder: "../" names, absolute names, backslash names, links,
#     and a size field that lies
#   - a file that is not an export is refused; a missing path is exit 2
#   - input type is decided by content, not by extension

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSPECT="$PROJECT_ROOT/src/skills/design-to-code/scripts/inspect-export.mjs"
FIXTURES="$PROJECT_ROOT/tests/fixtures/design-export/build-fixtures.py"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
NC=$'\033[0m'
PASS=0
FAIL=0
pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

if [[ ! -f "$INSPECT" ]]; then
  fail "inspect script not found: $INSPECT"
  exit 1
fi

SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/ork-export.XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT
python3 "$FIXTURES" "$SANDBOX"

OUT_JSON=""
RUN_N=0

# run <label> <expected-exit> <file> [extra args]; leaves the JSON in OUT_JSON
run() {
  local label="$1" expected="$2" file="$3" ec
  shift 3
  RUN_N=$((RUN_N + 1))
  set +e
  OUT_JSON=$(node "$INSPECT" "$file" --out "$SANDBOX/out-$RUN_N" "$@" 2>"$SANDBOX/stderr")
  ec=$?
  set -e
  if [[ "$ec" == "$expected" ]]; then
    pass "$label (exit $ec)"
  else
    fail "$label (expected exit $expected, got $ec: $(head -1 "$SANDBOX/stderr"))"
  fi
}

# field <key>: one top-level field of OUT_JSON, arrays joined with commas
field() {
  node -e 'const v=JSON.parse(process.argv[1])[process.argv[2]];console.log(Array.isArray(v)?v.join(","):String(v))' "$OUT_JSON" "$1"
}

expect_field() {
  local key="$1" want="$2" got
  got=$(field "$key")
  if [[ "$got" == "$want" ]]; then pass "  $key = $want"; else fail "  $key: wanted '$want', got '$got'"; fi
}

echo "▶ readable exports"
run "zip export" 0 "$SANDBOX/good.zip"
expect_field kind zip
expect_field layout export
expect_field status complete
expect_field primary_html index.html
expect_field html "Detail.html,index.html"
expect_field token_files "styles/tokens.css"
ID_A=$(field bundle_id)

cp "$SANDBOX/good.zip" "$SANDBOX/copy-elsewhere.zip"
run "same bytes, other path" 0 "$SANDBOX/copy-elsewhere.zip"
if [[ "$(field bundle_id)" == "$ID_A" ]]; then
  pass "  bundle_id follows the bytes, not the path"
else
  fail "  bundle_id changed with the path"
fi

run "zip without a .zip extension (content decides)" 0 "$SANDBOX/renamed.bin"
expect_field kind zip

run "standalone html" 0 "$SANDBOX/standalone.html"
expect_field kind html
expect_field primary_html standalone.html

run "unpacked folder" 0 "$SANDBOX/folder"
expect_field kind folder
expect_field primary_html Home.html

run "zip with no html is incomplete, not an error" 0 "$SANDBOX/no-html.zip"
expect_field status incomplete
expect_field primary_html null

run "two pages, no index: first by name" 0 "$SANDBOX/two-pages.zip"
expect_field primary_html a.html
run "two pages, --open picks" 0 "$SANDBOX/two-pages.zip" --open b.html
expect_field primary_html b.html

echo "▶ standalone-site bundle (until 2026-12-14)"
run "legacy tar.gz" 0 "$SANDBOX/legacy.tar.gz" --open Other.html
expect_field kind tar.gz
expect_field layout standalone-handoff
expect_field readme README.md
expect_field chats "chats/chat1.md"
expect_field primary_html "project/Other.html"
run "legacy tar.gz without project/" 0 "$SANDBOX/legacy-incomplete.tar.gz"
expect_field status incomplete

echo "▶ hostile or wrong input"
for bad in traversal.zip absolute.zip backslash.zip symlink.zip lying-size.zip stored-lying-size.zip clash.zip duplicate.zip tar-traversal.tar.gz tar-link.tar.gz tar-negative-size.tar.gz plain.txt; do
  run "$bad refused" 1 "$SANDBOX/$bad"
  # A refused archive leaves nothing behind in its output folder.
  if [[ -d "$SANDBOX/out-$RUN_N" ]]; then
    LEFT=$(find "$SANDBOX/out-$RUN_N" -type f)
    if [[ -n "$LEFT" ]]; then fail "  $bad left files behind: $LEFT"; fi
  fi
done
if [[ -e "$SANDBOX/escaped.html" || -e "$SANDBOX/tar-escaped.html" || -e /tmp/abs-escaped.html ]]; then
  fail "a hostile archive wrote outside its output folder"
else
  pass "nothing was written outside the output folder"
fi
BIG=$(find "$SANDBOX" -name big.html)
if [[ -n "$BIG" ]]; then fail "the lying-size entry was written"; else pass "the lying-size entry was not written"; fi
run "missing path" 2 "$SANDBOX/does-not-exist.zip"

echo "▶ a large inventory through a pipe"
# 1900 pages print more than one pipe buffer (64 KB). The JSON must arrive whole.
set +e
MANY=$(node "$INSPECT" "$SANDBOX/many-pages.zip" --out "$SANDBOX/out-many" 2>"$SANDBOX/stderr" \
  | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{console.log(JSON.parse(s).html.length)}catch{console.log("unparseable")}})')
set -e
if [[ "$MANY" == "1900" ]]; then
  pass "1900 pages listed, JSON intact"
else
  fail "large inventory: wanted 1900 pages, got '$MANY' ($(head -1 "$SANDBOX/stderr"))"
fi

echo ""
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
[[ $FAIL -eq 0 ]] || exit 1
exit 0
