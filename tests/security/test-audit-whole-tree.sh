#!/usr/bin/env bash
# Proof for the scheduled whole-tree npm audit (orchestkit row 10, part 1; conductor335's
# ruling, condition 1): the audit step goes RED on a known-vulnerable pin, tells a hit from
# "could not audit", and the issue step opens ONE item per advisory set.
#
# Three layers, each asserting exact outcomes (exit status, advisory id, command text):
#   1. .github/scripts/audit-whole-tree.sh with a stubbed npm audit (ORK_AUDIT_WRAPPER): every
#      outcome, no network.
#   2. .github/scripts/audit-whole-tree.sh against a LIVE fixture lockfile pinned to lodash 4.17.20
#      (npm advisories 1106913 and 1108258 exist today; verified with npm audit on 2026-11-13).
#      This one needs the npm registry, like tests/security/test-npm-audit.sh does. If the
#      registry cannot be reached the script exits 2 and this layer fails loudly, never skips.
#   3. .github/scripts/open-audit-issue.sh with a stubbed gh (ORK_GH): dry run, open, update, no duplicate.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT="$REPO_ROOT/.github/scripts/audit-whole-tree.sh"
OPENER="$REPO_ROOT/.github/scripts/open-audit-issue.sh"
WORKFLOW="$REPO_ROOT/.github/workflows/npm-audit-scheduled.yml"

PASS=0
FAIL=0
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
check() {
    local label="$1" got="$2" want="$3"
    if [[ "$got" == "$want" ]]; then ok "$label (got: $got)"; else bad "$label (got: $got, want: $want)"; fi
}
# count_lines <file> <fixed text>: how many lines of the file contain the text (awk, so no grep exit status to mask)
count_lines() { awk -v needle="$2" 'index($0, needle) { n++ } END { print n + 0 }' "$1"; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork.auditwt.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# ─── layer 1 fixtures: stubbed npm audit ────────────────────────────────────
# The stub prints $STUB_REPORTS/<basename of the dir>.json (exit 1 when it lists vulnerabilities,
# as npm does), else a *.raw file as-is with exit 1, else default.json, else nothing with exit 1
# (npm failing without a report).
STUB="$TMP/stub-wrapper.sh"
cat > "$STUB" <<'EOF'
#!/usr/bin/env bash
name="$(basename "$1")"
for f in "$STUB_REPORTS/$name.json" "$STUB_REPORTS/default.json"; do
  if [[ -f "$f" ]]; then
    cat "$f"
    if jq -e '(.metadata.vulnerabilities.total // 0) > 0' "$f" > /dev/null; then exit 1; fi
    exit 0
  fi
done
if [[ -f "$STUB_REPORTS/$name.raw" ]]; then
  cat "$STUB_REPORTS/$name.raw"
fi
exit 1
EOF
chmod +x "$STUB"
export STUB_REPORTS="$TMP/reports"
mkdir -p "$STUB_REPORTS"

# lockfile dirs the script is pointed at (content is irrelevant to the stub, the file must exist)
for d in clean hit low zero both noreport neterr; do
  mkdir -p "$TMP/trees/$d"
  echo '{}' > "$TMP/trees/$d/package-lock.json"
done
mkdir -p "$TMP/trees/nolock"

# report <deps total> <severity> <advisory id>: a minimal npm audit report with one advisory
report() {
    jq -n --argjson total "$1" --arg sev "$2" --argjson id "$3" '
      {vulnerabilities: {"pkg-a": {name: "pkg-a", severity: $sev,
         via: [{source: $id, name: "pkg-a", title: "Stub advisory \($id) in pkg-a", severity: $sev, range: "<9.9.9"}]}},
       metadata: {vulnerabilities: {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 1}, dependencies: {total: $total}}}'
}
clean_report() {
    jq -n --argjson total "$1" '{vulnerabilities: {}, metadata: {vulnerabilities: {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0}, dependencies: {total: $total}}}'
}
clean_report 5 > "$STUB_REPORTS/clean.json"
report 5 moderate 111 > "$STUB_REPORTS/hit.json"
report 5 low 222 > "$STUB_REPORTS/low.json"
clean_report 0 > "$STUB_REPORTS/zero.json"
report 5 moderate 111 > "$STUB_REPORTS/both.json"
echo '{"error":{"code":"ENOTFOUND","summary":"audit endpoint unreachable"}}' > "$STUB_REPORTS/neterr.raw"

# run_audit <extra args...>: prints the exit status; the output is left in $TMP/audit.out, the summary in $TMP/summary.json
run_audit() {
    local rc=0
    ORK_AUDIT_WRAPPER="$STUB" bash "$AUDIT" --summary-out "$TMP/summary.json" "$@" > "$TMP/audit.out" 2>&1 || rc=$?
    echo "$rc"
}
summary() { jq -r "$1" "$TMP/summary.json"; }

echo "Layer 1: .github/scripts/audit-whole-tree.sh with a stubbed npm audit"

check "clean tree exits 0"                          "$(run_audit --dir "$TMP/trees/clean")"  "0"
check "clean tree: 5 packages examined"             "$(summary '.examined')"                 "5"
check "clean tree: no hits"                         "$(summary '.hits | length')"            "0"

check "a moderate advisory exits 1 (HIT)"           "$(run_audit --dir "$TMP/trees/hit")"    "1"
check "the hit names advisory 111"                  "$(summary '.hits[0].id')"               "111"
check "the hit names its lockfile directory"        "$(summary '.hits[0].dir')"              "$TMP/trees/hit"
check "the hit carries the severity"                "$(summary '.hits[0].severity')"         "moderate"
check "the output says ADVISORIES"                  "$(count_lines "$TMP/audit.out" 'RESULT: ADVISORIES (exit 1)')" "1"

echo '{"111": {"reason": "test", "until": "2099-01-01"}}' > "$TMP/allow-live.json"
check "an allowlisted advisory exits 0"             "$(run_audit --dir "$TMP/trees/hit" --allowlist "$TMP/allow-live.json")" "0"
check "the allowlisted advisory is still listed"    "$(summary '.allowlisted[0].id')"        "111"
echo '{"111": {"reason": "test", "until": "2000-01-01"}}' > "$TMP/allow-expired.json"
check "an EXPIRED allowlist entry exits 1"          "$(run_audit --dir "$TMP/trees/hit" --allowlist "$TMP/allow-expired.json")" "1"

check "a low advisory is below moderate: exits 0"   "$(run_audit --dir "$TMP/trees/low")"    "0"
check "a low advisory is a hit at --level low"      "$(run_audit --dir "$TMP/trees/low" --level low)" "1"

check "no usable report exits 2 (CANNOT AUDIT)"     "$(run_audit --dir "$TMP/trees/noreport")" "2"
check "the error says no usable JSON report"        "$(summary '.errors[0].message | test("no usable JSON report")')" "true"
check "the output says CANNOT AUDIT"                "$(count_lines "$TMP/audit.out" 'RESULT: CANNOT AUDIT (exit 2)')" "1"
check "an npm error object exits 2"                 "$(run_audit --dir "$TMP/trees/neterr")" "2"
check "the error names ENOTFOUND"                   "$(summary '.errors[0].message | test("ENOTFOUND")')" "true"
check "a missing lockfile exits 2"                  "$(run_audit --dir "$TMP/trees/nolock")" "2"
check "zero packages examined exits 2"              "$(run_audit --dir "$TMP/trees/zero")"   "2"
check "the zero-packages error says so"             "$(summary '.errors[0].message | test("zero packages")')" "true"
check "a hit and an error together exit 2"          "$(run_audit --dir "$TMP/trees/both" --dir "$TMP/trees/noreport")" "2"
check "...and the summary keeps the hit"            "$(summary '.hits | length')"            "1"
check "...and the summary keeps the error"          "$(summary '.errors | length')"          "1"
echo 'not json' > "$TMP/allow-broken.json"
check "an unreadable allowlist exits 2"             "$(run_audit --dir "$TMP/trees/hit" --allowlist "$TMP/allow-broken.json")" "2"
check "an unknown level is refused with 2"          "$(run_audit --dir "$TMP/trees/clean" --level nope)" "2"

# Whole tree: with no --dir the script walks every tracked lockfile of this repo (default.json = all clean).
clean_report 3 > "$STUB_REPORTS/default.json"
check "discovery run exits 0 on all-clean stubs"    "$(run_audit)"                           "0"
check "discovery covers the root lockfile"          "$(summary '.dirs | index("(root)") != null')"         "true"
check "discovery covers docs/site"                  "$(summary '.dirs | index("docs/site") != null')"      "true"
check "discovery covers src/hooks"                  "$(summary '.dirs | index("src/hooks") != null')"      "true"
check "discovery covers src/mcp-server"             "$(summary '.dirs | index("src/mcp-server") != null')" "true"
rm -f "$STUB_REPORTS/default.json"

# ─── layer 2: LIVE red on a fixture pinned to a known-vulnerable version ─────
echo "Layer 2: live red, fixture lockfile pinned to lodash 4.17.20"
LIVE="$TMP/live"
mkdir -p "$LIVE"
cat > "$LIVE/package.json" <<'EOF'
{ "name": "ork-audit-fixture", "version": "1.0.0", "private": true, "dependencies": { "lodash": "4.17.20" } }
EOF
cat > "$LIVE/package-lock.json" <<'EOF'
{
  "name": "ork-audit-fixture", "version": "1.0.0", "lockfileVersion": 3, "requires": true,
  "packages": {
    "": { "name": "ork-audit-fixture", "version": "1.0.0", "dependencies": { "lodash": "4.17.20" } },
    "node_modules/lodash": { "version": "4.17.20", "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz" }
  }
}
EOF
LIVE_RC=0
bash "$AUDIT" --dir "$LIVE" --summary-out "$TMP/live-summary.json" > "$TMP/live.out" 2>&1 || LIVE_RC=$?
check "live: the pinned lodash makes the audit step exit 1" "$LIVE_RC" "1"
check "live: the high advisory 1106913 is a hit"     "$(jq -r '[.hits[].id] | index("1106913") != null' "$TMP/live-summary.json")" "true"
check "live: the moderate advisory 1108258 is a hit" "$(jq -r '[.hits[].id] | index("1108258") != null' "$TMP/live-summary.json")" "true"
check "live: the output says ADVISORIES"             "$(count_lines "$TMP/live.out" 'RESULT: ADVISORIES (exit 1)')" "1"

# Control: the same fixture is green once every advisory it carries is allowlisted, so the red above
# is the advisories and not something else about the fixture.
jq -r '[.hits[].id] | map({(.): {reason: "live control", until: "2099-01-01"}}) | add' "$TMP/live-summary.json" > "$TMP/allow-live-all.json"
CONTROL_RC=0
bash "$AUDIT" --dir "$LIVE" --allowlist "$TMP/allow-live-all.json" > "$TMP/live-control.out" 2>&1 || CONTROL_RC=$?
check "live control: allowlisting what it found makes it exit 0" "$CONTROL_RC" "0"

# ─── layer 3: the issue step with a stubbed gh ──────────────────────────────
echo "Layer 3: .github/scripts/open-audit-issue.sh with a stubbed gh"
GHSTUB="$TMP/gh-stub.sh"
cat > "$GHSTUB" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "$GH_LOG"
if [[ "$1 $2" == "issue list" ]]; then cat "$GH_LIST"; fi
for ((i = 1; i <= $#; i++)); do
  if [[ "${!i}" == "--body-file" ]]; then j=$((i + 1)); cp "${!j}" "$GH_BODY_COPY"; fi
done
exit 0
EOF
chmod +x "$GHSTUB"
export GH_LOG="$TMP/gh.log" GH_LIST="$TMP/gh-list.json" GH_BODY_COPY="$TMP/gh-body.md"
: > "$GH_BODY_COPY"

summary_for() { # <id> <name> <title>
  jq -n --arg id "$1" --arg name "$2" --arg title "$3" '
    {level: "moderate", examined: 9, dirs: ["(root)"], allowlisted: [], errors: [],
     hits: [{dir: "src/mcp-server", id: $id, severity: "moderate", name: $name, title: $title}]}'
}
# run_opener <summary file> <extra args...>: prints the exit status; the output is left in $TMP/opener.out
run_opener() {
    local rc=0
    ORK_GH="$GHSTUB" bash "$OPENER" --summary "$1" --repo owner/repo --run-url https://example.test/run/1 "${@:2}" > "$TMP/opener.out" 2>&1 || rc=$?
    echo "$rc"
}
reset_gh() { : > "$GH_LOG"; }

summary_for 111 "@scope/pkg-a" 'ReDoS in `pkg-a` | mention @someone' > "$TMP/s111.json"
echo '[]' > "$GH_LIST"

reset_gh
check "dry run exits 0"                              "$(run_opener "$TMP/s111.json" --dry-run)" "0"
check "dry run runs no gh command at all"            "$(wc -l < "$GH_LOG" | tr -d ' ')" "0"
check "dry run prints the set key for id 111"        "$(count_lines "$TMP/opener.out" 'set key: f6e0a1e2ac41 (ids: 111)')" "1"
check "dry run prints the exact create command"      "$(count_lines "$TMP/opener.out" "issue create --repo owner/repo --label security --title 'npm audit: 1 advisories at moderate or above [set f6e0a1e2ac41]'")" "1"
check "dry run prints the exact edit command"        "$(count_lines "$TMP/opener.out" 'issue edit N --repo owner/repo --body-file')" "1"

reset_gh
check "first real run exits 0"                       "$(run_opener "$TMP/s111.json")" "0"
check "first run looks for an open issue with the label" "$(count_lines "$GH_LOG" 'issue list --repo owner/repo --state open --label security')" "1"
check "first run creates exactly one issue"          "$(count_lines "$GH_LOG" 'issue create --repo owner/repo --label security --title npm audit: 1 advisories at moderate or above [set f6e0a1e2ac41] --body-file')" "1"
check "first run edits nothing"                      "$(count_lines "$GH_LOG" 'issue edit')" "0"
check "the body has the set marker"                  "$(count_lines "$GH_BODY_COPY" '<!-- npm-audit-set:f6e0a1e2ac41 -->')" "1"
check "the body links the run"                       "$(count_lines "$GH_BODY_COPY" 'https://example.test/run/1')" "1"
sed 's/`[^`]*`//g' "$GH_BODY_COPY" > "$TMP/body-outside-code.md"
check "the registry text is in the body"             "$(count_lines "$GH_BODY_COPY" '@someone')" "1"
check "...and none of it is outside a code span (no live mention)" "$(count_lines "$TMP/body-outside-code.md" '@')" "0"

# the next run, same set, finds the open issue and edits it: no duplicate
echo '[{"number": 42, "title": "npm audit: 1 advisories at moderate or above [set f6e0a1e2ac41]"}]' > "$GH_LIST"
reset_gh
check "second run with the same set exits 0"         "$(run_opener "$TMP/s111.json")" "0"
check "second run edits issue 42"                    "$(count_lines "$GH_LOG" 'issue edit 42 --repo owner/repo --body-file')" "1"
check "second run creates NO second issue"           "$(count_lines "$GH_LOG" 'issue create')" "0"

# a different advisory set is a different item
summary_for 222 "pkg-b" "Another advisory" > "$TMP/s222.json"
reset_gh
check "a different set exits 0"                      "$(run_opener "$TMP/s222.json")" "0"
check "a different set opens its own issue"          "$(count_lines "$GH_LOG" 'issue create')" "1"
check "...titled with its own set key"               "$(count_lines "$GH_LOG" '[set 9b871512327c]')" "1"

# advisory order and repeats across lockfiles do not change the set
jq -n '{level: "moderate", examined: 9, dirs: ["(root)", "docs/site"], allowlisted: [], errors: [],
        hits: [{dir: "docs/site", id: "222", severity: "high", name: "b", title: "t"},
               {dir: "(root)", id: "111", severity: "moderate", name: "a", title: "t"},
               {dir: "(root)", id: "222", severity: "high", name: "b", title: "t"}]}' > "$TMP/s-both.json"
KEY_BOTH="$(printf '%s' '111,222' | shasum -a 256 | cut -c1-12)"
check "a two-advisory set exits 0 (dry run)"         "$(run_opener "$TMP/s-both.json" --dry-run)" "0"
check "its key hashes the sorted unique ids"         "$(count_lines "$TMP/opener.out" "set key: ${KEY_BOTH} (ids: 111,222)")" "1"

# no hits: nothing is opened
jq -n '{level: "moderate", examined: 9, dirs: ["(root)"], allowlisted: [], errors: [], hits: []}' > "$TMP/s-none.json"
reset_gh
check "a summary with no hits exits 0"               "$(run_opener "$TMP/s-none.json")" "0"
check "...and runs no gh command"                    "$(wc -l < "$GH_LOG" | tr -d ' ')" "0"
check "a missing summary is refused with 2"         "$(run_opener "$TMP/absent.json")" "2"

# ─── the workflow runs these same scripts ───────────────────────────────────
echo "Workflow: .github/workflows/npm-audit-scheduled.yml"
check "the workflow file exists"                     "$([[ -f "$WORKFLOW" ]] && echo yes || echo no)" "yes"
check "it is scheduled daily"                        "$(count_lines "$WORKFLOW" '    - cron: ')" "1"
check "it runs on push to main"                      "$(count_lines "$WORKFLOW" '  push:')" "1"
check "it has workflow_dispatch"                     "$(count_lines "$WORKFLOW" '  workflow_dispatch:')" "1"
check "it calls the audit script this test proves"   "$(count_lines "$WORKFLOW" 'bash .github/scripts/audit-whole-tree.sh')" "1"
check "it calls the issue script this test proves"   "$(count_lines "$WORKFLOW" 'bash .github/scripts/open-audit-issue.sh')" "1"
check "it never uses pull_request_target"            "$(count_lines "$WORKFLOW" 'pull_request_target')" "0"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
