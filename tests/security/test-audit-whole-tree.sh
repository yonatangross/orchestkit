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

# expect_classification lives here. Sourcing it also puts this file on the mutation protocol
# tests/security/mutation-gate.sh reads, so the gate can prove the first assertion below can fail.
# The helper sets its own SCRIPT_DIR and EXIT trap; nothing below uses SCRIPT_DIR, and this
# file installs its own EXIT trap after the source.
# shellcheck source=../fixtures/test-helpers.sh
source "$REPO_ROOT/tests/fixtures/test-helpers.sh"

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
for d in clean hit low zero both noreport neterr nosev sevodd; do
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

# The planted fixture is audited from a temp directory named planted-fixture, so the stub is keyed by that name.
# Its report is the shape npm gives for lodash 4.17.20: a high and a moderate advisory.
fixture_report() {
    jq -n '{vulnerabilities: {"lodash": {name: "lodash", severity: "high",
         via: [{source: 1106913, name: "lodash", title: "Stub high advisory in lodash", severity: "high", range: "<4.17.21"},
               {source: 1108258, name: "lodash", title: "Stub moderate advisory in lodash", severity: "moderate", range: "<4.17.21"}]}},
       metadata: {vulnerabilities: {info: 0, low: 0, moderate: 1, high: 1, critical: 0, total: 2}, dependencies: {total: 1}}}'
}
fixture_report > "$STUB_REPORTS/planted-fixture.json"
mkdir -p "$TMP/trees/emptylock"
echo '{}' > "$TMP/trees/emptylock/package-lock.json"
clean_report 0 > "$STUB_REPORTS/emptylock.json"

# run_audit <extra args...>: prints the exit status; the output is left in $TMP/audit.out, the summary in $TMP/summary.json
run_audit() {
    local rc=0
    ORK_AUDIT_WRAPPER="$STUB" bash "$AUDIT" --summary-out "$TMP/summary.json" "$@" > "$TMP/audit.out" 2>&1 || rc=$?
    echo "$rc"
}
# Every read of the summary spells its jq program as a literal at the call site (no wrapper
# that takes the program as an argument: tests/security/test-jq-injection.sh forbids it).

echo "Layer 1: .github/scripts/audit-whole-tree.sh with a stubbed npm audit"

# The real decision under test: does audit-whole-tree.sh let a clean tree through (exit 0 = yes,
# exit 1 = no, exit 2 = cannot audit, which the helper reports as ERROR, never a pass). This is the
# file's first assertion, so the mutation gate inverts it and must see it fail.
audit_passes_tree() {
    ORK_AUDIT_WRAPPER="$STUB" bash "$AUDIT" --summary-out "$TMP/summary.json" --dir "$1" > "$TMP/audit.out" 2>&1
}
expect_classification yes audit_passes_tree "clean tree exits 0" "$TMP/trees/clean"
check "clean tree: 5 packages examined"             "$(jq -r '.examined' "$TMP/summary.json")"          "5"
check "clean tree: no hits"                         "$(jq -r '.hits | length' "$TMP/summary.json")"     "0"

check "a moderate advisory exits 1 (HIT)"           "$(run_audit --dir "$TMP/trees/hit")"    "1"
check "the hit names advisory 111"                  "$(jq -r '.hits[0].id' "$TMP/summary.json")"        "111"
check "the hit names its lockfile directory"        "$(jq -r '.hits[0].dir' "$TMP/summary.json")"       "$TMP/trees/hit"
check "the hit carries the severity"                "$(jq -r '.hits[0].severity' "$TMP/summary.json")"  "moderate"
check "the output says ADVISORIES"                  "$(count_lines "$TMP/audit.out" 'RESULT: ADVISORIES (exit 1)')" "1"

echo '{"111": {"reason": "test", "until": "2099-01-01"}}' > "$TMP/allow-live.json"
check "an allowlisted advisory exits 0"             "$(run_audit --dir "$TMP/trees/hit" --allowlist "$TMP/allow-live.json")" "0"
check "the allowlisted advisory is still listed"    "$(jq -r '.allowlisted[0].id' "$TMP/summary.json")" "111"
echo '{"111": {"reason": "test", "until": "2000-01-01"}}' > "$TMP/allow-expired.json"
check "an EXPIRED allowlist entry exits 1"          "$(run_audit --dir "$TMP/trees/hit" --allowlist "$TMP/allow-expired.json")" "1"

check "a low advisory is below moderate: exits 0"   "$(run_audit --dir "$TMP/trees/low")"    "0"
check "a low advisory is a hit at --level low"      "$(run_audit --dir "$TMP/trees/low" --level low)" "1"

# An advisory whose severity is missing or is a word npm does not use cannot be ranked: it is a HIT
# at every level, never dropped (it used to count as "low" and vanish below moderate).
jq -n '{vulnerabilities: {"pkg-a": {name: "pkg-a", via: [{source: 901, name: "pkg-a", title: "Stub advisory 901 in pkg-a"}]}},
        metadata: {vulnerabilities: {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 1}, dependencies: {total: 5}}}' > "$STUB_REPORTS/nosev.json"
jq -n '{vulnerabilities: {"pkg-a": {name: "pkg-a", severity: "severe", via: [{source: 902, name: "pkg-a", title: "Stub advisory 902 in pkg-a", severity: "severe"}]}},
        metadata: {vulnerabilities: {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 1}, dependencies: {total: 5}}}' > "$STUB_REPORTS/sevodd.json"
check "an advisory with NO severity is a hit (exit 1)" "$(run_audit --dir "$TMP/trees/nosev")" "1"
check "...named with its id and an unknown severity"   "$(count_lines "$TMP/audit.out" '901 [unknown severity]')" "1"
check "...and the summary keeps it as a hit"           "$(jq -r '.hits[0].severity' "$TMP/summary.json")" "unknown severity"
check "an UNKNOWN severity string is a hit (exit 1)"   "$(run_audit --dir "$TMP/trees/sevodd")" "1"
check "...named with its id and an unknown severity"   "$(count_lines "$TMP/audit.out" '902 [unknown severity]')" "1"
check "an unknown severity is a hit at --level high too" "$(run_audit --dir "$TMP/trees/nosev" --level high)" "1"

check "no usable report exits 2 (CANNOT AUDIT)"     "$(run_audit --dir "$TMP/trees/noreport")" "2"
check "the error says no usable JSON report"        "$(jq -r '.errors[0].message | test("no usable JSON report")' "$TMP/summary.json")" "true"
check "the output says CANNOT AUDIT"                "$(count_lines "$TMP/audit.out" 'RESULT: CANNOT AUDIT (exit 2)')" "1"
check "an npm error object exits 2"                 "$(run_audit --dir "$TMP/trees/neterr")" "2"
check "the error names ENOTFOUND"                   "$(jq -r '.errors[0].message | test("ENOTFOUND")' "$TMP/summary.json")" "true"
check "a missing lockfile exits 2"                  "$(run_audit --dir "$TMP/trees/nolock")" "2"
check "zero packages examined exits 2"              "$(run_audit --dir "$TMP/trees/zero")"   "2"
check "the zero-packages error says so"             "$(jq -r '.errors[0].message | test("zero packages")' "$TMP/summary.json")" "true"
check "a hit and an error together exit 2"          "$(run_audit --dir "$TMP/trees/both" --dir "$TMP/trees/noreport")" "2"
check "...and the summary keeps the hit"            "$(jq -r '.hits | length' "$TMP/summary.json")"   "1"
check "...and the summary keeps the error"          "$(jq -r '.errors | length' "$TMP/summary.json")" "1"
echo 'not json' > "$TMP/allow-broken.json"
check "an unreadable allowlist exits 2"             "$(run_audit --dir "$TMP/trees/hit" --allowlist "$TMP/allow-broken.json")" "2"
check "an unknown level is refused with 2"          "$(run_audit --dir "$TMP/trees/clean" --level nope)" "2"

# Whole tree: with no --dir the script walks every tracked lockfile of this repo (default.json = all clean).
clean_report 3 > "$STUB_REPORTS/default.json"
check "discovery run exits 0 on all-clean stubs"    "$(run_audit)"                           "0"
check "discovery covers the root lockfile"          "$(jq -r '.dirs | index("(root)") != null' "$TMP/summary.json")"         "true"
check "discovery covers docs/site"                  "$(jq -r '.dirs | index("docs/site") != null' "$TMP/summary.json")"      "true"
check "discovery covers src/hooks"                  "$(jq -r '.dirs | index("src/hooks") != null' "$TMP/summary.json")"      "true"
check "discovery covers src/mcp-server"             "$(jq -r '.dirs | index("src/mcp-server") != null' "$TMP/summary.json")" "true"
rm -f "$STUB_REPORTS/default.json"

# An empty lockfile next to a real one must not read clean (the tree-wide total would hide it).
check "an empty lockfile next to a real one exits 2" "$(run_audit --dir "$TMP/trees/clean" --dir "$TMP/trees/emptylock")" "2"
check "...and its error names the lockfile, not the tree" "$(jq -r '.errors[0].message | test("zero packages were examined in this lockfile")' "$TMP/summary.json")" "true"
check "...and the error is for the empty lockfile only" "$(jq -r '.errors | length' "$TMP/summary.json")" "1"
check "...and the output says CANNOT AUDIT"          "$(count_lines "$TMP/audit.out" 'RESULT: CANNOT AUDIT (exit 2)')" "1"

# --with-fixture (the workflow_dispatch input). Off: the fixture is not audited. On: it is ADDED, and the real tree
# is still audited in full. Both runs go through the same harness so the difference is the input and nothing else.
check "input off: a clean tree exits 0"              "$(run_audit --dir "$TMP/trees/clean")" "0"
check "input off: no fixture is in the summary"      "$(jq -r '.fixture == null' "$TMP/summary.json")" "true"
check "input off: the output never names the fixture" "$(count_lines "$TMP/audit.out" 'fixture:')" "0"
check "input off: a real hit shows no fixture advisory" "$(run_audit --dir "$TMP/trees/hit")" "1"
check "...the hit list has no lodash advisory"       "$(jq -r '[.hits[].id] | index("1106913") == null' "$TMP/summary.json")" "true"

check "input on: the fixture's red makes it exit 1"  "$(run_audit --dir "$TMP/trees/clean" --with-fixture)" "1"
check "input on: the high advisory 1106913 is a hit" "$(jq -r '[.hits[].id] | index("1106913") != null' "$TMP/summary.json")" "true"
check "input on: the moderate advisory 1108258 is a hit" "$(jq -r '[.hits[].id] | index("1108258") != null' "$TMP/summary.json")" "true"
check "input on: the hits name the fixture, not the real tree" "$(jq -r '[.hits[].dir] | unique | join(",")' "$TMP/summary.json")" "fixture (lodash 4.17.20)"
check "input on: the real tree is still examined (nonzero count)" "$(jq -r '.examined' "$TMP/summary.json")" "5"
check "input on: the fixture is counted apart"       "$(jq -r '.fixture.examined' "$TMP/summary.json")" "1"
check "input on: the summary names the fixture package" "$(jq -r '.fixture.package' "$TMP/summary.json")" "lodash 4.17.20"
check "input on: the summary lists its advisory ids" "$(jq -r '.fixture.advisories | join(",")' "$TMP/summary.json")" "1106913,1108258"
check "input on: the output prints the real tree count" "$(count_lines "$TMP/audit.out" 'real tree: 5 package(s) in 1 lockfile(s)')" "1"
check "input on: the output names lodash 4.17.20 and its ids" "$(count_lines "$TMP/audit.out" 'fixture: audited lodash 4.17.20 (1 package(s)), advisories: 1106913,1108258')" "1"
check "input on: the real tree's own hit is not hidden" "$(run_audit --dir "$TMP/trees/hit" --with-fixture)" "1"
check "...the real advisory 111 is still a hit"      "$(jq -r '[.hits[].id] | index("111") != null' "$TMP/summary.json")" "true"
check "...and so is the fixture's"                   "$(jq -r '[.hits[].id] | index("1106913") != null' "$TMP/summary.json")" "true"

# Zero real packages with the fixture on is its own case: cannot audit, never a pass and never the red proof.
check "input on, real tree empty: exits 2 (CANNOT AUDIT)" "$(run_audit --dir "$TMP/trees/zero" --with-fixture)" "2"
check "...with its own message"                      "$(jq -r '[.errors[].message | test("the real tree examined zero packages")] | any' "$TMP/summary.json")" "true"
check "...that says the fixture does not count"      "$(jq -r '[.errors[].message | test("planted fixture does not count")] | any' "$TMP/summary.json")" "true"
check "...and the output says CANNOT AUDIT, not ADVISORIES" "$(count_lines "$TMP/audit.out" 'RESULT: CANNOT AUDIT (exit 2)')" "1"

# The fixture is a control that must fail: if the audit finds nothing in lodash 4.17.20 the proof is void.
clean_report 3 > "$STUB_REPORTS/planted-fixture.json"
check "input on, fixture finds nothing: exits 2"     "$(run_audit --dir "$TMP/trees/clean" --with-fixture)" "2"
check "...saying it cannot prove a known red"        "$(jq -r '[.errors[].message | test("produced no advisory")] | any' "$TMP/summary.json")" "true"
fixture_report > "$STUB_REPORTS/planted-fixture.json"

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

# The COMMITTED fixture (tests/security/fixtures/npm-audit-planted), through the real --with-fixture flag, next to a
# real lockfile that is clean today (is-number 7.0.0). Off: exit 0 and no fixture. On: exit 1, the fixture's advisory
# ids are rediscovered live and named in the output, and the real lockfile is still examined.
CLEANLIVE="$TMP/cleanlive"
mkdir -p "$CLEANLIVE"
cat > "$CLEANLIVE/package.json" <<'EOF'
{ "name": "ork-audit-clean-live", "version": "1.0.0", "private": true, "dependencies": { "is-number": "7.0.0" } }
EOF
cat > "$CLEANLIVE/package-lock.json" <<'EOF'
{
  "name": "ork-audit-clean-live", "version": "1.0.0", "lockfileVersion": 3, "requires": true,
  "packages": {
    "": { "name": "ork-audit-clean-live", "version": "1.0.0", "dependencies": { "is-number": "7.0.0" } },
    "node_modules/is-number": { "version": "7.0.0", "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz" }
  }
}
EOF
OFF_RC=0
bash "$AUDIT" --dir "$CLEANLIVE" --summary-out "$TMP/live-off.json" > "$TMP/live-off.out" 2>&1 || OFF_RC=$?
check "live, input off: the clean real lockfile exits 0" "$OFF_RC" "0"
check "live, input off: the fixture is not audited"  "$(jq -r '.fixture == null' "$TMP/live-off.json")" "true"
ON_RC=0
bash "$AUDIT" --dir "$CLEANLIVE" --with-fixture --summary-out "$TMP/live-on.json" > "$TMP/live-on.out" 2>&1 || ON_RC=$?
check "live, input on: the committed fixture makes it exit 1" "$ON_RC" "1"
check "live, input on: advisory 1106913 is rediscovered" "$(jq -r '.fixture.advisories | index("1106913") != null' "$TMP/live-on.json")" "true"
check "live, input on: the output names lodash 4.17.20"  "$(count_lines "$TMP/live-on.out" 'fixture: audited lodash 4.17.20')" "1"
check "live, input on: the output names an advisory id"  "$(count_lines "$TMP/live-on.out" 'advisories: 1106913')" "1"
check "live, input on: the real lockfile is still examined" "$(jq -r '.examined > 0' "$TMP/live-on.json")" "true"
check "live, input on: the output prints the real tree count" "$(count_lines "$TMP/live-on.out" 'real tree: 1 package(s) in 1 lockfile(s)')" "1"
check "the committed fixture lockfile exists under its .fixture name" "$([[ -f "$REPO_ROOT/tests/security/fixtures/npm-audit-planted/package-lock.json.fixture" ]] && echo yes || echo no)" "yes"
check "...and no file in the fixture directory is named package-lock.json" "$([[ ! -e "$REPO_ROOT/tests/security/fixtures/npm-audit-planted/package-lock.json" ]] && echo yes || echo no)" "yes"

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
check "dry run prints the exact edit command"        "$(count_lines "$TMP/opener.out" 'issue edit <N> --repo owner/repo --body-file <body file>')" "1"
check "dry run says which values are placeholders"   "$(count_lines "$TMP/opener.out" 'placeholders: <N> is the issue number step 1 returns; <body file> is the body printed below the commands.')" "1"
check "dry run prints the lookup the real run executes" "$(count_lines "$TMP/opener.out" "jq -r --arg key '[set f6e0a1e2ac41]' '[.[] | select(.title | contains(\$key))] | .[0].number // empty'")" "1"
check "the real run executes that same lookup (one shared definition)" "$(count_lines "$OPENER" '-f "$WORK/lookup.jq" "$WORK/open.json"')" "1"

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

# Registry text with a newline, an @mention and an HTML tag must stay inside code spans, on ONE table row.
jq -n --arg title $'first line\n@someone ping\n<img src=x>' --arg name $'pkg\n@evil' --arg dir $'src/hooks\n@dir' '
  {level: "moderate", examined: 9, dirs: ["(root)"], allowlisted: [], errors: [],
   hits: [{dir: $dir, id: "333", severity: "moderate", name: $name, title: $title}]}' > "$TMP/s-newline.json"
echo '[]' > "$GH_LIST"
reset_gh
check "a newline in registry text: the run exits 0"  "$(run_opener "$TMP/s-newline.json")" "0"
sed 's/`[^`]*`//g' "$GH_BODY_COPY" > "$TMP/body-nl-outside.md"
check "...the table row is one line, every field in a code span" "$(count_lines "$GH_BODY_COPY" '| `src/hooks @dir` | 333 | moderate | `pkg @evil` | `first line @someone ping <img src=x>` |')" "1"
check "...no @ outside a code span"                  "$(count_lines "$TMP/body-nl-outside.md" '@')" "0"
check "...no HTML tag outside a code span"           "$(count_lines "$TMP/body-nl-outside.md" '<img')" "0"
jq -n '{level: "moderate", examined: 9, dirs: ["(root)"], allowlisted: [], errors: [],
        hits: [{dir: "(root)", id: "444\n@id", severity: "high\n@sev", name: "n", title: "t"}]}' > "$TMP/s-idsev.json"
reset_gh
check "an @ in an id or severity field: the run exits 0" "$(run_opener "$TMP/s-idsev.json")" "0"
sed 's/`[^`]*`//g' "$GH_BODY_COPY" > "$TMP/body-idsev-outside.md"
check "...none of it reaches the body as a mention"  "$(count_lines "$TMP/body-idsev-outside.md" '@')" "0"

# A red run that is not an advisory hit opens ONE distinct item, with its own title key.
jq -n --arg msg $'npm audit produced no usable JSON report (exit 1): first\n@someone `tick` <img src=x>' '
  {level: "moderate", examined: 0, dirs: [], allowlisted: [], hits: [], fixture: null,
   errors: [{dir: "src/hooks", message: $msg}]}' > "$TMP/s-cannot.json"
echo '[]' > "$GH_LIST"
reset_gh
check "cannot-audit dry run exits 0"                 "$(run_opener "$TMP/s-cannot.json" --mode cannot-audit --dry-run)" "0"
check "...with its own key, not an advisory set"     "$(count_lines "$TMP/opener.out" 'set key: cannot-audit (ids: -)')" "1"
check "...and the exact create command"              "$(count_lines "$TMP/opener.out" "issue create --repo owner/repo --label security --title 'npm audit: the scheduled whole-tree audit could not complete [cannot-audit]'")" "1"
reset_gh
check "cannot-audit real run exits 0"                "$(run_opener "$TMP/s-cannot.json" --mode cannot-audit --reason 'the audit did not complete (status 2)')" "0"
check "...creates exactly one issue"                 "$(count_lines "$GH_LOG" 'issue create')" "1"
check "...titled with the [cannot-audit] key"        "$(count_lines "$GH_LOG" '[cannot-audit] --body-file')" "1"
check "...never with an advisory set key"            "$(count_lines "$GH_LOG" '[set ')" "0"
check "...the body has the cannot-audit marker"      "$(count_lines "$GH_BODY_COPY" '<!-- npm-audit-cannot-audit -->')" "1"
check "...the body gives the reason"                 "$(count_lines "$GH_BODY_COPY" '- Reason: the audit did not complete (status 2)')" "1"
check "...the body has the error, on one line, in a code span" "$(count_lines "$GH_BODY_COPY" '- `src/hooks`: `npm audit produced no usable JSON report (exit 1): first @someone ’tick’ <img src=x>`')" "1"
check "...the body never claims an advisory"         "$(count_lines "$GH_BODY_COPY" 'npm-audit-set')" "0"
sed 's/`[^`]*`//g' "$GH_BODY_COPY" > "$TMP/body-cannot-outside.md"
check "...no @ outside a code span"                  "$(count_lines "$TMP/body-cannot-outside.md" '@')" "0"
check "...no HTML tag outside a code span"           "$(count_lines "$TMP/body-cannot-outside.md" '<img')" "0"

echo '[{"number": 77, "title": "npm audit: the scheduled whole-tree audit could not complete [cannot-audit]"}]' > "$GH_LIST"
reset_gh
check "a second cannot-audit run exits 0"            "$(run_opener "$TMP/s-cannot.json" --mode cannot-audit)" "0"
check "...edits issue 77"                            "$(count_lines "$GH_LOG" 'issue edit 77 --repo owner/repo --body-file')" "1"
check "...and opens no second issue"                 "$(count_lines "$GH_LOG" 'issue create')" "0"
# the two kinds of item never edit each other
reset_gh
check "an advisory run beside an open cannot-audit issue exits 0" "$(run_opener "$TMP/s111.json")" "0"
check "...opens its own set issue"                   "$(count_lines "$GH_LOG" 'issue create')" "1"
check "...and does not edit the cannot-audit issue"  "$(count_lines "$GH_LOG" 'issue edit')" "0"
echo '[{"number": 42, "title": "npm audit: 1 advisories at moderate or above [set f6e0a1e2ac41]"}]' > "$GH_LIST"
reset_gh
check "a cannot-audit run beside an open set issue exits 0" "$(run_opener "$TMP/s-cannot.json" --mode cannot-audit)" "0"
check "...opens its own item"                        "$(count_lines "$GH_LOG" 'issue create')" "1"
check "...and does not edit the set issue"           "$(count_lines "$GH_LOG" 'issue edit')" "0"

# The audit died before writing a summary: the item still opens, saying so.
echo '[]' > "$GH_LIST"
reset_gh
check "cannot-audit with no summary file exits 0"    "$(run_opener "$TMP/absent.json" --mode cannot-audit --reason 'the audit did not complete (status unknown)')" "0"
check "...creates one issue"                         "$(count_lines "$GH_LOG" 'issue create')" "1"
check "...and says no summary was written"           "$(count_lines "$GH_BODY_COPY" 'No summary was written')" "1"
check "an unknown mode is refused with 2"            "$(run_opener "$TMP/s-cannot.json" --mode nonsense)" "2"

# A planted-fixture run's item is marked as a test, in the title and in the body.
jq -n '{level: "moderate", examined: 5, dirs: ["(root)"], allowlisted: [], errors: [],
        fixture: {package: "lodash 4.17.20", examined: 1, advisories: ["1106913"]},
        hits: [{dir: "fixture (lodash 4.17.20)", id: "1106913", severity: "high", name: "lodash", title: "t"}]}' > "$TMP/s-fixture.json"
reset_gh
check "a fixture run opens an issue (exit 0)"        "$(run_opener "$TMP/s-fixture.json")" "0"
check "...its title says TEST (planted fixture)"     "$(count_lines "$GH_LOG" '--title TEST (planted fixture): npm audit: 1 advisories at moderate or above')" "1"
check "...its body says it is a test run"            "$(count_lines "$GH_BODY_COPY" 'TEST RUN: the planted fixture lodash 4.17.20 was added on purpose')" "1"
reset_gh
check "a real hit run exits 0"                       "$(run_opener "$TMP/s111.json")" "0"
check "...and is not marked as a test"               "$(count_lines "$GH_LOG" 'TEST (planted fixture)')" "0"

# ─── the workflow runs these same scripts ───────────────────────────────────
echo "Workflow: .github/workflows/npm-audit-scheduled.yml"
check "the workflow file exists"                     "$([[ -f "$WORKFLOW" ]] && echo yes || echo no)" "yes"
check "it is scheduled daily"                        "$(count_lines "$WORKFLOW" '    - cron: ')" "1"
check "it runs on push to main"                      "$(count_lines "$WORKFLOW" '  push:')" "1"
check "it has workflow_dispatch"                     "$(count_lines "$WORKFLOW" '  workflow_dispatch:')" "1"
check "it calls the audit script this test proves"   "$(count_lines "$WORKFLOW" 'bash .github/scripts/audit-whole-tree.sh')" "1"
check "it calls the issue script this test proves (advisory item and cannot-audit item)" "$(count_lines "$WORKFLOW" 'bash .github/scripts/open-audit-issue.sh')" "2"
check "it never uses pull_request_target"            "$(count_lines "$WORKFLOW" 'pull_request_target')" "0"
check "the checkout pin comment names v7.0.1"        "$(count_lines "$WORKFLOW" 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1')" "1"
check "...and no stale v6.0.3 comment is left"       "$(count_lines "$WORKFLOW" '# v6.0.3')" "0"

echo "Workflow: the plant_fixture input and the cannot-audit item"
check "plant_fixture is a boolean input"             "$(count_lines "$WORKFLOW" '        type: boolean')" "1"
check "...default off"                               "$(count_lines "$WORKFLOW" '        default: false')" "1"
check "...read in exactly one place, an env line"    "$(count_lines "$WORKFLOW" 'inputs.plant_fixture')" "1"
check "...and that place is PLANT_FIXTURE in env"    "$(count_lines "$WORKFLOW" '          PLANT_FIXTURE: ${{ inputs.plant_fixture }}')" "1"
check "the cannot-audit step exists"                 "$(count_lines "$WORKFLOW" '        id: cannot')" "1"
check "...runs the issue script in cannot-audit mode" "$(count_lines "$WORKFLOW" '            --mode cannot-audit \')" "1"
check "...on a non-clean audit or a failed advisory step" "$(count_lines "$WORKFLOW" "        if: always() && (steps.audit.outputs.cannot_audit != 'false' || steps.advisories.outcome == 'failure')")" "1"
check "the final step fails the job on any red outcome" "$(count_lines "$WORKFLOW" "        if: always() && (steps.audit.outputs.status != '0' || steps.audit.outputs.hits != '0' || steps.advisories.outcome == 'failure' || steps.cannot.outcome == 'failure')")" "1"

# The audit step's shell text, taken from the shipped file, run against a stub audit script. The stub writes
# the summary and exit status it is told to, and records its argv, so the outcome logic is tested on the real text.
STEP_DIR="$TMP/step"
mkdir -p "$STEP_DIR/.github/scripts" "$STEP_DIR/rt"
cat > "$STEP_DIR/.github/scripts/audit-whole-tree.sh" <<'EOF'
#!/usr/bin/env bash
echo "$*" > "$STEP_ARGS"
out=""
for ((i = 1; i <= $#; i++)); do
  if [[ "${!i}" == "--summary-out" ]]; then j=$((i + 1)); out="${!j}"; fi
done
if [[ -n "${STEP_SUMMARY:-}" && -n "$out" ]]; then cp "$STEP_SUMMARY" "$out"; fi
exit "${STEP_STATUS:-0}"
EOF
STEP_SH="$STEP_DIR/audit-step.sh"
awk '/^        id: audit$/ { on = 1; next }
     on && /^        run: \|$/ { body = 1; next }
     body && /^      - name:/ { exit }
     body { sub(/^          /, ""); print }' "$WORKFLOW" > "$STEP_SH"
check "the audit step's script was extracted (a floor, not an empty loop)" "$(awk 'END { print (NR > 20) ? "yes" : "no" }' "$STEP_SH")" "yes"
echo '{"hits": [{"id": "1"}], "errors": []}' > "$STEP_DIR/s-hit.json"
echo '{"hits": [], "errors": []}' > "$STEP_DIR/s-none.json"
echo 'not json' > "$STEP_DIR/s-broken.json"
# run_step <stub exit status> <summary the stub writes, or empty> <PLANT_FIXTURE value>: the outputs land in $STEP_DIR/out.
# The step's own exit status is not what is asserted (the outputs are), so a failing step must not stop this test.
run_step() {
    rm -f "$STEP_DIR/out" "$STEP_DIR/args" "$STEP_DIR/rt/audit-summary.json"
    : > "$STEP_DIR/out"
    local rc=0
    (cd "$STEP_DIR" && STEP_STATUS="$1" STEP_SUMMARY="$2" STEP_ARGS="$STEP_DIR/args" RUNNER_TEMP="$STEP_DIR/rt" \
        GITHUB_OUTPUT="$STEP_DIR/out" PLANT_FIXTURE="$3" bash -eo pipefail "$STEP_SH" > "$STEP_DIR/log" 2>&1) || rc=$?
    echo "$rc" > "$STEP_DIR/rc"
}
step_out() { awk -F= -v k="$1" '$1 == k { print $2 }' "$STEP_DIR/out"; }

run_step 0 "$STEP_DIR/s-none.json" ""
check "step: a clean run is not cannot_audit"        "$(step_out cannot_audit)" "false"
check "step: a clean run records status 0 and no hits" "$(step_out status)/$(step_out hits)" "0/0"
run_step 1 "$STEP_DIR/s-hit.json" ""
check "step: a real hit (status 1, one hit) is not cannot_audit" "$(step_out cannot_audit)" "false"
check "step: ...and records the hit"                 "$(step_out hits)" "1"
run_step 1 "$STEP_DIR/s-none.json" ""
check "step: status 1 with ZERO hits is cannot_audit (never an 'issue opened' claim)" "$(step_out cannot_audit)" "true"
run_step 1 "" ""
check "step: status 1 and no summary is cannot_audit" "$(step_out cannot_audit)" "true"
run_step 2 "$STEP_DIR/s-hit.json" ""
check "step: status 2 with hits is cannot_audit (and still records the hits)" "$(step_out cannot_audit)/$(step_out hits)" "true/1"
run_step 0 "$STEP_DIR/s-hit.json" ""
check "step: status 0 with hits is not trusted: cannot_audit" "$(step_out cannot_audit)" "true"
run_step 0 "$STEP_DIR/s-broken.json" ""
check "step: an unreadable summary is cannot_audit with status 2" "$(step_out cannot_audit)/$(step_out status)" "true/2"
run_step 7 "" ""
check "step: any other exit status is cannot_audit"  "$(step_out cannot_audit)" "true"

# The input reaches the script only as the validated env value. Off and on must differ, and the real audit call is the same.
run_step 0 "$STEP_DIR/s-none.json" ""
check "step, input unset: the script gets no --with-fixture" "$(count_lines "$STEP_DIR/args" '--with-fixture')" "0"
check "step, input unset: the real audit still runs"  "$(count_lines "$STEP_DIR/args" '--summary-out')" "1"
run_step 0 "$STEP_DIR/s-none.json" "false"
check "step, input false: the script gets no --with-fixture" "$(count_lines "$STEP_DIR/args" '--with-fixture')" "0"
run_step 0 "$STEP_DIR/s-none.json" "true"
check "step, input true: the script gets --with-fixture" "$(count_lines "$STEP_DIR/args" '--with-fixture')" "1"
check "step, input true: the real audit still runs, same call" "$(count_lines "$STEP_DIR/args" '--summary-out')" "1"
run_step 0 "$STEP_DIR/s-none.json" "banana"
check "step, input invalid: the audit script is never called" "$([[ -e "$STEP_DIR/args" ]] && echo called || echo not-called)" "not-called"
check "step, input invalid: cannot_audit with status 2" "$(step_out cannot_audit)/$(step_out status)" "true/2"
run_step 0 "$STEP_DIR/s-none.json" 'true; echo pwned'
check "step, input with a shell payload: refused, not run" "$([[ -e "$STEP_DIR/args" ]] && echo called || echo not-called)" "not-called"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
